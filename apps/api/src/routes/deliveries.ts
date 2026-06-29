import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import type { Env, DeliveryRow } from "../db/types.js";

const deliveries = new Hono<{ Bindings: Env }>();

deliveries.use("*", authMiddleware, tenantMiddleware);

const deliveryStatusValues = [
  "pending",
  "assigned",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
] as const;

// GET /deliveries — list deliveries
deliveries.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const user = c.get("user");
  const { page = "1", pageSize = "20", status, assignedTo } = c.req.query();

  const pageNum = Math.max(1, parseInt(page));
  const size = Math.min(100, Math.max(1, parseInt(pageSize)));
  const offset = (pageNum - 1) * size;

  let where = "WHERE tenant_id = ?";
  const bindings: unknown[] = [tenantId];

  // Drivers can only see their own deliveries
  if (user.role === "driver") {
    where += " AND assigned_to = ?";
    bindings.push(user.sub);
  } else if (assignedTo) {
    where += " AND assigned_to = ?";
    bindings.push(assignedTo);
  }

  if (status) {
    where += " AND status = ?";
    bindings.push(status);
  }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM deliveries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(...bindings, size, offset)
      .all<DeliveryRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM deliveries ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
  ]);

  const total = countRow?.total ?? 0;
  return c.json({
    success: true,
    data: rows.results.map(toDelivery),
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
  });
});

// GET /deliveries/:id — get single delivery
deliveries.get("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const user = c.get("user");
  const { id } = c.req.param();

  const delivery = await c.env.DB.prepare(
    "SELECT * FROM deliveries WHERE id = ? AND tenant_id = ?"
  )
    .bind(id, tenantId)
    .first<DeliveryRow>();

  if (!delivery) {
    return c.json({ success: false, error: "NotFound", message: "Delivery not found" }, 404);
  }

  if (user.role === "driver" && delivery.assigned_to !== user.sub) {
    return c.json({ success: false, error: "Forbidden", message: "Access denied" }, 403);
  }

  return c.json({ success: true, data: toDelivery(delivery) });
});

// POST /deliveries — create delivery
deliveries.post(
  "/",
  zValidator(
    "json",
    z.object({
      customer: z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
      }),
      address: z.object({
        street: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(1),
        country: z.string().default("UY"),
        zipCode: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
      notes: z.string().optional(),
      scheduledAt: z.string().optional(),
      items: z
        .array(
          z.object({
            stockItemId: z.string(),
            sku: z.string(),
            name: z.string(),
            quantity: z.number().int().positive(),
          })
        )
        .min(1),
    })
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const trackingCode = generateTrackingCode();

    const delivery = await c.env.DB.prepare(
      `INSERT INTO deliveries
         (tenant_id, tracking_code, customer_name, customer_phone, customer_email,
          street, city, state, country, zip_code, lat, lng, notes, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
      .bind(
        tenantId,
        trackingCode,
        body.customer.name,
        body.customer.phone,
        body.customer.email ?? null,
        body.address.street,
        body.address.city,
        body.address.state,
        body.address.country,
        body.address.zipCode ?? null,
        body.address.lat ?? null,
        body.address.lng ?? null,
        body.notes ?? null,
        body.scheduledAt ?? null
      )
      .first<DeliveryRow>();

    if (!delivery) {
      return c.json(
        { success: false, error: "ServerError", message: "Failed to create delivery" },
        500
      );
    }

    // Insert delivery items
    if (body.items.length > 0) {
      const insertItems = body.items.map((item) =>
        c.env.DB.prepare(
          "INSERT INTO delivery_items (delivery_id, stock_item_id, sku, name, quantity) VALUES (?, ?, ?, ?, ?)"
        ).bind(delivery.id, item.stockItemId, item.sku, item.name, item.quantity)
      );
      await c.env.DB.batch(insertItems);
    }

    return c.json({ success: true, data: toDelivery(delivery) }, 201);
  }
);

// PATCH /deliveries/:id/status — update status
deliveries.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(deliveryStatusValues),
      notes: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await c.env.DB.prepare(
      "SELECT * FROM deliveries WHERE id = ? AND tenant_id = ?"
    )
      .bind(id, tenantId)
      .first<DeliveryRow>();

    if (!existing) {
      return c.json({ success: false, error: "NotFound", message: "Delivery not found" }, 404);
    }

    if (user.role === "driver" && existing.assigned_to !== user.sub) {
      return c.json({ success: false, error: "Forbidden", message: "Access denied" }, 403);
    }

    const completedAt =
      body.status === "delivered" || body.status === "failed"
        ? "strftime('%Y-%m-%dT%H:%M:%SZ','now')"
        : null;

    const [updated] = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE deliveries
         SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
             ${completedAt ? ", completed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')" : ""}
         WHERE id = ? AND tenant_id = ? RETURNING *`
      ).bind(body.status, id, tenantId),
      c.env.DB.prepare(
        `INSERT INTO delivery_status_history (delivery_id, status, notes, lat, lng, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.status,
        body.notes ?? null,
        body.lat ?? null,
        body.lng ?? null,
        user.sub
      ),
    ]);

    const delivery = updated.results[0] as DeliveryRow;
    return c.json({ success: true, data: toDelivery(delivery) });
  }
);

// PATCH /deliveries/:id/assign — assign driver
deliveries.patch(
  "/:id/assign",
  zValidator("json", z.object({ driverId: z.string() })),
  async (c) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const { id } = c.req.param();
    const { driverId } = c.req.valid("json");

    if (user.role === "driver") {
      return c.json({ success: false, error: "Forbidden", message: "Access denied" }, 403);
    }

    const delivery = await c.env.DB.prepare(
      `UPDATE deliveries
       SET assigned_to = ?, status = 'assigned', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ? AND tenant_id = ? RETURNING *`
    )
      .bind(driverId, id, tenantId)
      .first<DeliveryRow>();

    if (!delivery) {
      return c.json({ success: false, error: "NotFound", message: "Delivery not found" }, 404);
    }

    return c.json({ success: true, data: toDelivery(delivery) });
  }
);

// GET /deliveries/track/:trackingCode — public tracking (no auth)
deliveries.get("/track/:trackingCode", async (c) => {
  const { trackingCode } = c.req.param();

  const delivery = await c.env.DB.prepare(
    `SELECT tracking_code, status, customer_name, street, city, state, country,
            scheduled_at, completed_at, updated_at
     FROM deliveries WHERE tracking_code = ?`
  )
    .bind(trackingCode)
    .first();

  if (!delivery) {
    return c.json({ success: false, error: "NotFound", message: "Tracking code not found" }, 404);
  }

  return c.json({ success: true, data: delivery });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTrackingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(random)
    .map((b) => chars[b % chars.length])
    .join("");
}

function toDelivery(row: DeliveryRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    trackingCode: row.tracking_code,
    status: row.status,
    assignedTo: row.assigned_to ?? undefined,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email ?? undefined,
    },
    address: {
      street: row.street,
      city: row.city,
      state: row.state,
      country: row.country,
      zipCode: row.zip_code ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
    },
    notes: row.notes ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { deliveries };
