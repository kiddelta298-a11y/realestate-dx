import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const saleCaseRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createSchema = z.object({
  companyId: z.string().uuid(),
  salePropertyId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  caseType: z.enum(["purchase", "sell"]),
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),
  desiredArea: z.string().max(255).optional(),
  desiredConditions: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  salePropertyId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),
  desiredArea: z.string().max(255).optional(),
  desiredConditions: z.record(z.string(), z.unknown()).optional(),
  offerPrice: z.number().int().min(0).optional(),
  agreedPrice: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const statusTransitionSchema = z.object({
  status: z.enum(["inquiry", "viewing", "negotiating", "contracted", "cancelled"]),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  inquiry: ["viewing", "cancelled"],
  viewing: ["negotiating", "cancelled"],
  negotiating: ["contracted", "cancelled"],
  contracted: [],
  cancelled: [],
};

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["inquiry", "viewing", "negotiating", "contracted", "cancelled"]).optional(),
  caseType: z.enum(["purchase", "sell"]).optional(),
  assignedUserId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/sale-cases
// ---------------------------------------------------------------

saleCaseRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, caseType, assignedUserId, customerId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (caseType) where.caseType = caseType;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (customerId) where.customerId = customerId;

  const [cases, total] = await Promise.all([
    prisma.saleCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { saleProperty: true },
    }),
    prisma.saleCase.count({ where }),
  ]);

  return c.json({
    data: cases,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/sale-cases/:id
// ---------------------------------------------------------------

saleCaseRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const saleCase = await prisma.saleCase.findUnique({
    where: { id },
    include: { saleProperty: true },
  });

  if (!saleCase) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買案件が見つかりません" } }, 404);
  }

  return c.json({ data: saleCase });
});

// ---------------------------------------------------------------
// POST /api/sale-cases
// ---------------------------------------------------------------

saleCaseRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const saleCase = await prisma.saleCase.create({
    data: parsed.data as any,
  });
  return c.json({ data: saleCase }, 201);
});

// ---------------------------------------------------------------
// PUT /api/sale-cases/:id
// ---------------------------------------------------------------

saleCaseRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.saleCase.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買案件が見つかりません" } }, 404);
  }

  const saleCase = await prisma.saleCase.update({
    where: { id },
    data: parsed.data as any,
  });
  return c.json({ data: saleCase });
});

// ---------------------------------------------------------------
// PUT /api/sale-cases/:id/status
// ---------------------------------------------------------------

saleCaseRoutes.put("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = statusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.saleCase.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買案件が見つかりません" } }, 404);
  }

  const allowed = VALID_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return c.json({
      error: {
        code: "INVALID_TRANSITION",
        message: `${existing.status} → ${parsed.data.status} への遷移は許可されていません`,
        allowedTransitions: allowed,
      },
    }, 400);
  }

  const updateData: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "contracted") {
    updateData.contractedAt = new Date();
  }

  const saleCase = await prisma.saleCase.update({ where: { id }, data: updateData });
  return c.json({ data: saleCase });
});

export { saleCaseRoutes };
