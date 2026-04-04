import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const customerRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createCustomerSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  lineUserId: z.string().max(100).optional(),
  source: z.enum(["web", "suumo", "homes", "line", "walk_in"]).default("web"),
  assignedUserId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial().omit({ companyId: true }).extend({
  status: z.enum(["active", "contracted", "lost"]).optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["active", "contracted", "lost"]).optional(),
  assignedUserId: z.string().uuid().optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/customers - 顧客一覧
// ---------------------------------------------------------------

customerRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, assignedUserId, source, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (source) where.source = source;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { assignedUser: { select: { id: true, name: true } }, preferences: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return c.json({
    data: customers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/customers/:id - 顧客詳細
// ---------------------------------------------------------------

customerRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      preferences: true,
      applications: {
        include: { property: { select: { id: true, name: true, rent: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
      proposals: {
        include: { property: { select: { id: true, name: true, rent: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!customer) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }

  return c.json({ data: customer });
});

// ---------------------------------------------------------------
// POST /api/customers - 顧客登録
// ---------------------------------------------------------------

customerRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const customer = await prisma.customer.create({ data: parsed.data });
  return c.json({ data: customer }, 201);
});

// ---------------------------------------------------------------
// PUT /api/customers/:id - 顧客更新
// ---------------------------------------------------------------

customerRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }

  const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
  return c.json({ data: customer });
});

// ---------------------------------------------------------------
// DELETE /api/customers/:id - 顧客削除
// ---------------------------------------------------------------

customerRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }

  await prisma.customer.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

// ---------------------------------------------------------------
// POST /api/webhooks/inquiry - 問い合わせWebhook → 顧客自動登録
// ---------------------------------------------------------------

const webhookRoutes = new Hono();

const inquiryWebhookSchema = z.object({
  companyId: z.string().uuid(),
  source: z.enum(["web", "suumo", "homes", "line", "walk_in"]).default("web"),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  propertyId: z.string().uuid().optional(),
  message: z.string().optional(),
});

webhookRoutes.post("/inquiry", async (c) => {
  const body = await c.req.json();
  const parsed = inquiryWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, source, name, email, phone, propertyId, message } = parsed.data;

  // 既存顧客チェック（同一テナント内でメールまたは電話番号が一致）
  let customer = null;
  if (email) {
    customer = await prisma.customer.findFirst({
      where: { companyId, email },
    });
  }
  if (!customer && phone) {
    customer = await prisma.customer.findFirst({
      where: { companyId, phone },
    });
  }

  const isNewCustomer = !customer;

  if (!customer) {
    // 新規顧客登録
    customer = await prisma.customer.create({
      data: {
        companyId,
        name,
        email,
        phone,
        source,
        notes: message ? `【問い合わせ】${message}` : undefined,
      },
    });
  } else {
    // 既存顧客の備考を更新
    if (message) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          notes: customer.notes
            ? `${customer.notes}\n【問い合わせ】${message}`
            : `【問い合わせ】${message}`,
        },
      });
    }
  }

  // 物件指定がある場合、フォローアップタスクを自動生成
  if (propertyId && customer.assignedUserId) {
    await prisma.task.create({
      data: {
        companyId,
        assignedUserId: customer.assignedUserId,
        customerId: customer.id,
        title: `問い合わせ対応: ${name}`,
        description: message ?? "Webhookからの問い合わせ",
        taskType: "follow_up",
        priority: "high",
      },
    });
  }

  return c.json({
    data: {
      customerId: customer.id,
      isNewCustomer,
      message: isNewCustomer ? "新規顧客として登録しました" : "既存顧客の情報を更新しました",
    },
  }, isNewCustomer ? 201 : 200);
});

export { customerRoutes, webhookRoutes };
