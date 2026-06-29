import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import type { Env, StockItemRow, StockMovementRow } from "../db/types.js";

const stock = new Hono<{ Bindings: Env }>();

stock.use("*", authMiddleware, tenantMiddleware);

// GET /stock — list stock items
stock.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const { page = "1", pageSize = "20", category, search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page));
  const size = Math.min(100, Math.max(1, parseInt(pageSize)));
  const offset = (pageNum - 1) * size;

  let where = "WHERE tenant_id = ?";
  const bindings: unknown[] = [tenantId];

  if (category) {
    where += " AND category = ?";
    bindings.push(category);
  }

  if (search) {
    where += " AND (name LIKE ? OR sku LIKE ?)";
    bindings.push(`%${search}%`, `%${search}%`);
  }

  const [items, countRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM stock_items ${where} ORDER BY name ASC LIMIT ? OFFSET ?`
    )
      .bind(...bindings, size, offset)
      .all<StockItemRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM stock_items ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
  ]);

  const total = countRow?.total ?? 0;
  return c.json({
    success: true,
    data: items.results.map(toStockItem),
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
  });
});

// GET /stock/:id — get single item
stock.get("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const { id } = c.req.param();

  const item = await c.env.DB.prepare(
    "SELECT * FROM stock_items WHERE id = ? AND tenant_id = ?"
  )
    .bind(id, tenantId)
    .first<StockItemRow>();

  if (!item) {
    return c.json({ success: false, error: "NotFound", message: "Item not found" }, 404);
  }

  return c.json({ success: true, data: toStockItem(item) });
});

// POST /stock — create item
stock.post(
  "/",
  zValidator(
    "json",
    z.object({
      sku: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      quantity: z.number().int().min(0).default(0),
      minQuantity: z.number().int().min(0).default(0),
      unit: z.string().default("unit"),
      category: z.string().default("general"),
    })
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const item = await c.env.DB.prepare(
      `INSERT INTO stock_items (tenant_id, sku, name, description, quantity, min_quantity, unit, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
      .bind(
        tenantId,
        body.sku,
        body.name,
        body.description ?? null,
        body.quantity,
        body.minQuantity,
        body.unit,
        body.category
      )
      .first<StockItemRow>();

    if (!item) {
      return c.json(
        { success: false, error: "ServerError", message: "Failed to create item" },
        500
      );
    }

    return c.json({ success: true, data: toStockItem(item) }, 201);
  }
);

// PATCH /stock/:id — update item
stock.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      minQuantity: z.number().int().min(0).optional(),
      unit: z.string().optional(),
      category: z.string().optional(),
    })
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await c.env.DB.prepare(
      "SELECT id FROM stock_items WHERE id = ? AND tenant_id = ?"
    )
      .bind(id, tenantId)
      .first();

    if (!existing) {
      return c.json({ success: false, error: "NotFound", message: "Item not found" }, 404);
    }

    const fields: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')"];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
    if (body.minQuantity !== undefined) { fields.push("min_quantity = ?"); values.push(body.minQuantity); }
    if (body.unit !== undefined) { fields.push("unit = ?"); values.push(body.unit); }
    if (body.category !== undefined) { fields.push("category = ?"); values.push(body.category); }

    const item = await c.env.DB.prepare(
      `UPDATE stock_items SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ? RETURNING *`
    )
      .bind(...values, id, tenantId)
      .first<StockItemRow>();

    return c.json({ success: true, data: toStockItem(item!) });
  }
);

// POST /stock/:id/movements — add movement (inbound/outbound/adjustment)
stock.post(
  "/:id/movements",
  zValidator(
    "json",
    z.object({
      type: z.enum(["inbound", "outbound", "adjustment"]),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const item = await c.env.DB.prepare(
      "SELECT * FROM stock_items WHERE id = ? AND tenant_id = ?"
    )
      .bind(id, tenantId)
      .first<StockItemRow>();

    if (!item) {
      return c.json({ success: false, error: "NotFound", message: "Item not found" }, 404);
    }

    const delta =
      body.type === "inbound"
        ? body.quantity
        : body.type === "outbound"
        ? -body.quantity
        : body.quantity - item.quantity;

    const newQty = item.quantity + delta;
    if (newQty < 0) {
      return c.json(
        { success: false, error: "BadRequest", message: "Insufficient stock" },
        400
      );
    }

    const [movement] = await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO stock_movements (tenant_id, item_id, type, quantity, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
      ).bind(tenantId, id, body.type, body.quantity, body.notes ?? null, user.sub),
      c.env.DB.prepare(
        "UPDATE stock_items SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?"
      ).bind(newQty, id),
    ]);

    const mov = movement.results[0] as StockMovementRow;
    return c.json({ success: true, data: toStockMovement(mov) }, 201);
  }
);

// GET /stock/:id/movements — movement history
stock.get("/:id/movements", async (c) => {
  const tenantId = c.get("tenantId");
  const { id } = c.req.param();

  const movements = await c.env.DB.prepare(
    "SELECT * FROM stock_movements WHERE item_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50"
  )
    .bind(id, tenantId)
    .all<StockMovementRow>();

  return c.json({ success: true, data: movements.results.map(toStockMovement) });
});

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toStockItem(row: StockItemRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sku: row.sku,
    name: row.name,
    description: row.description ?? undefined,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    unit: row.unit,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStockMovement(row: StockMovementRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    itemId: row.item_id,
    type: row.type,
    quantity: row.quantity,
    notes: row.notes ?? undefined,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export { stock };
