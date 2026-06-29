-- UruReparto D1 Schema
-- Multitenant: all tables include tenant_id

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Tenants ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator','driver')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, email);

-- ─── Stock Items ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_items (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  quantity     INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  unit         TEXT NOT NULL DEFAULT 'unit',
  category     TEXT NOT NULL DEFAULT 'general',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_stock_items_tenant ON stock_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_sku ON stock_items (tenant_id, sku);

-- ─── Stock Movements ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('inbound','outbound','adjustment')),
  quantity   INTEGER NOT NULL,
  notes      TEXT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements (tenant_id);

-- ─── Deliveries ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deliveries (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tracking_code  TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','assigned','in_transit','delivered','failed','cancelled')),
  assigned_to    TEXT REFERENCES users(id),
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  street         TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  country        TEXT NOT NULL DEFAULT 'UY',
  zip_code       TEXT,
  lat            REAL,
  lng            REAL,
  notes          TEXT,
  scheduled_at   TEXT,
  completed_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON deliveries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries (assigned_to);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries (tracking_code);

-- ─── Delivery Items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_items (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delivery_id   TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  quantity      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items (delivery_id);

-- ─── Delivery Status History ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  notes       TEXT,
  lat         REAL,
  lng         REAL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_history_delivery ON delivery_status_history (delivery_id);
