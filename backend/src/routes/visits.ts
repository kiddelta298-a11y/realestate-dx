import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const visitRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  visitDate: z.string().date(),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.enum(["inquiry", "viewing", "contract", "consultation", "other"]),
  channel: z.enum(["walk_in", "appointment", "referral"]).default("walk_in"),
  result: z.enum(["interested", "application", "contracted", "not_interested", "follow_up"]).optional(),
  propertyIds: z.array(z.string().uuid()).default([]),
  duration: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  assignedUserId: z.string().uuid().optional(),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.enum(["inquiry", "viewing", "contract", "consultation", "other"]).optional(),
  channel: z.enum(["walk_in", "appointment", "referral"]).optional(),
  result: z.enum(["interested", "application", "contracted", "not_interested", "follow_up"]).optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
  duration: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  purpose: z.enum(["inquiry", "viewing", "contract", "consultation", "other"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const statsQuerySchema = z.object({
  companyId: z.string().uuid(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

// ---------------------------------------------------------------
// GET /api/visits
// ---------------------------------------------------------------

visitRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, customerId, assignedUserId, purpose, dateFrom, dateTo, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (purpose) where.purpose = purpose;
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    where.visitDate = dateFilter;
  }

  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      orderBy: { visitDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.visit.count({ where }),
  ]);

  return c.json({
    data: visits,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/visits/stats
// ---------------------------------------------------------------

visitRoutes.get("/stats", async (c) => {
  const query = statsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, dateFrom, dateTo } = query.data;

  const where: Record<string, unknown> = { companyId };
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    where.visitDate = dateFilter;
  }

  const visits = await prisma.visit.findMany({ where });

  const totalVisits = visits.length;
  const byPurpose: Record<string, number> = {};
  const byResult: Record<string, number> = {};
  const byChannel: Record<string, number> = {};

  for (const v of visits) {
    byPurpose[v.purpose] = (byPurpose[v.purpose] ?? 0) + 1;
    if (v.result) byResult[v.result] = (byResult[v.result] ?? 0) + 1;
    byChannel[v.channel] = (byChannel[v.channel] ?? 0) + 1;
  }

  const applicationCount = byResult["application"] ?? 0;
  const contractedCount = byResult["contracted"] ?? 0;
  const conversionRate = totalVisits > 0 ? (applicationCount + contractedCount) / totalVisits : 0;
  const contractRate = totalVisits > 0 ? contractedCount / totalVisits : 0;

  return c.json({
    data: {
      totalVisits,
      conversionRate: Math.round(conversionRate * 10000) / 100,
      contractRate: Math.round(contractRate * 10000) / 100,
      byPurpose,
      byResult,
      byChannel,
    },
  });
});

// ---------------------------------------------------------------
// GET /api/visits/:id
// ---------------------------------------------------------------

visitRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const visit = await prisma.visit.findUnique({ where: { id } });

  if (!visit) {
    return c.json({ error: { code: "NOT_FOUND", message: "来店記録が見つかりません" } }, 404);
  }

  return c.json({ data: visit });
});

// ---------------------------------------------------------------
// POST /api/visits
// ---------------------------------------------------------------

visitRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { visitDate, ...rest } = parsed.data;
  const visit = await prisma.visit.create({
    data: {
      ...rest,
      visitDate: new Date(visitDate),
    },
  });

  return c.json({ data: visit }, 201);
});

// ---------------------------------------------------------------
// PUT /api/visits/:id
// ---------------------------------------------------------------

visitRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.visit.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "来店記録が見つかりません" } }, 404);
  }

  const visit = await prisma.visit.update({ where: { id }, data: parsed.data });
  return c.json({ data: visit });
});

// ---------------------------------------------------------------
// DELETE /api/visits/:id
// ---------------------------------------------------------------

visitRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.visit.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "来店記録が見つかりません" } }, 404);
  }
  await prisma.visit.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

export { visitRoutes };
