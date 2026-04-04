import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const viewingRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const timeRegex = /^\d{2}:\d{2}$/;

const createSlotSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date(),
  startTime: z.string().regex(timeRegex, "HH:MM 形式で入力してください"),
  endTime: z.string().regex(timeRegex, "HH:MM 形式で入力してください"),
});

const createSlotsRangeSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  intervalMinutes: z.number().int().min(30).max(120).default(60),
});

const createViewingSchema = z.object({
  companyId: z.string().uuid(),
  slotId: z.string().uuid(),
  customerId: z.string().uuid(),
  propertyId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateViewingSchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional(),
  slotId: z.string().uuid().optional(),
  notes: z.string().optional(),
  cancelReason: z.string().optional(),
});

const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------
// GET /api/viewings/slots - 空き枠一覧（カレンダー用）
// ---------------------------------------------------------------

viewingRoutes.get("/slots", async (c) => {
  const companyId = c.req.query("companyId");
  const userId = c.req.query("userId");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");

  if (!companyId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId は必須です" } }, 400);
  }

  const where: Record<string, unknown> = { companyId, isAvailable: true };
  if (userId) where.userId = userId;
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const slots = await prisma.viewingSlot.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 200,
  });

  return c.json({ data: slots });
});

// ---------------------------------------------------------------
// POST /api/viewings/slots - 空き枠作成（単発）
// ---------------------------------------------------------------

viewingRoutes.post("/slots", async (c) => {
  const body = await c.req.json();
  const parsed = createSlotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const slot = await prisma.viewingSlot.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date),
    },
  });

  return c.json({ data: slot }, 201);
});

// ---------------------------------------------------------------
// POST /api/viewings/slots/range - 空き枠一括作成（日付範囲）
// ---------------------------------------------------------------

viewingRoutes.post("/slots/range", async (c) => {
  const body = await c.req.json();
  const parsed = createSlotsRangeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, userId, dateFrom, dateTo, startTime, endTime, intervalMinutes } = parsed.data;

  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  const slots: Array<{ date: Date; startTime: string; endTime: string }> = [];

  // 各日付のスロットを生成
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const dayStartMin = startH * 60 + startM;
    const dayEndMin = endH * 60 + endM;

    for (let min = dayStartMin; min + intervalMinutes <= dayEndMin; min += intervalMinutes) {
      const slotStart = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      const slotEnd = `${String(Math.floor((min + intervalMinutes) / 60)).padStart(2, "0")}:${String((min + intervalMinutes) % 60).padStart(2, "0")}`;
      slots.push({ date: new Date(d), startTime: slotStart, endTime: slotEnd });
    }
  }

  const created = await prisma.viewingSlot.createMany({
    data: slots.map((s) => ({
      companyId,
      userId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });

  return c.json({ data: { createdCount: created.count } }, 201);
});

// ---------------------------------------------------------------
// GET /api/viewings - 内見予約一覧
// ---------------------------------------------------------------

viewingRoutes.get("/", async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: query.error.issues } }, 400);
  }

  const { companyId, userId, customerId, status, dateFrom, dateTo, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (userId || dateFrom || dateTo) {
    where.slot = {
      ...(userId ? { userId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  const [viewings, total] = await Promise.all([
    prisma.viewing.findMany({
      where,
      include: {
        slot: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.viewing.count({ where }),
  ]);

  return c.json({
    data: viewings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------
// POST /api/viewings - 内見予約登録
// ---------------------------------------------------------------

viewingRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createViewingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, slotId, customerId, propertyId, notes } = parsed.data;

  // スロットの存在・空き確認
  const slot = await prisma.viewingSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    return c.json({ error: { code: "NOT_FOUND", message: "内見枠が見つかりません" } }, 404);
  }
  if (!slot.isAvailable) {
    return c.json({ error: { code: "UNAVAILABLE", message: "この枠は既に予約済みです" } }, 409);
  }

  const viewing = await prisma.$transaction(async (tx) => {
    // 予約作成
    const v = await tx.viewing.create({
      data: { companyId, slotId, customerId, propertyId, notes },
      include: { slot: true },
    });

    // スロットを予約済みに更新
    await tx.viewingSlot.update({
      where: { id: slotId },
      data: { isAvailable: false },
    });

    // 担当者への通知タスク生成
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { name: true, assignedUserId: true },
    });
    const property = await tx.property.findUnique({
      where: { id: propertyId },
      select: { name: true },
    });

    await tx.task.create({
      data: {
        companyId,
        assignedUserId: slot.userId,
        customerId,
        title: `内見予約: ${customer?.name ?? "顧客"} → ${property?.name ?? "物件"}`,
        description: `日時: ${slot.date.toISOString().split("T")[0]} ${slot.startTime}-${slot.endTime}\n${notes ?? ""}`,
        taskType: "viewing",
        priority: "high",
        dueDate: slot.date,
      },
    });

    return v;
  });

  return c.json({ data: viewing }, 201);
});

// ---------------------------------------------------------------
// PUT /api/viewings/:id - 予約変更・キャンセル
// ---------------------------------------------------------------

viewingRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateViewingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const existing = await prisma.viewing.findUnique({
    where: { id },
    include: { slot: true },
  });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "予約が見つかりません" } }, 404);
  }

  const { status, slotId, notes, cancelReason } = parsed.data;

  const viewing = await prisma.$transaction(async (tx) => {
    // スロット変更がある場合
    if (slotId && slotId !== existing.slotId) {
      const newSlot = await tx.viewingSlot.findUnique({ where: { id: slotId } });
      if (!newSlot || !newSlot.isAvailable) {
        throw new Error("SLOT_UNAVAILABLE");
      }
      // 旧スロットを空きに戻す
      await tx.viewingSlot.update({
        where: { id: existing.slotId },
        data: { isAvailable: true },
      });
      // 新スロットを予約済みに
      await tx.viewingSlot.update({
        where: { id: slotId },
        data: { isAvailable: false },
      });
    }

    // キャンセルの場合、スロットを空きに戻す
    if (status === "cancelled") {
      await tx.viewingSlot.update({
        where: { id: slotId ?? existing.slotId },
        data: { isAvailable: true },
      });
    }

    return tx.viewing.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(slotId ? { slotId } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(cancelReason ? { cancelReason } : {}),
      },
      include: { slot: true },
    });
  });

  return c.json({ data: viewing });
});

export { viewingRoutes };
