import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const renewalRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createRenewalSchema = z.object({
  companyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  newEndDate: z.string().date().optional(),
  newRentAmount: z.number().int().min(0).optional(),
  renewalFee: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "notified", "accepted", "rejected", "completed"]),
  newEndDate: z.string().date().optional(),
  newRentAmount: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------
// POST /api/renewals - 更新手続き作成
// ---------------------------------------------------------------

renewalRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createRenewalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, tenantId, newEndDate, ...rest } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }

  const renewal = await prisma.renewal.create({
    data: {
      companyId,
      tenantId,
      currentEndDate: tenant.leaseEndDate,
      newEndDate: newEndDate ? new Date(newEndDate) : undefined,
      ...rest,
    },
    include: { tenant: { select: { id: true, name: true } } },
  });

  return c.json({ data: renewal }, 201);
});

// ---------------------------------------------------------------
// GET /api/renewals - 更新一覧
// ---------------------------------------------------------------

renewalRoutes.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const status = c.req.query("status");

  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const renewals = await prisma.renewal.findMany({
    where,
    include: { tenant: { select: { id: true, name: true, propertyId: true, leaseEndDate: true } } },
    orderBy: { currentEndDate: "asc" },
  });

  return c.json({ data: renewals });
});

// ---------------------------------------------------------------
// PUT /api/renewals/:id/status - ステータス更新
// ---------------------------------------------------------------

renewalRoutes.put("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.renewal.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "更新レコードが見つかりません" } }, 404);
  }

  const { status, newEndDate, newRentAmount, notes } = parsed.data;

  const renewal = await prisma.$transaction(async (tx) => {
    const updated = await tx.renewal.update({
      where: { id },
      data: {
        status,
        ...(status === "notified" ? { notifiedAt: new Date() } : {}),
        ...(["accepted", "rejected"].includes(status) ? { respondedAt: new Date() } : {}),
        ...(newEndDate ? { newEndDate: new Date(newEndDate) } : {}),
        ...(newRentAmount !== undefined ? { newRentAmount } : {}),
        ...(notes ? { notes } : {}),
      },
    });

    // accepted → テナントの契約期間を延長
    if (status === "completed" && updated.newEndDate) {
      await tx.tenant.update({
        where: { id: existing.tenantId },
        data: {
          leaseEndDate: updated.newEndDate,
          ...(updated.newRentAmount ? { rentAmount: updated.newRentAmount } : {}),
        },
      });
    }

    return updated;
  });

  return c.json({ data: renewal });
});

// ---------------------------------------------------------------
// GET /api/renewals/upcoming - 満了90日前の自動通知対象
// ---------------------------------------------------------------

renewalRoutes.get("/upcoming", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const today = new Date();
  const ninetyDaysLater = new Date(today);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

  // 満了90日以内で、まだ更新手続きが開始されていないテナント
  const tenants = await prisma.tenant.findMany({
    where: {
      companyId,
      status: "active",
      leaseEndDate: { lte: ninetyDaysLater, gte: today },
    },
    orderBy: { leaseEndDate: "asc" },
  });

  // 既に更新手続き中のテナントを除外
  const existingRenewals = await prisma.renewal.findMany({
    where: {
      companyId,
      tenantId: { in: tenants.map((t) => t.id) },
      status: { notIn: ["rejected", "completed"] },
    },
    select: { tenantId: true },
  });
  const renewalTenantIds = new Set(existingRenewals.map((r) => r.tenantId));

  const needsNotification = tenants.filter((t) => !renewalTenantIds.has(t.id));

  return c.json({
    data: needsNotification,
    total: needsNotification.length,
  });
});

export { renewalRoutes };
