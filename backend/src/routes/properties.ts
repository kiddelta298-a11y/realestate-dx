import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  recommendProperties,
  generateMatchReasonsText,
  updatePropertyEmbedding,
} from "../services/proposal-engine.js";
import {
  extractFromText,
  extractFromImage,
  extractFromUrl,
  type ExtractedProperty,
} from "../services/property-extractor.js";

const propertyRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createPropertySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  propertyType: z.enum(["apartment", "mansion", "house", "office"]),
  address: z.string().min(1).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  nearestStation: z.string().max(100).optional(),
  walkMinutes: z.number().int().min(0).optional(),
  rent: z.number().int().min(0),
  managementFee: z.number().int().min(0).default(0),
  deposit: z.number().int().min(0).default(0),
  keyMoney: z.number().int().min(0).default(0),
  roomLayout: z.string().max(20).optional(),
  floorArea: z.number().min(0).optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  builtYear: z.number().int().optional(),
  availableFrom: z.string().date().optional(),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  externalId: z.string().max(100).optional(),
});

const updatePropertySchema = createPropertySchema.partial().omit({ companyId: true });

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["available", "reserved", "contracted", "unavailable"]).optional(),
  minRent: z.coerce.number().int().min(0).optional(),
  maxRent: z.coerce.number().int().min(0).optional(),
  propertyType: z.string().optional(),
  nearestStation: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/properties - 物件一覧
// ---------------------------------------------------------------

propertyRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, minRent, maxRent, propertyType, nearestStation, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (propertyType) where.propertyType = propertyType;
  if (nearestStation) where.nearestStation = { contains: nearestStation };
  if (minRent !== undefined || maxRent !== undefined) {
    where.rent = {
      ...(minRent !== undefined ? { gte: minRent } : {}),
      ...(maxRent !== undefined ? { lte: maxRent } : {}),
    };
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { images: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.property.count({ where }),
  ]);

  return c.json({
    data: properties,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/properties/:id - 物件詳細
// ---------------------------------------------------------------

propertyRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      applications: { where: { status: { in: ["pending", "screening", "approved"] } } },
    },
  });

  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }

  return c.json({ data: property });
});

// ---------------------------------------------------------------
// POST /api/properties - 物件登録
// ---------------------------------------------------------------

propertyRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { availableFrom, features, ...rest } = parsed.data;

  const property = await prisma.property.create({
    data: {
      ...rest,
      features: JSON.parse(JSON.stringify(features)),
      availableFrom: availableFrom ? new Date(availableFrom) : undefined,
    },
  });

  // 非同期で embedding を生成（レスポンスはブロックしない）
  updatePropertyEmbedding(property.id).catch((err) =>
    console.error(`[embedding] Failed for property ${property.id}:`, err),
  );

  return c.json({ data: property }, 201);
});

// ---------------------------------------------------------------
// PUT /api/properties/:id - 物件更新
// ---------------------------------------------------------------

propertyRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }

  const { availableFrom, features, ...rest } = parsed.data;

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...rest,
      ...(features !== undefined ? { features: JSON.parse(JSON.stringify(features)) } : {}),
      ...(availableFrom !== undefined ? { availableFrom: new Date(availableFrom) } : {}),
    },
  });

  // 非同期で embedding を再生成
  updatePropertyEmbedding(property.id).catch((err) =>
    console.error(`[embedding] Failed for property ${property.id}:`, err),
  );

  return c.json({ data: property });
});

// ---------------------------------------------------------------
// DELETE /api/properties/:id - 物件削除
// ---------------------------------------------------------------

propertyRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }

  await prisma.property.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

// ---------------------------------------------------------------
// PATCH /api/properties/:id/status - 空室フラグ管理（ステータス変更）
// ---------------------------------------------------------------

const statusUpdateSchema = z.object({
  status: z.enum(["available", "reserved", "contracted", "unavailable"]),
});

propertyRoutes.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }

  const property = await prisma.property.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return c.json({ data: property });
});

// ---------------------------------------------------------------
// GET /api/properties/:id/alternatives - 代替物件提案
// ---------------------------------------------------------------

