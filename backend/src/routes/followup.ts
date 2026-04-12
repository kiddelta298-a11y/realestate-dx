import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const followupRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const scheduleSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  sequenceId: z.string().uuid(),
});

const createSequenceSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  triggerEvent: z.enum(["inquiry", "visit", "application"]),
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    delayDays: z.number().int().min(0),
    channel: z.enum(["email", "line", "task"]),
    templateBody: z.string().min(1),
    subject: z.string().max(255).optional(),
  })).default([]),
});

const updateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const createStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0),
  channel: z.enum(["email", "line", "task"]),
  templateBody: z.string().min(1),
  subject: z.string().max(255).optional(),
});

// ---------------------------------------------------------------
// POST /api/followup/schedule - 追客シーケンスをスケジュール
// ---------------------------------------------------------------

followupRoutes.post("/schedule", async (c) => {
  const body = await c.req.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, customerId, sequenceId } = parsed.data;

  // シーケンスとステップを取得
  const sequence = await prisma.followupSequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!sequence) {
    return c.json({ error: { code: "NOT_FOUND", message: "追客シーケンスが見つかりません" } }, 404);
  }

  if (!sequence.isActive) {
    return c.json({ error: { code: "INACTIVE", message: "このシーケンスは無効です" } }, 400);
  }

  // 顧客存在確認
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }

  // 各ステップの実行をスケジュール
  const now = new Date();
  const executions = await prisma.$transaction(
    sequence.steps.map((step) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + step.delayDays);

      return prisma.followupExecution.create({
        data: {
          companyId,
          sequenceId,
          stepId: step.id,
          customerId,
          channel: step.channel,
          messageBody: step.templateBody,
          scheduledAt,
          status: "pending",
        },
      });
    }),
  );

  return c.json({
    data: {
      sequenceId,
      customerId,
      scheduledCount: executions.length,
      executions: executions.map((e) => ({
        id: e.id,
        channel: e.channel,
        scheduledAt: e.scheduledAt,
        status: e.status,
      })),
    },
  }, 201);
});

// ---------------------------------------------------------------
// GET /api/followup/executions - 実行履歴一覧
// ---------------------------------------------------------------

