import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const contractRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createContractSchema = z.object({
  companyId: z.string().uuid(),
  applicationId: z.string().uuid(),
  contractType: z.enum(["lease", "renewal", "termination"]).default("lease"),
  rentAmount: z.number().int().min(0),
  depositAmount: z.number().int().min(0).default(0),
  keyMoneyAmount: z.number().int().min(0).default(0),
  leaseStartDate: z.string().date().optional(),
  leaseEndDate: z.string().date().optional(),
  templateData: z.record(z.string(), z.unknown()).default({}),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["draft", "sent", "signed", "cancelled"]).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/contracts - 契約一覧
// ---------------------------------------------------------------

contractRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, customerId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        application: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            property: { select: { id: true, name: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.contract.count({ where }),
  ]);

  return c.json({
    data: contracts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/contracts/:id - 契約詳細
// ---------------------------------------------------------------

contractRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      application: {
        include: {
          customer: true,
          property: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!contract) {
    return c.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, 404);
  }

  return c.json({ data: contract });
});

// ---------------------------------------------------------------
// POST /api/contracts - 契約書作成
// ---------------------------------------------------------------

contractRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, applicationId, contractType, leaseStartDate, leaseEndDate, templateData, ...amounts } = parsed.data;

  // 申込の存在・ステータス確認
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      customer: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, address: true, rent: true } },
    },
  });

  if (!application) {
    return c.json({ error: { code: "NOT_FOUND", message: "申込が見つかりません" } }, 404);
  }
  if (!["screening", "approved"].includes(application.status)) {
    return c.json({ error: { code: "INVALID_STATE", message: "申込が審査中または承認済みである必要があります" } }, 400);
  }

  // PDF URL はテンプレートエンジンで生成する想定（ここではプレースホルダ）
  const pdfUrl = `/api/contracts/pdf/draft_${Date.now()}.pdf`;

  const contract = await prisma.contract.create({
    data: {
      companyId,
      applicationId,
      customerId: application.customerId,
      propertyId: application.propertyId,
      contractType,
      ...amounts,
      leaseStartDate: leaseStartDate ? new Date(leaseStartDate) : undefined,
      leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : undefined,
      templateData: {
        ...templateData,
        customerName: application.customer.name,
        propertyName: application.property.name,
        propertyAddress: application.property.address,
      },
      pdfUrl,
      status: "draft",
    },
    include: {
      application: {
        include: {
          customer: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
        },
      },
    },
  });

  return c.json({ data: contract }, 201);
});

// ---------------------------------------------------------------
// POST /api/contracts/:id/send - 署名依頼送信
// ---------------------------------------------------------------

contractRoutes.post("/:id/send", async (c) => {
  const id = c.req.param("id");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      application: {
        include: {
          customer: { select: { id: true, name: true, email: true, lineUserId: true } },
        },
      },
    },
  });

  if (!contract) {
    return c.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, 404);
  }
  if (contract.status !== "draft") {
    return c.json({ error: { code: "INVALID_STATE", message: "draft ステータスの契約のみ送信可能です" } }, 400);
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      status: "sent",
      sentAt: new Date(),
    },
  });

  // 通知タスク生成（メール/LINE通知の実行はサービス層が担当）
  await prisma.task.create({
    data: {
      companyId: contract.companyId,
      customerId: contract.customerId,
      title: `契約書署名依頼送信済み: ${contract.application.customer.name}`,
      description: `契約ID: ${contract.id}\n送信日時: ${new Date().toISOString()}`,
      taskType: "contract",
      priority: "medium",
    },
  });

  return c.json({
    data: {
      ...updated,
      notification: {
        email: contract.application.customer.email ? "queued" : "no_email",
        line: contract.application.customer.lineUserId ? "queued" : "no_line",
      },
    },
  });
});

// ---------------------------------------------------------------
// POST /api/contracts/:id/sign - 署名受付・完了処理
// ---------------------------------------------------------------

const signSchema = z.object({
  signatureImage: z.string().optional(), // Base64 署名画像
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

contractRoutes.post("/:id/sign", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) {
    return c.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, 404);
  }
  if (contract.status !== "sent") {
    return c.json({ error: { code: "INVALID_STATE", message: "sent ステータスの契約のみ署名可能です" } }, 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 契約を署名完了に更新
    const signed = await tx.contract.update({
      where: { id },
      data: {
        status: "signed",
        signedAt: new Date(),
        signatureData: {
          signedAt: new Date().toISOString(),
          ipAddress: parsed.data.ipAddress,
          userAgent: parsed.data.userAgent,
          hasSignatureImage: !!parsed.data.signatureImage,
        },
      },
    });

    // 申込を approved に更新
    await tx.application.update({
      where: { id: contract.applicationId },
      data: { status: "approved" },
    });

    // 物件を contracted に更新
    await tx.property.update({
      where: { id: contract.propertyId },
      data: { status: "contracted" },
    });

    // 通知タスク生成
    await tx.task.create({
      data: {
        companyId: contract.companyId,
        customerId: contract.customerId,
        title: "契約署名完了 — 鍵引渡し手配",
        description: `契約ID: ${contract.id}\n署名日時: ${new Date().toISOString()}`,
        taskType: "contract",
        priority: "high",
      },
    });

    return signed;
  });

  return c.json({ data: updated });
});

// ---------------------------------------------------------------
// GET /api/contracts/:id/pdf - PDF取得
// ---------------------------------------------------------------

contractRoutes.get("/:id/pdf", async (c) => {
  const id = c.req.param("id");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      application: {
        include: {
          customer: true,
          property: true,
        },
      },
    },
  });

  if (!contract) {
    return c.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, 404);
  }

  // 実際のPDF生成はテンプレートエンジン（puppeteer/pdfkit等）で行う
  // ここではメタデータとダウンロードURLを返す
  return c.json({
    data: {
      contractId: contract.id,
      status: contract.status,
      pdfUrl: contract.pdfUrl,
      templateData: contract.templateData,
      generatedAt: new Date().toISOString(),
    },
  });
});

export { contractRoutes };