propertyRoutes.get("/:id/alternatives", async (c) => {
  const id = c.req.param("id");
  const limitParam = c.req.query("limit");
  const limit = Math.min(Number(limitParam) || 5, 20);

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }

  // 物件が available なら代替不要
  if (property.status === "available") {
    return c.json({
      data: { property, isAvailable: true, alternatives: [] },
    });
  }

  // 同一テナント内で類似条件の空室物件を検索
  const rentRange = Math.round(property.rent * 0.2); // ±20%
  const alternatives = await prisma.property.findMany({
    where: {
      companyId: property.companyId,
      status: "available",
      id: { not: property.id },
      rent: { gte: property.rent - rentRange, lte: property.rent + rentRange },
      ...(property.propertyType ? { propertyType: property.propertyType } : {}),
      ...(property.nearestStation ? { nearestStation: property.nearestStation } : {}),
    },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { rent: "asc" },
    take: limit,
  });

  // 駅一致がない場合、間取り一致で再検索
  if (alternatives.length === 0 && property.roomLayout) {
    const fallback = await prisma.property.findMany({
      where: {
        companyId: property.companyId,
        status: "available",
        id: { not: property.id },
        rent: { gte: property.rent - rentRange, lte: property.rent + rentRange },
        roomLayout: property.roomLayout,
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { rent: "asc" },
      take: limit,
    });
    return c.json({
      data: { property, isAvailable: false, alternatives: fallback },
    });
  }

  return c.json({
    data: { property, isAvailable: false, alternatives },
  });
});

// ---------------------------------------------------------------
// POST /api/properties/recommend - 高精度物件提案
// ---------------------------------------------------------------

const recommendSchema = z.object({
  customerId: z.string().uuid(),
  companyId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).default(5),
  boostedPropertyIds: z.array(z.string().uuid()).optional(),
  /** trueの場合、Claude APIでマッチ理由文も生成する */
  generateReasons: z.boolean().default(false),
});

propertyRoutes.post("/recommend", async (c) => {
  const body = await c.req.json();
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { customerId, companyId, limit, boostedPropertyIds, generateReasons } = parsed.data;

  // 顧客存在確認
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }
  if (customer.companyId !== companyId) {
    return c.json({ error: { code: "FORBIDDEN", message: "テナントが一致しません" } }, 403);
  }

  const recommendations = await recommendProperties({
    customerId,
    companyId,
    limit,
    boostedPropertyIds,
  });

  // オプション: Claude APIでマッチ理由文を生成
  if (generateReasons) {
    for (const rec of recommendations) {
      rec.matchReasons = [
        await generateMatchReasonsText(
          { name: rec.name, rent: rec.rent, address: rec.address, roomLayout: rec.roomLayout },
          rec.matchReasons,
          customer.name,
        ),
      ];
    }
  }

  // 提案履歴をDBに保存
  for (const rec of recommendations) {
    await prisma.propertyProposal.create({
      data: {
        companyId,
        customerId,
        propertyId: rec.propertyId,
        proposedBy: "ai",
        matchScore: rec.totalScore,
        matchReasons: rec.matchReasons,
      },
    });
  }

  return c.json({
    data: {
      customerId,
      recommendations,
      total: recommendations.length,
    },
  });
});

// ---------------------------------------------------------------
// POST /api/properties/extract - テキスト/画像から物件情報を自動抽出
// ---------------------------------------------------------------

const extractSchema = z.object({
  /** テキスト入力（チラシ文面等） */
  text: z.string().max(10000).optional(),
  /** 画像入力（base64） */
  imageBase64: z.string().optional(),
  /** 画像の MIME タイプ */
  imageMediaType: z
    .enum(["image/jpeg", "image/png", "image/gif", "image/webp"])
    .optional(),
});