followupRoutes.get("/executions", async (c) => {
  const companyId = c.req.query("companyId");
  const status = c.req.query("status") as string | undefined;

  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const executions = await prisma.followupExecution.findMany({
    where,
    include: {
      sequence: { select: { id: true, name: true } },
      step: { select: { id: true, stepOrder: true, channel: true, subject: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  return c.json({ data: executions, total: executions.length });
});

// ---------------------------------------------------------------
// GET /api/followup/pending - 未実行の追客タスク一覧
// ---------------------------------------------------------------

followupRoutes.get("/pending", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const now = new Date();

  const executions = await prisma.followupExecution.findMany({
    where: {
      companyId,
      status: "pending",
      scheduledAt: { lte: now },
    },
    include: {
      sequence: { select: { id: true, name: true } },
      step: { select: { id: true, stepOrder: true, channel: true, subject: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  return c.json({ data: executions, total: executions.length });
});

// ---------------------------------------------------------------
// GET /api/followup/customers/:customerId - 顧客の追客進捗
// ---------------------------------------------------------------

followupRoutes.get("/customers/:customerId", async (c) => {
  const customerId = c.req.param("customerId");

  const executions = await prisma.followupExecution.findMany({
    where: { customerId },
    include: {
      sequence: { select: { id: true, name: true, triggerEvent: true } },
      step: { select: { id: true, stepOrder: true, channel: true, delayDays: true } },
    },
    orderBy: [{ sequenceId: "asc" }, { scheduledAt: "asc" }],
  });

  // シーケンスごとにグルーピング
  const grouped: Record<string, { sequence: { id: string; name: string; triggerEvent: string }; steps: typeof executions }> = {};
  for (const exec of executions) {
    const key = exec.sequenceId;
    if (!grouped[key]) {
      grouped[key] = { sequence: exec.sequence, steps: [] };
    }
    grouped[key].steps.push(exec);
  }

  return c.json({ data: Object.values(grouped) });
});

// ---------------------------------------------------------------
// POST /api/followup/executions/:id/execute - 追客実行（手動トリガー）
// ---------------------------------------------------------------

followupRoutes.post("/executions/:id/execute", async (c) => {
  const id = c.req.param("id");

  const execution = await prisma.followupExecution.findUnique({ where: { id } });
  if (!execution) {
    return c.json({ error: { code: "NOT_FOUND", message: "実行レコードが見つかりません" } }, 404);
  }

  if (execution.status !== "pending") {
    return c.json({ error: { code: "INVALID_STATE", message: `現在のステータス: ${execution.status}` } }, 400);
  }

  // チャネル別の送信処理（実際の送信はサービス層で行うが、ここではステータス更新）
  // LINE/email の実送信は各サービスが polling して実行する想定
  const updated = await prisma.followupExecution.update({
    where: { id },
    data: {
      status: "sent",
      executedAt: new Date(),
    },
  });

  // 自動対応完了: 関連する顧客のタスクを「自動対応完了済み」に更新
  if (execution.customerId) {
    await prisma.task.updateMany({
      where: {
        customerId: execution.customerId,
        companyId: execution.companyId,
        taskType: "follow_up",
        status: { in: ["pending", "in_progress"] },
      },
      data: {
        status: "auto_completed",
        completedAt: new Date(),
      },
    });
  }

  return c.json({ data: updated });
});

// ---------------------------------------------------------------
// POST /api/followup/executions/:id/cancel - 追客キャンセル
// ---------------------------------------------------------------

followupRoutes.post("/executions/:id/cancel", async (c) => {
  const id = c.req.param("id");

  const execution = await prisma.followupExecution.findUnique({ where: { id } });
  if (!execution) {
    return c.json({ error: { code: "NOT_FOUND", message: "実行レコードが見つかりません" } }, 404);
  }

  if (execution.status !== "pending") {
    return c.json({ error: { code: "INVALID_STATE", message: "pending 以外はキャンセルできません" } }, 400);
  }

  const updated = await prisma.followupExecution.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return c.json({ data: updated });
});

// ---------------------------------------------------------------
// 追客シーケンス CRUD
// ---------------------------------------------------------------

// GET /api/followup/sequences - シーケンス一覧
followupRoutes.get("/sequences", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const sequences = await prisma.followupSequence.findMany({
    where: { companyId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: sequences });
});

// GET /api/followup/sequences/:id
followupRoutes.get("/sequences/:id", async (c) => {
  const id = c.req.param("id");

  const sequence = await prisma.followupSequence.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      executions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!sequence) {
    return c.json({ error: { code: "NOT_FOUND", message: "シーケンスが見つかりません" } }, 404);
  }

  return c.json({ data: sequence });
});

// POST /api/followup/sequences - シーケンス + ステップ一括作成
followupRoutes.post("/sequences", async (c) => {
  const body = await c.req.json();
  const parsed = createSequenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { steps, ...seqData } = parsed.data;

  const sequence = await prisma.followupSequence.create({
    data: {
      ...seqData,
      steps: {
        create: steps.map((s) => ({
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          channel: s.channel,
          templateBody: s.templateBody,
          subject: s.subject,
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return c.json({ data: sequence }, 201);
});

// PUT /api/followup/sequences/:id
followupRoutes.put("/sequences/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSequenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.followupSequence.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "シーケンスが見つかりません" } }, 404);
  }

  const sequence = await prisma.followupSequence.update({
    where: { id },
    data: parsed.data,
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return c.json({ data: sequence });
});

// DELETE /api/followup/sequences/:id
followupRoutes.delete("/sequences/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.followupSequence.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "シーケンスが見つかりません" } }, 404);
  }

  await prisma.followupSequence.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

// POST /api/followup/sequences/:id/steps - ステップ追加
followupRoutes.post("/sequences/:sequenceId/steps", async (c) => {
  const sequenceId = c.req.param("sequenceId");
  const body = await c.req.json();
  const parsed = createStepSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const sequence = await prisma.followupSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) {
    return c.json({ error: { code: "NOT_FOUND", message: "シーケンスが見つかりません" } }, 404);
  }

  const step = await prisma.followupStep.create({
    data: { sequenceId, ...parsed.data },
  });

  return c.json({ data: step }, 201);
});

// DELETE /api/followup/sequences/:sequenceId/steps/:stepId
followupRoutes.delete("/sequences/:sequenceId/steps/:stepId", async (c) => {
  const stepId = c.req.param("stepId");

  const existing = await prisma.followupStep.findUnique({ where: { id: stepId } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "ステップが見つかりません" } }, 404);
  }

  await prisma.followupStep.delete({ where: { id: stepId } });
  return c.json({ data: { id: stepId, deleted: true } });
});

export { followupRoutes };
