import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendLineMessage, verifyLineSignature } from "../services/line.js";

const lineRoutes = new Hono();
const lineWebhookRoutes = new Hono();

// ---------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------

const sendMessageSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  message: z.string().min(1).max(5000),
});

// ---------------------------------------------------------------
// POST /api/webhooks/line - LINE Messaging API Webhook
// ---------------------------------------------------------------

lineWebhookRoutes.post("/line", async (c) => {
  const signature = c.req.header("x-line-signature");
  const rawBody = await c.req.text();

  if (!signature) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "署名がありません" } }, 401);
  }

  // LINE Channel Secret は全テナント共通か、テナント別で管理
  // ここではイベント内の destination から特定する簡易実装
  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: { code: "INVALID_BODY", message: "JSONパースエラー" } }, 400);
  }

  // destination (Bot の userId) からテナント特定
  const lineAccount = await prisma.lineAccount.findFirst({
    where: { channelId: body.destination ?? "" },
  });

  if (lineAccount) {
    const isValid = verifyLineSignature(rawBody, signature, lineAccount.channelSecret);
    if (!isValid) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "署名が無効です" } }, 401);
    }
  }

  const companyId = lineAccount?.companyId;

  // イベント処理
  for (const event of body.events ?? []) {
    if (event.type === "message" && event.message?.type === "text") {
      await handleLineTextMessage(event, companyId);
    } else if (event.type === "follow") {
      await handleLineFollow(event, companyId);
    }
  }

  // LINE は 200 OK を即返す必要がある
  return c.json({ status: "ok" });
});

// ---------------------------------------------------------------
// POST /api/line/send - 顧客へLINEメッセージ送信
// ---------------------------------------------------------------

lineRoutes.post("/send", async (c) => {
  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } }, 400);
  }

  const { companyId, customerId, message } = parsed.data;

  // 顧客の LINE userId を取得
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return c.json({ error: { code: "NOT_FOUND", message: "顧客が見つかりません" } }, 404);
  }

  if (!customer.lineUserId) {
    return c.json({ error: { code: "NO_LINE_ID", message: "この顧客はLINE連携されていません" } }, 400);
  }

  // テナントの LINE アカウント情報を取得
  const lineAccount = await prisma.lineAccount.findUnique({
    where: { companyId },
  });

  if (!lineAccount) {
    return c.json({ error: { code: "NO_LINE_ACCOUNT", message: "LINE連携が設定されていません" } }, 400);
  }

  // LINE メッセージ送信
  const result = await sendLineMessage(
    lineAccount.channelAccessToken,
    customer.lineUserId,
    message,
  );

  if (!result.success) {
    return c.json({ error: { code: "LINE_SEND_FAILED", message: result.error } }, 502);
  }

  // チャットセッションにメッセージを記録
  let session = await prisma.chatSession.findFirst({
    where: {
      companyId,
      customerId,
      channel: "line",
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        companyId,
        customerId,
        channel: "line",
        assignedUserId: customer.assignedUserId,
      },
    });
  }

  await prisma.chatMessage.create({
    data: {
      companyId,
      sessionId: session.id,
      senderType: "user",
      senderId: customer.assignedUserId,
      content: message,
    },
  });

  return c.json({
    data: {
      customerId,
      lineUserId: customer.lineUserId,
      messageSent: true,
    },
  });
});

// ---------------------------------------------------------------
// LINE イベントハンドラ
// ---------------------------------------------------------------

interface LineWebhookBody {
  destination?: string;
  events?: LineEvent[];
}

interface LineEvent {
  type: string;
  source?: { type: string; userId?: string };
  replyToken?: string;
  message?: { type: string; text?: string; id?: string };
  timestamp?: number;
}

async function handleLineTextMessage(event: LineEvent, companyId?: string) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !companyId) return;

  // LINE userId で顧客検索
  let customer = await prisma.customer.findFirst({
    where: { companyId, lineUserId },
  });

  // 未登録の場合は自動登録
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId,
        name: `LINE User (${lineUserId.slice(-6)})`,
        lineUserId,
        source: "line",
      },
    });
  }

  // チャットセッション取得 or 作成
  let session = await prisma.chatSession.findFirst({
    where: {
      companyId,
      customerId: customer.id,
      channel: "line",
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        companyId,
        customerId: customer.id,
        channel: "line",
        assignedUserId: customer.assignedUserId,
        isAiActive: true,
      },
    });
  }

  // 顧客メッセージを保存
  await prisma.chatMessage.create({
    data: {
      companyId,
      sessionId: session.id,
      senderType: "customer",
      senderId: customer.id,
      content: event.message?.text ?? "",
      metadata: { lineMessageId: event.message?.id },
    },
  });

  // 営業時間外の場合、AIチャットと連携して自動返信
  // （task_013 の ai-chat サービスを呼び出す想定）
  // ここではメッセージ保存のみ。自動返信は chat/auto-reply エンドポイントから呼ぶ
}

async function handleLineFollow(event: LineEvent, companyId?: string) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !companyId) return;

  // 友だち追加 → 顧客として自動登録
  const existing = await prisma.customer.findFirst({
    where: { companyId, lineUserId },
  });

  if (!existing) {
    await prisma.customer.create({
      data: {
        companyId,
        name: `LINE User (${lineUserId.slice(-6)})`,
        lineUserId,
        source: "line",
      },
    });
  }
}

export { lineRoutes, lineWebhookRoutes };
