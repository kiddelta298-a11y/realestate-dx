import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signJwt, verifyJwt, extractBearerToken } from "../lib/auth.js";

const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  companyId: z.string().uuid().optional(),
});

const setupSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8),
  adminSecret: z.string(),
});

/**
 * POST /api/auth/login
 */
authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "メールアドレスとパスワードを入力してください" } }, 400);
  }

  const { email, password, companyId } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      email,
      isActive: true,
      ...(companyId ? { companyId } : {}),
    },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });

  if (!user || !user.passwordHash) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが正しくありません" } }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが正しくありません" } }, 401);
  }

  const token = await signJwt({ sub: user.id, companyId: user.companyId, role: user.role });

  return c.json({
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        company: user.company,
      },
    },
  });
});

/**
 * GET /api/auth/me
 */
authRoutes.get("/me", async (c) => {
  const token = extractBearerToken(c.req.header("Authorization") ?? null);
  if (!token) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "トークンが無効です" } }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });

  if (!user || !user.isActive) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "ユーザーが見つかりません" } }, 401);
  }

  return c.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      company: user.company,
    },
  });
});

/**
 * POST /api/auth/setup-password
 * 初期パスワード設定（管理者シークレット必要）
 */
authRoutes.post("/setup-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "入力が不正です" } }, 400);
  }

  const adminSecret = process.env.ADMIN_SETUP_SECRET ?? "setup-secret-change-me";
  if (parsed.data.adminSecret !== adminSecret) {
    return c.json({ error: { code: "FORBIDDEN", message: "シークレットが不正です" } }, 403);
  }

  const hash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: hash },
  });

  return c.json({ data: { message: "パスワードを設定しました" } });
});

export { authRoutes };
