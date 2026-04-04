import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const applicationRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createApplicationSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  propertyId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  desiredMoveIn: z.string().date().optional(),
  notes: z.string().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(["pending", "screening", "approved", "rejected", "cancelled"]),
  changedBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["pending", "screening", "approved", "rejected", "cancelled"]).optional(),
  customerId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/applications - 申込一覧
// ---------------------------------------------------------------

applicationRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, customerId, propertyId, assignedUserId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (propertyId) where.propertyId = propertyId;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, name: true, rent: true, address: true, status: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.application.count({ where }),
  ]);

  return c.json({
    data: applications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/applications/:id - 申込詳細
// ---------------------------------------------------------------

applicationRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      property: { select: { id: true, name: true, rent: true, address: true, roomLayout: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!application) {
    return c.json({ error: { code: "NOT_FOUND", message: "申込が見つかりません" } }, 404);
  }

  return c.json({ data: application });
});

// ---------------------------------------------------------------
// POST /api/applications - 申込登録
// ---------------------------------------------------------------

applicationRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, customerId, propertyId, assignedUserId, desiredMoveIn, notes } = parsed.data;

  // 物件の存在・空室確認
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }
  if (property.status !== "available") {
    return c.json({ error: { code: "UNAVAILABLE", message: "この物件は現在申込できません" } }, 409);
  }

  // 同一顧客・同一物件の重複申込チェック
  const existing = await prisma.application.findFirst({
    where: {
      companyId,
      customerId,
      propertyId,
      status: { in: ["pending", "screening"] },
    },
  });
  if (existing) {
    return c.json({ error: { code: "DUPLICATE", message: "この物件には既に申込中です" } }, 409);
  }

  const application = await prisma.$transaction(async (tx) => {
    // 申込作成
    const app = await tx.application.create({
      data: {
        companyId,
        customerId,
        propertyId,
        assignedUserId,
        desiredMoveIn: desiredMoveIn ? new Date(desiredMoveIn) : undefined,
        notes,
      },
      include: {
        customer: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    // ステータス履歴を記録
    await tx.applicationStatusHistory.create({
      data: {
        companyId,
        applicationId: app.id,
        toStatus: "pending",
      },
    });

    // 物件ステータスを reserved に更新
    await tx.property.update({
      where: { id: propertyId },
      data: { status: "reserved" },
    });

    // 担当者へ通知タスク自動生成
    const targetUserId = assignedUserId ?? (
      await tx.customer.findUnique({ where: { id: customerId }, select: { assignedUserId: true } })
    )?.assignedUserId;

    if (targetUserId) {
      await tx.task.create({
        data: {
          companyId,
          assignedUserId: targetUserId,
          customerId,
          title: `新規申込対応: ${app.customer.name} → ${app.property.name}`,
          description: `申込ID: ${app.id}\n物件: ${app.property.name}\n${notes ?? ""}`,
          taskType: "contract",
          priority: "high",
          dueDate: new Date(Date.now() + 86400000), // 翌日
        },
      });
    }

    return app;
  });

  return c.json({ data: application }, 201);
});

// ---------------------------------------------------------------
// PUT /api/applications/:id/status - ステータス更新
// ---------------------------------------------------------------

applicationRoutes.put("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "申込が見つかりません" } }, 404);
  }

  const { status, changedBy, reason } = parsed.data;

  const application = await prisma.$transaction(async (tx) => {
    // 申込ステータス更新
    const app = await tx.application.update({
      where: { id },
      data: { status },
    });

    // 履歴記録
    await tx.applicationStatusHistory.create({
      data: {
        companyId: existing.companyId,
        applicationId: id,
        fromStatus: existing.status,
        toStatus: status,
        changedBy,
        reason,
      },
    });

    // rejected/cancelled の場合、物件を available に戻す
    if (status === "rejected" || status === "cancelled") {
      const otherActive = await tx.application.count({
        where: {
          propertyId: existing.propertyId,
          id: { not: id },
          status: { in: ["pending", "screening", "approved"] },
        },
      });
      if (otherActive === 0) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data: { status: "available" },
        });
      }
    }

    // approved の場合、物件を contracted に更新
    if (status === "approved") {
      await tx.property.update({
        where: { id: existing.propertyId },
        data: { status: "contracted" },
      });
    }

    return app;
  });

  return c.json({ data: application });
});

export { applicationRoutes };
