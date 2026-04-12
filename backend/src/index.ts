import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chat.js";
import { propertyRoutes } from "./routes/properties.js";
import { customerRoutes, webhookRoutes } from "./routes/customers.js";
import { taskRoutes } from "./routes/tasks.js";
import { followupRoutes } from "./routes/followup.js";
import { lineRoutes, lineWebhookRoutes } from "./routes/line.js";
import { applicationRoutes } from "./routes/applications.js";
import { contractRoutes } from "./routes/contracts.js";
import { viewingRoutes } from "./routes/viewings.js";
import { tenantRoutes } from "./routes/tenants.js";
import { rentRoutes } from "./routes/rent.js";
import { renewalRoutes } from "./routes/renewals.js";
import { vacationRoutes } from "./routes/vacations.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { aiRoutes } from "./routes/ai.js";
import { salePropertyRoutes } from "./routes/sale-properties.js";
import { saleCaseRoutes } from "./routes/sale-cases.js";
import { visitRoutes } from "./routes/visits.js";
import { iimonRoutes } from "./routes/iimon.js";
import { suumoRoutes } from "./routes/suumo.js";
import { mediaPostRoutes } from "./routes/media-posts.js";

const app = new Hono();

app.use("*", logger());
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  "http://localhost:3000,http://localhost:3003"
).split(",").map((o) => o.trim());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin; // server-to-server requests
      if (allowedOrigins.some((o) => o === "*" || o === origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/", (c) => {
  return c.json({ message: "不動産DX Platform API", version: "0.6.0" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth
app.route("/api/auth", authRoutes);

// Phase 0: チャット自動対応 API
app.route("/api/chat", chatRoutes);

// Phase 1: 物件管理 API
app.route("/api/properties", propertyRoutes);

// Phase 1: 顧客CRM API
app.route("/api/customers", customerRoutes);

// Phase 1: Webhook API
app.route("/api/webhooks", webhookRoutes);

// Phase 1: タスク管理 API
app.route("/api/tasks", taskRoutes);

// Phase 2: 追客自動化 API
app.route("/api/followup", followupRoutes);

// Phase 2: LINE Messaging API
app.route("/api/line", lineRoutes);
app.route("/api/webhooks", lineWebhookRoutes);

// Phase 3: Web申込API
app.route("/api/applications", applicationRoutes);

// Phase 3: 電子契約API
app.route("/api/contracts", contractRoutes);

// Phase 3: 内見予約API
app.route("/api/viewings", viewingRoutes);

// Phase 4: 賃貸管理BO
app.route("/api/tenants", tenantRoutes);
app.route("/api/rent", rentRoutes);
app.route("/api/renewals", renewalRoutes);
app.route("/api/vacations", vacationRoutes);

// Phase 5: 売買対応API
app.route("/api/sale-properties", salePropertyRoutes);
app.route("/api/sale-cases", saleCaseRoutes);
app.route("/api/visits", visitRoutes);

// Phase 5: 分析エンジン + 切り返しAI
app.route("/api/analytics", analyticsRoutes);
app.route("/api/ai", aiRoutes);

// Phase 6: iimon連携 + SUUMO自動投稿
app.route("/api/iimon", iimonRoutes);
app.route("/api/suumo", suumoRoutes);
app.route("/api/media-posts", mediaPostRoutes);

const port = Number(process.env.PORT) || 3001;
console.log(`Backend running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
