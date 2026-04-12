import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const taskRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const createTaskSchema = z.object({
  companyId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  taskType: z.enum(["follow_up", "viewing", "contract", "other"]),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dueDate: z.string().date().optional(),
});

const updateTaskSchema = z.object({
  assignedUserId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled", "auto_completed"]).optional(),
  dueDate: z.string().date().nullable().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled", "auto_completed"]).optional(),
  taskType: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  dueBefore: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/tasks - タスク一覧
// ---------------------------------------------------------------

taskRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, assignedUserId, status, taskType, priority, dueBefore, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (status) where.status = status;
  if (taskType) where.taskType = taskType;
  if (priority) where.priority = priority;
  if (dueBefore) where.dueDate = { lte: new Date(dueBefore) };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return c.json({
    data: tasks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// GET /api/tasks/:id - タスク詳細
// ---------------------------------------------------------------

taskRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!task) {
    return c.json({ error: { code: "NOT_FOUND", message: "タスクが見つかりません" } }, 404);
  }

  return c.json({ data: task });
});

// ---------------------------------------------------------------
// POST /api/tasks - タスク作成
// ---------------------------------------------------------------

taskRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { dueDate, ...rest } = parsed.data;

  const task = await prisma.task.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  return c.json({ data: task }, 201);
});

// ---------------------------------------------------------------
// PUT /api/tasks/:id - タスク更新
// ---------------------------------------------------------------

taskRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "タスクが見つかりません" } }, 404);
  }

  const { dueDate, status, ...rest } = parsed.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(status ? { status } : {}),
      ...(status === "done" || status === "auto_completed" ? { completedAt: new Date() } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  return c.json({ data: task });
});

// ---------------------------------------------------------------
// DELETE /api/tasks/:id - タスク削除
// ---------------------------------------------------------------

taskRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "タスクが見つかりません" } }, 404);
  }

  await prisma.task.delete({ where: { id } });
  return c.json({ data: { id, deleted: true } });
});

// ---------------------------------------------------------------
// GET /api/tasks/alerts - 期限アラート（期限切れ・本日期限のタスク）
// ---------------------------------------------------------------

taskRoutes.get("/alerts/upcoming", async (c) => {
  const companyId = c.req.query("companyId");
  const assignedUserId = c.req.query("assignedUserId");

  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const where: Record<string, unknown> = {
    companyId,
    status: { in: ["pending", "in_progress"] },
    dueDate: { lte: threeDaysLater },
  };
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = tasks.filter(
    (t) => t.dueDate && t.dueDate >= today && t.dueDate < new Date(today.getTime() + 86400000),
  );
  const upcoming = tasks.filter(
    (t) => t.dueDate && t.dueDate >= new Date(today.getTime() + 86400000),
  );

  return c.json({
    data: { overdue, dueToday, upcoming, totalAlerts: tasks.length },
  });
});

export { taskRoutes };