propertyRoutes.post("/extract", async (c) => {
  const body = await c.req.json();
  const parsed = extractSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400,
    );
  }

  const { text, imageBase64, imageMediaType } = parsed.data;

  if (!text && !imageBase64) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "text または imageBase64 のいずれかを指定してください",
        },
      },
      400,
    );
  }

  // 画像優先（画像がある場合はOCR + 構造化抽出）
  if (imageBase64) {
    const mediaType = imageMediaType ?? "image/jpeg";
    const result = await extractFromImage(imageBase64, mediaType);
    return c.json({ data: result });
  }

  // テキストから抽出
  const result = await extractFromText(text!);
  return c.json({ data: result });
});

// ---------------------------------------------------------------
// POST /api/properties/import-url - URLから物件情報を自動抽出
// ---------------------------------------------------------------

const importUrlSchema = z.object({
  url: z.string().url(),
});

propertyRoutes.post("/import-url", async (c) => {
  const body = await c.req.json();
  const parsed = importUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400,
    );
  }

  const result = await extractFromUrl(parsed.data.url);
  return c.json({ data: result });
});

// ---------------------------------------------------------------
// POST /api/properties/confirm-import - 抽出データをDB登録
// ---------------------------------------------------------------

const confirmImportSchema = z.object({
  companyId: z.string().uuid(),
  /** 抽出された物件データ（ユーザーが修正済み） */
  property: z.object({
    name: z.string().min(1).max(255),
    propertyType: z.enum(["apartment", "mansion", "house", "office"]),
    address: z.string().min(1).max(500),
    nearestStation: z.string().max(100).nullable().optional(),
    walkMinutes: z.number().int().nullable().optional(),
    rent: z.number().int().min(0),
    managementFee: z.number().int().min(0).default(0),
    deposit: z.number().int().min(0).default(0),
    keyMoney: z.number().int().min(0).default(0),
    roomLayout: z.string().max(20).nullable().optional(),
    floorArea: z.number().nullable().optional(),
    floor: z.number().int().nullable().optional(),
    totalFloors: z.number().int().nullable().optional(),
    builtYear: z.number().int().nullable().optional(),
    availableFrom: z.string().nullable().optional(),
    features: z.array(z.string()).default([]),
    description: z.string().nullable().optional(),
    externalId: z.string().max(100).optional(),
  }),
  /** 抽出元の情報（監査用） */
  importSource: z
    .object({
      type: z.enum(["text", "image", "url"]),
      url: z.string().optional(),
      confidence: z.number().optional(),
    })
    .optional(),
});

propertyRoutes.post("/confirm-import", async (c) => {
  const body = await c.req.json();
  const parsed = confirmImportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400,
    );
  }

  const { companyId, property: propData, importSource } = parsed.data;

  // null → undefined に変換（Prisma 互換）
  // インポート元の情報を description に付記
  let description = propData.description ?? undefined;
  if (importSource) {
    const sourceNote = `[AI自動抽出: ${importSource.type}${importSource.url ? ` (${importSource.url})` : ""}, 信頼度: ${importSource.confidence ?? "N/A"}]`;
    description = description ? `${description}\n${sourceNote}` : sourceNote;
  }

  const created = await prisma.property.create({
    data: {
      companyId,
      name: propData.name,
      propertyType: propData.propertyType,
      address: propData.address,
      nearestStation: propData.nearestStation ?? undefined,
      walkMinutes: propData.walkMinutes ?? undefined,
      rent: propData.rent,
      managementFee: propData.managementFee,
      deposit: propData.deposit,
      keyMoney: propData.keyMoney,
      roomLayout: propData.roomLayout ?? undefined,
      floorArea: propData.floorArea ?? undefined,
      floor: propData.floor ?? undefined,
      totalFloors: propData.totalFloors ?? undefined,
      builtYear: propData.builtYear ?? undefined,
      availableFrom: propData.availableFrom
        ? new Date(propData.availableFrom)
        : undefined,
      features: propData.features,
      description,
      externalId: propData.externalId,
    },
  });

  // 非同期で embedding を生成
  updatePropertyEmbedding(created.id).catch((err) =>
    console.error(`[embedding] Failed for imported property ${created.id}:`, err),
  );

  return c.json({ data: created }, 201);
});

export { propertyRoutes };
