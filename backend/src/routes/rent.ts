import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const rentRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力"),
  otherCharges: z.number().int().min(0).default(0),
  dueDate: z.string().date(),
  notes: z.string().optional(),
});

const bulkCreateSchema = z.object({
  companyId: z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  dueDate: z.string().date(),
});

const paySchema = z.object({
  paidAmount: z.number().int().min(0),
  paymentMethod: z.enum(["bank_transfer", "credit_card", "direct_debit"]).optional(),
  notes: z.string().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["pending", "paid", "overdue", "partial", "cancelled"]).optional(),
  tenantId: z.string().uuid().optional(),
  billingMonth: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/rent/invoices - 請求書一覧
// ---------------------------------------------------------------

rentRoutes.get("/invoices", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, tenantId, billingMonth, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (billingMonth) where.billingMonth = billingMonth;

  const [invoices, total] = await Promise.all([
    prisma.rentInvoice.findMany({
      where,
      include: { tenant: { select: { id: true, name: true, propertyId: true } } },
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.rentInvoice.count({ where }),
  ]);

  return c.json({
    data: invoices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// POST /api/rent/invoices - 請求書作成（単体）
// ---------------------------------------------------------------

rentRoutes.post("/invoices", async (c) => {
  const body = await c.req.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, tenantId, billingMonth, otherCharges, dueDate, notes } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }

  const totalAmount = tenant.rentAmount + tenant.managementFee + otherCharges;

  const invoice = await prisma.rentInvoice.create({
    data: {
      companyId,
      tenantId,
      propertyId: tenant.propertyId,
      billingMonth,
      rentAmount: tenant.rentAmount,
      managementFee: tenant.managementFee,
      otherCharges,
      totalAmount,
      dueDate: new Date(dueDate),
      notes,
    },
  });

  return c.json({ data: invoice }, 201);
});

// ---------------------------------------------------------------
// POST /api/rent/invoices/bulk - 月次一括請求書生成
// ---------------------------------------------------------------

rentRoutes.post("/invoices/bulk", async (c) => {
  const body = await c.req.json();
  const parsed = bulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, billingMonth, dueDate } = parsed.data;

  // active な入居者を全取得
  const tenants = await prisma.tenant.findMany({
    where: { companyId, status: "active" },
  });

  // 既存の請求書チェック（重複防止）
  const existing = await prisma.rentInvoice.findMany({
    where: { companyId, billingMonth },
    select: { tenantId: true },
  });
  const existingTenantIds = new Set(existing.map((e) => e.tenantId));

  const newTenants = tenants.filter((t) => !existingTenantIds.has(t.id));

  if (newTenants.length === 0) {
    return c.json({ data: { createdCount: 0, message: "全入居者の請求書は作成済みです" } });
  }

  const result = await prisma.rentInvoice.createMany({
    data: newTenants.map((t) => ({
      companyId,
      tenantId: t.id,
      propertyId: t.propertyId,
      billingMonth,
      rentAmount: t.rentAmount,
      managementFee: t.managementFee,
      otherCharges: 0,
      totalAmount: t.rentAmount + t.managementFee,
      dueDate: new Date(dueDate),
    })),
  });

  return c.json({ data: { createdCount: result.count, billingMonth } }, 201);
});

// ---------------------------------------------------------------
// PUT /api/rent/invoices/:id/pay - 入金処理
// ---------------------------------------------------------------

rentRoutes.put("/invoices/:id/pay", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const invoice = await prisma.rentInvoice.findUnique({ where: { id } });
  if (!invoice) {
    return c.json({ error: { code: "NOT_FOUND", message: "請求書が見つかりません" } }, 404);
  }

  const { paidAmount, paymentMethod, notes } = parsed.data;
  const status = paidAmount >= invoice.totalAmount ? "paid" : "partial";

  const updated = await prisma.rentInvoice.update({
    where: { id },
    data: {
      paidAmount,
      paidAt: new Date(),
      paymentMethod,
      status,
      notes: notes ?? invoice.notes,
    },
  });

  return c.json({ data: updated });
});

// ---------------------------------------------------------------
// GET /api/rent/invoices/overdue - 滞納アラート
// ---------------------------------------------------------------

rentRoutes.get("/invoices/overdue", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 期限超過で未払いの請求書を検出し、ステータスを overdue に更新
  await prisma.rentInvoice.updateMany({
    where: {
      companyId,
      status: "pending",
      dueDate: { lt: today },
    },
    data: { status: "overdue" },
  });

  const overdue = await prisma.rentInvoice.findMany({
    where: {
      companyId,
      status: { in: ["overdue", "partial"] },
    },
    include: { tenant: { select: { id: true, name: true, email: true, phone: true, propertyId: true } } },
    orderBy: { dueDate: "asc" },
  });

  // 滞納通知タスクを自動生成（まだ生成されていない分のみ）
  for (const inv of overdue) {
    const existingTask = await prisma.task.findFirst({
      where: {
        companyId,
        title: { contains: inv.id },
        taskType: "follow_up",
        status: { in: ["pending", "in_progress"] },
      },
    });

    if (!existingTask) {
      await prisma.task.create({
        data: {
          companyId,
          title: `滞納督促: ${inv.tenant.name} (${inv.billingMonth})`,
          description: `請求ID: ${inv.id}\n金額: ¥${inv.totalAmount.toLocaleString()}\n期限: ${inv.dueDate.toISOString().split("T")[0]}`,
          taskType: "follow_up",
          priority: "high",
        },
      });
    }
  }

  return c.json({
    data: overdue,
    total: overdue.length,
    totalOverdueAmount: overdue.reduce((sum, inv) => sum + inv.totalAmount - (inv.paidAmount ?? 0), 0),
  });
});

export { rentRoutes };
