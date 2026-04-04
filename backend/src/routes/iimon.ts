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

export { iimonRoutes };
