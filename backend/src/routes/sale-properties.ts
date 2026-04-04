import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const salePropertyRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createSchema = z.object({
  companyId: z.string().uuid(),
  externalId: z.string().max(100).optional(),
  name: z.string().min(1).max(255),
  propertyType: z.enum(["house", "land", "mansion", "apartment_unit", "commercial"]),
  address: z.string().min(1).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  nearestStation: z.string().max(100).optional(),
  walkMinutes: z.number().int().min(0).optional(),
  price: z.number().int().min(0),
  landArea: z.number().min(0).optional(),
  buildingArea: z.number().min(0).optional(),
  builtYear: z.number().int().optional(),
  structure: z.string().max(50).optional(),
  floors: z.number().int().min(0).optional(),
  roomLayout: z.string().max(20).optional(),
  landRights: z.enum(["ownership", "leasehold"]).default("ownership"),
  zoning: z.string().max(100).optional(),
  buildingRatio: z.number().min(0).max(100).optional(),
  floorAreaRatio: z.number().min(0).max(1000).optional(),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  sellerCustomerId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  propertyType: z.enum(["house", "land", "mansion", "apartment_unit", "commercial"]).optional(),
  address: z.string().min(1).max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  nearestStation: z.string().max(100).optional(),
  walkMinutes: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  landArea: z.number().min(0).optional(),
  buildingArea: z.number().min(0).optional(),
  builtYear: z.number().int().optional(),
  structure: z.string().max(50).optional(),
  floors: z.number().int().min(0).optional(),
  roomLayout: z.string().max(20).optional(),
  landRights: z.enum(["ownership", "leasehold"]).optional(),
  zoning: z.string().max(100).optional(),
  buildingRatio: z.number().min(0).max(100).optional(),
  floorAreaRatio: z.number().min(0).max(1000).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.enum(["for_sale", "negotiating", "sold", "withdrawn"]).optional(),
  sellerCustomerId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["for_sale", "negotiating", "sold", "withdrawn"]).optional(),
  propertyType: z.enum(["house", "land", "mansion", "apartment_unit", "commercial"]).optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/sale-properties
// ---------------------------------------------------------------

salePropertyRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, propertyType, priceMin, priceMax, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (propertyType) where.propertyType = propertyType;
  if (priceMin !== undefined || priceMax !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (priceMin !== undefined) priceFilter.gte = priceMin;
    if (priceMax !== undefined) priceFilter.lte = priceMax;
    where.price = priceFilter;
  }

  const [properties, total] = await Promise.all([
    prisma.saleProperty.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.saleProperty.count({ where }),
  ]);

  return c.json({
    data: properties,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/sale-properties/:id
// ---------------------------------------------------------------

salePropertyRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const property = await prisma.saleProperty.findUnique({
    where: { id },
    include: {
      saleCases: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買物件が見つかりません" } }, 404);
  }

  return c.json({ data: property });
});

// ---------------------------------------------------------------
// POST /api/sale-properties
// ---------------------------------------------------------------

salePropertyRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const property = await prisma.saleProperty.create({ data: parsed.data });
  return c.json({ data: property }, 201);
});

// ---------------------------------------------------------------
// PUT /api/sale-properties/:id
// ---------------------------------------------------------------

salePropertyRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.saleProperty.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買物件が見つかりません" } }, 404);
  }

  const property = await prisma.saleProperty.update({ where: { id }, data: parsed.data });
  return c.json({ data: property });
});

// ---------------------------------------------------------------
// DELETE /api/sale-properties/:id
// ---------------------------------------------------------------

salePropertyRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.saleProperty.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "売買物件が見つかりません" } }, 404);
  }
  await prisma.saleProperty.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

export { salePropertyRoutes };
