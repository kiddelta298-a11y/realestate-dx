import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 来店率分析エンジン API
 *
 * Viewing (内見) / Application (申込) / Contract (成約) のデータを
 * 集計・分析し、コンバージョン率やファネルを返す。
 */

const analyticsRoutes = new Hono();
const anthropic = new Anthropic();

// ---------------------------------------------------------------
// 共通パラメータ
// ---------------------------------------------------------------

const periodSchema = z.object({
  companyId: z.string().uuid(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  userId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------
// GET /api/analytics/visit-rate - 来店率（期間別・担当者別・物件別）
// ---------------------------------------------------------------

analyticsRoutes.get("/visit-rate", async (c) => {
  const query = periodSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, dateFrom, dateTo, userId } = query.data;

  // 内見予約の集計
  const viewingWhere: Record<string, unknown> = { companyId };
  if (userId) viewingWhere.slot = { userId };
  if (dateFrom || dateTo) {
    viewingWhere.slot = {
      ...(viewingWhere.slot as Record<string, unknown> ?? {}),
      date: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      },
    };
  }

  const [totalViewings, completedViewings, cancelledViewings, noShowViewings] =
    await Promise.all([
      prisma.viewing.count({ where: viewingWhere }),
      prisma.viewing.count({ where: { ...viewingWhere, status: "completed" } }),
      prisma.viewing.count({ where: { ...viewingWhere, status: "cancelled" } }),
      prisma.viewing.count({ where: { ...viewingWhere, status: "no_show" } }),
    ]);

  const visitRate =
    totalViewings > 0 ? completedViewings / totalViewings : 0;
  const cancelRate =
    totalViewings > 0 ? cancelledViewings / totalViewings : 0;
  const noShowRate =
    totalViewings > 0 ? noShowViewings / totalViewings : 0;

  // 担当者別の来店率
  const byUser = await prisma.$queryRawUnsafe<
    { user_id: string; user_name: string; total: bigint; completed: bigint }[]
  >(
    `SELECT vs.user_id, u.name as user_name,
            COUNT(v.id) as total,
            COUNT(v.id) FILTER (WHERE v.status = 'completed') as completed
     FROM viewings v
     JOIN viewing_slots vs ON v.slot_id = vs.id
     JOIN users u ON vs.user_id = u.id
     WHERE v.company_id = $1
     ${dateFrom ? `AND vs.date >= '${dateFrom}'` : ""}
     ${dateTo ? `AND vs.date <= '${dateTo}'` : ""}
     GROUP BY vs.user_id, u.name
     ORDER BY completed DESC`,
    companyId,
  );

  // 物件別の来店数
  const byProperty = await prisma.$queryRawUnsafe<
    { property_id: string; property_name: string; total: bigint; completed: bigint }[]
  >(
    `SELECT v.property_id, p.name as property_name,
            COUNT(v.id) as total,
            COUNT(v.id) FILTER (WHERE v.status = 'completed') as completed
     FROM viewings v
     JOIN properties p ON v.property_id = p.id
     WHERE v.company_id = $1
     ${dateFrom ? `AND EXISTS (SELECT 1 FROM viewing_slots vs WHERE vs.id = v.slot_id AND vs.date >= '${dateFrom}')` : ""}
     ${dateTo ? `AND EXISTS (SELECT 1 FROM viewing_slots vs WHERE vs.id = v.slot_id AND vs.date <= '${dateTo}')` : ""}
     GROUP BY v.property_id, p.name
     ORDER BY total DESC
     LIMIT 20`,
    companyId,
  );

  return c.json({
    data: {
      summary: {
        totalViewings,
        completedViewings,
        cancelledViewings,
        noShowViewings,
        visitRate: round4(visitRate),
        cancelRate: round4(cancelRate),
        noShowRate: round4(noShowRate),
      },
      byUser: byUser.map((r) => ({
        userId: r.user_id,
        userName: r.user_name,
        total: Number(r.total),
        completed: Number(r.completed),
        visitRate: Number(r.total) > 0 ? round4(Number(r.completed) / Number(r.total)) : 0,
      })),
      byProperty: byProperty.map((r) => ({
        propertyId: r.property_id,
        propertyName: r.property_name,
        total: Number(r.total),
        completed: Number(r.completed),
        visitRate: Number(r.total) > 0 ? round4(Number(r.completed) / Number(r.total)) : 0,
      })),
    },
  });
});

// ---------------------------------------------------------------
// GET /api/analytics/conversion - 来店→申込→成約のコンバージョン率
// ---------------------------------------------------------------

analyticsRoutes.get("/conversion", async (c) => {
  const query = periodSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, dateFrom, dateTo } = query.data;

  const dateFilter = {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
  const hasDateFilter = dateFrom || dateTo;

  // 来店完了数
  const completedViewings = await prisma.viewing.count({
    where: {
      companyId,
      status: "completed",
      ...(hasDateFilter
        ? { slot: { date: dateFilter } }
        : {}),
    },
  });

  // 申込数
  const applications = await prisma.application.count({
    where: {
      companyId,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    },
  });

  // 承認済み申込
  const approvedApplications = await prisma.application.count({
    where: {
      companyId,
      status: "approved",
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    },
  });

  // 成約（契約）数
  const contracts = await prisma.contract.count({
    where: {
      companyId,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    },
  });

  // コンバージョン率
  const viewingToApplication =
    completedViewings > 0 ? applications / completedViewings : 0;
  const applicationToApproval =
    applications > 0 ? approvedApplications / applications : 0;
  const approvalToContract =
    approvedApplications > 0 ? contracts / approvedApplications : 0;
  const overallConversion =
    completedViewings > 0 ? contracts / completedViewings : 0;

  return c.json({
    data: {
      counts: {
        completedViewings,
        applications,
        approvedApplications,
        contracts,
      },
      conversionRates: {
        viewingToApplication: round4(viewingToApplication),
        applicationToApproval: round4(applicationToApproval),
        approvalToContract: round4(approvalToContract),
        overallConversion: round4(overallConversion),
      },
    },
  });
});

// ---------------------------------------------------------------
// GET /api/analytics/funnel - 反響→来店→申込→成約のファネル分析
// ---------------------------------------------------------------

analyticsRoutes.get("/funnel", async (c) => {
  const query = periodSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, dateFrom, dateTo } = query.data;

  const dateFilter = {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
  const hasDateFilter = dateFrom || dateTo;

  // ファネル各段階のカウント
  const [
    inquiries,       // 反響（新規顧客数）
    viewingsBooked,  // 内見予約
    viewingsVisited, // 来店実績
    applied,         // 申込
    contracted,      // 成約
  ] = await Promise.all([
    prisma.customer.count({
      where: { companyId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
    }),
    prisma.viewing.count({
      where: { companyId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
    }),
    prisma.viewing.count({
      where: {
        companyId,
        status: "completed",
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
    }),
    prisma.application.count({
      where: { companyId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
    }),
    prisma.contract.count({
      where: { companyId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
    }),
  ]);

  const funnel = [
    { stage: "inquiry", label: "反響（新規顧客）", count: inquiries, rate: 1.0 },
    {
      stage: "viewing_booked",
      label: "内見予約",
      count: viewingsBooked,
      rate: inquiries > 0 ? round4(viewingsBooked / inquiries) : 0,
    },
    {
      stage: "viewing_visited",
      label: "来店",
      count: viewingsVisited,
      rate: inquiries > 0 ? round4(viewingsVisited / inquiries) : 0,
    },
    {
      stage: "application",
      label: "申込",
      count: applied,
      rate: inquiries > 0 ? round4(applied / inquiries) : 0,
    },
    {
      stage: "contract",
      label: "成約",
      count: contracted,
      rate: inquiries > 0 ? round4(contracted / inquiries) : 0,
    },
  ];

  // 離脱ポイント特定
  const dropoffs: { from: string; to: string; dropRate: number }[] = [];
  for (let i = 0; i < funnel.length - 1; i++) {
    const fromCount = funnel[i].count;
    const toCount = funnel[i + 1].count;
    if (fromCount > 0) {
      const dropRate = 1 - toCount / fromCount;
      dropoffs.push({
        from: funnel[i].label,
        to: funnel[i + 1].label,
        dropRate: round4(dropRate),
      });
    }
  }

  // 最大の離脱ポイント
  const worstDropoff = dropoffs.length > 0
    ? dropoffs.reduce((worst, d) => (d.dropRate > worst.dropRate ? d : worst))
    : null;

  // Claude API で改善提案を生成
  let improvementSuggestion: string | null = null;
  if (worstDropoff && worstDropoff.dropRate > 0.3) {
    improvementSuggestion = await generateImprovementSuggestion(
      funnel,
      dropoffs,
      worstDropoff,
    );
  }

  return c.json({
    data: {
      funnel,
      dropoffs,
      worstDropoff,
      improvementSuggestion,
    },
  });
});

// ---------------------------------------------------------------
// Claude API: 改善提案の自動生成
// ---------------------------------------------------------------

async function generateImprovementSuggestion(
  funnel: { stage: string; label: string; count: number; rate: number }[],
  dropoffs: { from: string; to: string; dropRate: number }[],
  worstDropoff: { from: string; to: string; dropRate: number },
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `あなたは不動産業界のマーケティングコンサルタントです。
ファネル分析データに基づいて、具体的で実行可能な改善提案を3つ箇条書きで提示してください。
日本の賃貸仲介業界の実務に即したアドバイスをしてください。簡潔に。`,
      messages: [
        {
          role: "user",
          content: `ファネルデータ:
${funnel.map((f) => `- ${f.label}: ${f.count}件 (率: ${(f.rate * 100).toFixed(1)}%)`).join("\n")}

離脱ポイント:
${dropoffs.map((d) => `- ${d.from} → ${d.to}: 離脱率 ${(d.dropRate * 100).toFixed(1)}%`).join("\n")}

最大のボトルネック: 「${worstDropoff.from}」→「${worstDropoff.to}」の離脱率が ${(worstDropoff.dropRate * 100).toFixed(1)}% です。
改善提案をお願いします。`,
        },
      ],
    });

    return response.content[0].type === "text" ? response.content[0].text : "";
  } catch {
    return "改善提案の生成に失敗しました。";
  }
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export { analyticsRoutes };
