import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const vacationRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createVacationSchema = z.object({
  companyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  requestedMoveOut: z.string().date(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["requested", "confirmed", "inspection_scheduled", "restoration_in_progress", "completed"]),
  actualMoveOut: z.string().date().optional(),
  inspectionDate: z.string().date().optional(),
  restorationCost: z.number().int().min(0).optional(),
  depositRefund: z.number().int().min(0).optional(),
  restorationNotes: z.string().optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------
// POST /api/vacations - 退去申請
// ---------------------------------------------------------------

vacationRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createVacationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, tenantId, requestedMoveOut, notes } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }
  if (tenant.status === "vacated") {
    return c.json({ error: { code: "INVALID_STATE", message: "既に退去済みです" } }, 400);
  }

  const vacation = await prisma.$transaction(async (tx) => {
    const v = await tx.vacation.create({
      data: {
        companyId,
        tenantId,
        propertyId: tenant.propertyId,
        requestedMoveOut: new Date(requestedMoveOut),
        notes,
      },
    });

    // テナントのステータスを notice_given に更新
    await tx.tenant.update({
      where: { id: tenantId },
      data: { status: "notice_given" },
    });

    // 退去対応タスク自動生成
    await tx.task.create({
      data: {
        companyId,
        title: `退去対応: ${tenant.name}`,
        description: `退去希望日: ${requestedMoveOut}\n物件ID: ${tenant.propertyId}`,
        taskType: "other",
        priority: "high",
        dueDate: new Date(requestedMoveOut),
      },
    });

    return v;
  });

  return c.json({ data: vacation }, 201);
});

// ---------------------------------------------------------------
// GET /api/vacations - 退去一覧
// ---------------------------------------------------------------

vacationRoutes.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const status = c.req.query("status");

  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const vacations = await prisma.vacation.findMany({
    where,
    include: { tenant: { select: { id: true, name: true, propertyId: true } } },
    orderBy: { requestedMoveOut: "asc" },
  });

  return c.json({ data: vacations });
});

// ---------------------------------------------------------------
// PUT /api/vacations/:id/status - 退去ステータス更新
// ---------------------------------------------------------------

vacationRoutes.put("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.vacation.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "退去レコードが見つかりません" } }, 404);
  }

  const { status, actualMoveOut, inspectionDate, restorationCost, depositRefund, restorationNotes, notes } = parsed.data;

  const vacation = await prisma.$transaction(async (tx) => {
    const updated = await tx.vacation.update({
      where: { id },
      data: {
        status,
        ...(actualMoveOut ? { actualMoveOut: new Date(actualMoveOut) } : {}),
        ...(inspectionDate ? { inspectionDate: new Date(inspectionDate) } : {}),
        ...(restorationCost !== undefined ? { restorationCost } : {}),
        ...(depositRefund !== undefined ? { depositRefund } : {}),
        ...(restorationNotes ? { restorationNotes } : {}),
        ...(notes ? { notes } : {}),
      },
    });

    // completed → テナントを vacated に、物件を available に
    if (status === "completed") {
      await tx.tenant.update({
        where: { id: existing.tenantId },
        data: {
          status: "vacated",
          moveOutDate: actualMoveOut ? new Date(actualMoveOut) : new Date(),
        },
      });

      await tx.property.update({
        where: { id: existing.propertyId },
        data: { status: "available" },
      });
    }

    return updated;
  });

  return c.json({ data: vacation });
});

export { vacationRoutes };
