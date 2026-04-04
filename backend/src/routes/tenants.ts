import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const tenantRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  relation: z.string().optional(),
  address: z.string().optional(),
});

const createTenantSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  contractId: z.string().uuid(),
  propertyId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  emergencyContact: contactSchema.optional(),
  guarantorInfo: contactSchema.optional(),
  leaseStartDate: z.string().date(),
  leaseEndDate: z.string().date(),
  rentAmount: z.number().int().min(0),
  managementFee: z.number().int().min(0).default(0),
  moveInDate: z.string().date().optional(),
  notes: z.string().optional(),
});

const updateTenantSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  emergencyContact: contactSchema.optional(),
  guarantorInfo: contactSchema.optional(),
  status: z.enum(["active", "notice_given", "vacated"]).optional(),
  notes: z.string().optional(),
});

const convertFromApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  leaseStartDate: z.string().date(),
  leaseEndDate: z.string().date(),
  emergencyContact: contactSchema.optional(),
  guarantorInfo: contactSchema.optional(),
  moveInDate: z.string().date().optional(),
  notes: z.string().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["active", "notice_given", "vacated"]).optional(),
  propertyId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/tenants
// ---------------------------------------------------------------

tenantRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, propertyId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (propertyId) where.propertyId = propertyId;

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return c.json({
    data: tenants,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/tenants/:id
// ---------------------------------------------------------------

tenantRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { billingMonth: "desc" }, take: 12 },
      renewals: { orderBy: { createdAt: "desc" } },
      vacations: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }

  return c.json({ data: tenant });
});

// ---------------------------------------------------------------
// POST /api/tenants
// ---------------------------------------------------------------

tenantRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { leaseStartDate, leaseEndDate, moveInDate, ...rest } = parsed.data;

  const tenant = await prisma.tenant.create({
    data: {
      ...rest,
      leaseStartDate: new Date(leaseStartDate),
      leaseEndDate: new Date(leaseEndDate),
      moveInDate: moveInDate ? new Date(moveInDate) : undefined,
    },
  });

  return c.json({ data: tenant }, 201);
});

// ---------------------------------------------------------------
// POST /api/tenants/convert - 申込から入居者へ変換
// ---------------------------------------------------------------

tenantRoutes.post("/convert", async (c) => {
  const body = await c.req.json();
  const parsed = convertFromApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { applicationId, leaseStartDate, leaseEndDate, moveInDate, ...extra } = parsed.data;

  // 申込 + 契約情報を取得
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      customer: true,
      property: true,
      contracts: { where: { status: "signed" }, take: 1 },
    },
  });

  if (!application) {
    return c.json({ error: { code: "NOT_FOUND", message: "申込が見つかりません" } }, 404);
  }
  if (application.status !== "approved") {
    return c.json({ error: { code: "INVALID_STATE", message: "承認済みの申込のみ変換可能です" } }, 400);
  }

  const contract = application.contracts[0];
  if (!contract) {
    return c.json({ error: { code: "NO_CONTRACT", message: "署名済み契約がありません" } }, 400);
  }

  const tenant = await prisma.tenant.create({
    data: {
      companyId: application.companyId,
      customerId: application.customerId,
      contractId: contract.id,
      propertyId: application.propertyId,
      applicationId,
      name: application.customer.name,
      email: application.customer.email,
      phone: application.customer.phone,
      rentAmount: contract.rentAmount,
      managementFee: application.property.managementFee,
      leaseStartDate: new Date(leaseStartDate),
      leaseEndDate: new Date(leaseEndDate),
      moveInDate: moveInDate ? new Date(moveInDate) : new Date(leaseStartDate),
      ...extra,
    },
  });

  return c.json({ data: tenant }, 201);
});

// ---------------------------------------------------------------
// PUT /api/tenants/:id
// ---------------------------------------------------------------

tenantRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }

  const tenant = await prisma.tenant.update({ where: { id }, data: parsed.data });
  return c.json({ data: tenant });
});

// ---------------------------------------------------------------
// DELETE /api/tenants/:id
// ---------------------------------------------------------------

tenantRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "入居者が見つかりません" } }, 404);
  }
  await prisma.tenant.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

export { tenantRoutes };
