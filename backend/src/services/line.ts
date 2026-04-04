import { createHmac } from "crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

/**
 * LINE Webhook 署名検証
 */
export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string,
): boolean {
  const hash = createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

/**
 * LINE Push Message 送信
 */
export async function sendLineMessage(
  channelAccessToken: string,
  lineUserId: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `LINE API error: ${response.status} ${errorBody}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * LINE Reply Message 送信（Webhook応答用）
 */
export async function replyLineMessage(
  channelAccessToken: string,
  replyToken: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `LINE API error: ${response.status} ${errorBody}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
