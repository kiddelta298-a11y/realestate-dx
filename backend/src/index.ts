import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
  })
);

app.get("/", (c) => {
  return c.json({ message: "不動産DX Platform API", version: "0.1.0" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 3001;
console.log(`Backend running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
