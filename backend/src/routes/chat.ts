import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  generateReply,
  isWithinBusinessHours,
  type ChatHistoryMessage,
  type ReplyStyle,
} from "../services/ai-chat.js";

// ---------------------------------------------------------------
// チャット自動対応 API
// ---------------------------------------------------------------

const chatRoutes = new Hono();

// リクエストスキーマ
const autoReplySchema = z.object({
  sessionId: z.string().min(1),
  customerMessage: z.string().min(1).max(5000),
});

/**
 * POST /api/chat/auto-reply
 *
 * 営業時間外: AI が直接顧客に返信（is_draft = false）
 * 営業時間内: AI が下書きを生成（is_draft = true、担当者確認待ち）
 */
chatRoutes.post("/auto-reply", async (c) => {
  // リクエストバリデーション
  const body = await c.req.json();
  const parsed = autoReplySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "リクエストが不正です",
          details: parsed.error.issues,
        },
      },
      400,
    );
  }

  const { sessionId, customerMessage } = parsed.data;

  // セッション取得
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      company: true,
      customer: true,
      user: true,
    },
  });

  if (!session) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "チャットセッションが見つかりません" } },
      404,
    );
  }

  // 顧客メッセージを保存
  await prisma.chatMessage.create({
    data: {
      companyId: session.companyId,
      sessionId: session.id,
      senderType: "customer",
      senderId: session.customerId,
      content: customerMessage,
    },
  });

  // 営業時間判定
  const companySettings = (session.company.settings ?? {}) as Record<
    string,
    unknown
  >;
  const businessHours = isWithinBusinessHours(companySettings);

  // チャット履歴取得（直近20件）
  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // 古い順に並べ替え、今回の顧客メッセージは除外（既にgenerateReplyで追加される）
  const chatHistory: ChatHistoryMessage[] = recentMessages
    .reverse()
    .slice(0, -1) // 最後の1件（今保存した顧客メッセージ）を除外
    .map((msg) => ({
      role: (msg.senderType === "customer" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: msg.content,
    }));

  // 担当者の返信スタイル取得
  const replyStyle: ReplyStyle = session.user?.replyStyle
    ? (session.user.replyStyle as ReplyStyle)
    : {};

  // AI返信生成
  const result = await generateReply({
    customerMessage,
    chatHistory,
    companyName: session.company.name,
    assigneeName: session.user?.name ?? undefined,
    replyStyle,
    isBusinessHours: businessHours,
  });

  // AI返信を保存
  const aiMessage = await prisma.chatMessage.create({
    data: {
      companyId: session.companyId,
      sessionId: session.id,
      senderType: "ai",
      content: result.reply,
      isDraft: result.isDraft,
      metadata: {
        usage: result.usage,
        isBusinessHours: businessHours,
      },
    },
  });

  // セッションのAI対応フラグを更新
  if (!session.isAiActive) {
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { isAiActive: true },
    });
  }

  return c.json({
    data: {
      messageId: aiMessage.id,
      reply: result.reply,
      isDraft: result.isDraft,
      isBusinessHours: businessHours,
      usage: result.usage,
    },
  });
});

/**
 * GET /api/chat/sessions
 * セッション一覧取得
 */
chatRoutes.get("/sessions", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId required" } }, 400);

  const sessions = await prisma.chatSession.findMany({
    where: { companyId },
    include: { customer: { select: { id: true, name: true, email: true } } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return c.json({ data: sessions });
});

/**
 * POST /api/chat/sessions
 * セッション作成
 */
chatRoutes.post("/sessions", async (c) => {
  const body = await c.req.json();
  const { companyId, customerId, assignedUserId, channel } = body;
  if (!companyId || !customerId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "companyId and customerId required" } }, 400);
  }

  const session = await prisma.chatSession.create({
    data: { companyId, customerId, assignedUserId: assignedUserId ?? null, channel: channel ?? "web" },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });

  return c.json({ data: session }, 201);
});

/**
 * GET /api/chat/sessions/:id/messages
 *
 * チャット履歴取得
 */
chatRoutes.get("/sessions/:id/messages", async (c) => {
  const sessionId = c.req.param("id");

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return c.json({ data: messages });
});

export { chatRoutes };
