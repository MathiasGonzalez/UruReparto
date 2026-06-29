import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { signJWT } from "../middleware/auth.js";
import type { Env, UserRow, TenantRow } from "../db/types.js";

const auth = new Hono<{ Bindings: Env }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().min(1),
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password, tenantSlug } = c.req.valid("json");

  const tenant = await c.env.DB.prepare(
    "SELECT * FROM tenants WHERE slug = ? AND status = 'active'"
  )
    .bind(tenantSlug)
    .first<TenantRow>();

  if (!tenant) {
    return c.json(
      { success: false, error: "Unauthorized", message: "Invalid credentials" },
      401
    );
  }

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ? AND status = 'active'"
  )
    .bind(tenant.id, email)
    .first<UserRow>();

  if (!user) {
    return c.json(
      { success: false, error: "Unauthorized", message: "Invalid credentials" },
      401
    );
  }

  // Verify password using Web Crypto (PBKDF2 hash stored as hex)
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json(
      { success: false, error: "Unauthorized", message: "Invalid credentials" },
      401
    );
  }

  const token = await signJWT(
    {
      sub: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    },
    c.env.JWT_SECRET
  );

  return c.json({
    success: true,
    data: {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    },
  });
});

auth.post(
  "/register-tenant",
  zValidator(
    "json",
    z.object({
      tenantName: z.string().min(2),
      tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
      adminEmail: z.string().email(),
      adminName: z.string().min(2),
      adminPassword: z.string().min(8),
    })
  ),
  async (c) => {
    const { tenantName, tenantSlug, adminEmail, adminName, adminPassword } =
      c.req.valid("json");

    const existing = await c.env.DB.prepare(
      "SELECT id FROM tenants WHERE slug = ?"
    )
      .bind(tenantSlug)
      .first();

    if (existing) {
      return c.json(
        { success: false, error: "Conflict", message: "Tenant slug already taken" },
        409
      );
    }

    const passwordHash = await hashPassword(adminPassword);

    const result = await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO tenants (name, slug) VALUES (?, ?) RETURNING id"
      ).bind(tenantName, tenantSlug),
    ]);

    const tenantId = (result[0].results[0] as { id: string }).id;

    await c.env.DB.prepare(
      "INSERT INTO users (tenant_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
    )
      .bind(tenantId, adminEmail, adminName, passwordHash)
      .run();

    return c.json(
      { success: true, data: { tenantId, message: "Tenant registered successfully" } },
      201
    );
  }
);

// ─── Password helpers using Web Crypto ────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = [...new Uint8Array(bits)];
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const encoder = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = [...new Uint8Array(bits)];
  const computed = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === hashHex;
}

export { auth };
