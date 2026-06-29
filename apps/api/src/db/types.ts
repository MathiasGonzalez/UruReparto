import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  APP_NAME: string;
}

// ─── DB row types ──────────────────────────────────────────────────────────────

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StockItemRow {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  min_quantity: number;
  unit: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface StockMovementRow {
  id: string;
  tenant_id: string;
  item_id: string;
  type: string;
  quantity: number;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface DeliveryRow {
  id: string;
  tenant_id: string;
  tracking_code: string;
  status: string;
  assigned_to: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  street: string;
  city: string;
  state: string;
  country: string;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
