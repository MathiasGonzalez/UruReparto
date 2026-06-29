import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth.js";
import { stock } from "./routes/stock.js";
import { deliveries } from "./routes/deliveries.js";
import type { Env } from "./db/types.js";

const app = new Hono<{ Bindings: Env }>();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "https://urureparto.pages.dev",
        "http://localhost:4321",
        "http://localhost:3000",
      ];
      return allowed.includes(origin) ? origin : allowed[0];
    },
    allowHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/", (c) =>
  c.json({ success: true, data: { name: c.env.APP_NAME, status: "ok" } })
);

app.get("/health", (c) =>
  c.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.route("/auth", auth);
app.route("/stock", stock);
app.route("/deliveries", deliveries);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ success: false, error: "NotFound", message: "Route not found" }, 404)
);

app.onError((err, c) => {
  console.error(err);
  return c.json(
    { success: false, error: "ServerError", message: "Internal server error" },
    500
  );
});

export default app;
