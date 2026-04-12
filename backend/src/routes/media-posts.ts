import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

/**
 * 媒体一括投稿 API
 *
 * 複数の不動産ポータル（SUUMO, アットホーム, LIFULL HOME'S 等）への
 * 一括投稿記録を管理する。
 *
 * POST /api/media-posts          - 投稿記録を一括作成
 * GET  /api/media-posts          - 投稿履歴一覧
 * GET  /api/media-posts/summary  - 物件ごとの媒体投稿状況
 */

const mediaPostRoutes = new Hono();

const PLATFORMS = ["suumo", "athome", "homes"] as const;

// ---------------------------------------------------------------
// POST /api/media-posts - 一括投稿記録作成
// ---------------------------------------------------------------

const createSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid(),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  useStaging: z.boolean().default(false),
});

mediaPostRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, propertyId, platforms, useStaging } = parsed.data;

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    return c.json({ error: { code: "NOT_FOUND", message: "物件が見つかりません" } }, 404);
  }
  if (property.companyId !== companyId) {
    return c.json({ error: { code: "FORBIDDEN" } }, 403);
  }

  const posts = await prisma.$transaction(
    platforms.map((platform) =>
      prisma.mediaPost.create({
        data: {
          companyId,
          propertyId,
          platform,
          status: "posted",
          useStaging,
          stagedImageUrls: [],
          postedAt: new Date(),
        },
      })
    )
  );

  return c.json({ data: posts }, 201);
});

// ---------------------------------------------------------------
// GET /api/media-posts - 投稿履歴一覧
// ---------------------------------------------------------------

const listSchema = z.object({
  companyId: z.string().uuid(),
  platform: z.enum(PLATFORMS).optional(),
  status: z.enum(["pending", "processing", "posted", "failed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

mediaPostRoutes.get("/", async (c) => {
  const query = listSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, platform, status, page, limit } = query.data;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = { companyId };
  if (platform) where.platform = platform;
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    prisma.mediaPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.mediaPost.count({ where }),
  ]);

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
// GET /api/media-posts/summary - 物件ごとの媒体投稿サマリー
// ---------------------------------------------------------------

mediaPostRoutes.get("/summary", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId is required" } }, 400);
  }

  const posts = await prisma.mediaPost.findMany({
    where: { companyId, status: "posted" },
    select: { propertyId: true, platform: true },
  });

  // propertyId -> Set<platform>
  const map: Record<string, string[]> = {};
  for (const p of posts) {
    if (!map[p.propertyId]) map[p.propertyId] = [];
    if (!map[p.propertyId].includes(p.platform)) {
      map[p.propertyId].push(p.platform);
    }
  }

  return c.json({ data: map });
});

export { mediaPostRoutes };
