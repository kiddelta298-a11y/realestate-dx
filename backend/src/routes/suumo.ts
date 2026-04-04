import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { applyVirtualStaging, applyBatchStaging } from "../services/virtual-staging.js";

/**
 * SUUMO自動投稿 API
 *
 * ブラウザ拡張機能のコンテンツスクリプトから呼ばれる。
 * 拡張機能がSUUMOフォームに自動入力し、このAPIで投稿記録を管理する。
 *
 * POST /api/suumo/posts            - 投稿記録を作成
 * GET  /api/suumo/posts            - 投稿履歴一覧
 * GET  /api/suumo/posts/:id        - 投稿詳細
 * POST /api/suumo/staging/preview  - AIバーチャルステージングプレビュー
 * POST /api/suumo/staging/batch    - 複数画像の一括ステージング
 */

const suumoRoutes = new Hono();

// ---------------------------------------------------------------
// POST /api/suumo/posts - 投稿記録作成（拡張機能からの通知）
// ---------------------------------------------------------------

const createPostSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid(),
  suumoPropertyId: z.string().optional(),
  useStaging: z.boolean().default(false),
  status: z.enum(["posted", "failed", "pending"]).default("posted"),
  errorMessage: z.string().optional(),
});

suumoRoutes.post("/posts", async (c) => {
  const body = await c.req.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, propertyId, suumoPropertyId, useStaging, status, errorMessage } = parsed.data;

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }
  if (property.companyId !== companyId) {
    return c.json({ error: { code: "FORBIDDEN" } }, 403);
  }

  const post = await prisma.suumoPost.create({
    data: {
      companyId,
      propertyId,
      status,
      suumoPropertyId: suumoPropertyId ?? null,
      useStaging,
      stagedImageUrls: [],
      errorMessage: errorMessage ?? null,
      postedAt: status === "posted" ? new Date() : null,
    },
  });

  return c.json({ data: post }, 201);
});

// ---------------------------------------------------------------
// GET /api/suumo/posts - 投稿履歴一覧
// ---------------------------------------------------------------

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(["pending", "processing", "posted", "failed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

suumoRoutes.get("/posts", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, status, page, limit } = query.data;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    prisma.suumoPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.suumoPost.count({ where }),
  ]);

  // 物件名を補完
  const propertyIds = [...new Set(posts.map((p) => p.propertyId))];
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, name: true, address: true, rent: true, roomLayout: true },
  });
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));

  return c.json({
    data: posts.map((p) => ({ ...p, property: propMap[p.propertyId] ?? null })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/suumo/posts/:id - 投稿詳細
// ---------------------------------------------------------------

suumoRoutes.get("/posts/:id", async (c) => {
  const post = await prisma.suumoPost.findUnique({ where: { id: c.req.param("id") } });
  if (!post) return c.json({ error: { code: "NOT_FOUND" } }, 404);

  const property = await prisma.property.findUnique({
    where: { id: post.propertyId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  return c.json({ data: { ...post, property } });
});

// ---------------------------------------------------------------
// POST /api/suumo/staging/preview - AIバーチャルステージングプレビュー
// ---------------------------------------------------------------

const stagingPreviewSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid(),
  imageIndex: z.number().int().min(0).default(0),
});

suumoRoutes.post("/staging/preview", async (c) => {
  const body = await c.req.json();
  const parsed = stagingPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, propertyId, imageIndex } = parsed.data;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property) return c.json({ error: { code: "NOT_FOUND" } }, 404);
  if (property.companyId !== companyId) return c.json({ error: { code: "FORBIDDEN" } }, 403);
  if (property.images.length === 0) {
    return c.json({ error: { code: "NO_IMAGES", message: "物件画像が登録されていません" } }, 400);
  }

  const targetImage = property.images[imageIndex] ?? property.images[0];
  const result = await applyVirtualStaging(targetImage.url, property.roomLayout);
  return c.json({ data: result });
});

// ---------------------------------------------------------------
// POST /api/suumo/staging/batch - 複数画像の一括ステージング
// ---------------------------------------------------------------

const stagingBatchSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid(),
  maxImages: z.number().int().min(1).max(5).default(3),
});

suumoRoutes.post("/staging/batch", async (c) => {
  const body = await c.req.json();
  const parsed = stagingBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, propertyId, maxImages } = parsed.data;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property) return c.json({ error: { code: "NOT_FOUND" } }, 404);
  if (property.companyId !== companyId) return c.json({ error: { code: "FORBIDDEN" } }, 403);

  const imageUrls = property.images.map((img) => img.url);
  const results = await applyBatchStaging(imageUrls, property.roomLayout, maxImages);
  return c.json({ data: { propertyId, results } });
});

export { suumoRoutes };
