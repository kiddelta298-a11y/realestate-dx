import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

/**
 * iimon（いい物件速いもん）連携 API
 *
 * ブラウザ拡張機能のコンテンツスクリプトから呼ばれる。
 * 拡張機能がiimonページから物件情報を抽出し、このAPIでDBに保存する。
 *
 * GET  /api/iimon/syncs        - 同期履歴一覧
 * GET  /api/iimon/status       - 最新の連携状況
 * POST /api/iimon/record-import - 取込件数を履歴に記録
 */

const iimonRoutes = new Hono();

const companyIdSchema = z.object({
  companyId: z.string().uuid(),
});

// ---------------------------------------------------------------
// GET /api/iimon/status - 連携状況サマリー
// ---------------------------------------------------------------

iimonRoutes.get("/status", async (c) => {
  const query = companyIdSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId } = query.data;

  const [latestSync, iimonPropertyCount] = await Promise.all([
    prisma.iimonSync.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.count({
      where: { companyId, externalId: { startsWith: "iimon_" } },
    }),
  ]);

  return c.json({
    data: {
      latestSync,
      iimonPropertyCount,
    },
  });
});

// ---------------------------------------------------------------
// GET /api/iimon/syncs - 同期履歴
// ---------------------------------------------------------------

iimonRoutes.get("/syncs", async (c) => {
  const query = companyIdSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const syncs = await prisma.iimonSync.findMany({
    where: { companyId: query.data.companyId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return c.json({ data: syncs });
});

// ---------------------------------------------------------------
// POST /api/iimon/record-import - 拡張機能からの取込記録
// ---------------------------------------------------------------

const recordImportSchema = z.object({
  companyId: z.string().uuid(),
  newCount: z.number().int().min(0).default(0),
  updatedCount: z.number().int().min(0).default(0),
  errorMessage: z.string().optional(),
});

iimonRoutes.post("/record-import", async (c) => {
  const body = await c.req.json();
  const parsed = recordImportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, newCount, updatedCount, errorMessage } = parsed.data;

  const sync = await prisma.iimonSync.create({
    data: {
      companyId,
      status: errorMessage ? "failed" : "completed",
      newCount,
      updatedCount,
      errorMessage: errorMessage ?? null,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return c.json({ data: sync }, 201);
});

// ---------------------------------------------------------------
// POST /api/iimon/import - Chrome拡張から物件データを一括取込
// ---------------------------------------------------------------

const propertyImportSchema = z.object({
  name: z.string().min(1),
  address: z.string().default(""),
  rent: z.number().int().min(0).default(0),
  roomLayout: z.string().nullable().optional(),
  floorArea: z.number().nullable().optional(),
  deposit: z.number().int().min(0).default(0),
  keyMoney: z.number().int().min(0).default(0),
  builtYear: z.number().int().nullable().optional(),
  nearestStation: z.string().nullable().optional(),
  walkMinutes: z.number().int().nullable().optional(),
  floor: z.number().int().nullable().optional(),
  photoCount: z.number().int().nullable().optional(),
  listingCompany: z.string().nullable().optional(),
  adFee: z.string().nullable().optional(),
  externalUrl: z.string().nullable().optional(),
  rawText: z.string().optional(),
});

const importBatchSchema = z.object({
  companyId: z.string().uuid(),
  properties: z.array(propertyImportSchema).min(1).max(200),
});

iimonRoutes.post("/import", async (c) => {
  const body = await c.req.json();
  const parsed = importBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, properties } = parsed.data;

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const prop of properties) {
    // externalId を物件名+住所+賃料から生成（重複判定キー）
    const externalId = `iimon_${Buffer.from(`${prop.name}|${prop.address}|${prop.rent}`).toString("base64url").substring(0, 80)}`;

    const existing = await prisma.property.findFirst({
      where: { companyId, externalId },
    });

    if (existing) {
      // 賃料・敷金・礼金に変更があれば更新
      const changed =
        existing.rent !== prop.rent ||
        existing.deposit !== prop.deposit ||
        existing.keyMoney !== prop.keyMoney;

      if (changed) {
        await prisma.property.update({
          where: { id: existing.id },
          data: {
            rent: prop.rent,
            deposit: prop.deposit,
            keyMoney: prop.keyMoney,
            description: prop.rawText ?? existing.description,
          },
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      // 新規作成
      await prisma.property.create({
        data: {
          companyId,
          externalId,
          name: prop.name,
          propertyType: "apartment",
          address: prop.address || "住所不明",
          nearestStation: prop.nearestStation ?? null,
          walkMinutes: prop.walkMinutes ?? null,
          rent: prop.rent,
          managementFee: 0,
          deposit: prop.deposit,
          keyMoney: prop.keyMoney,
          roomLayout: prop.roomLayout ?? null,
          floorArea: prop.floorArea ?? null,
          floor: prop.floor ?? null,
          builtYear: prop.builtYear ?? null,
          features: [],
          description: prop.rawText ?? null,
          status: "available",
        },
      });
      newCount++;
    }
  }

  // 同期履歴を記録
  await prisma.iimonSync.create({
    data: {
      companyId,
      status: "completed",
      newCount,
      updatedCount,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return c.json({
    data: {
      newCount,
      updatedCount,
      skippedCount,
      totalProcessed: properties.length,
    },
  }, 201);
});

export { iimonRoutes };
