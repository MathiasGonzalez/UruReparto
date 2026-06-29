import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { signJWT } from "../middleware/auth.js";
import { sendOtpEmail } from "../email.js";
import type { Env, UserRow, TenantRow } from "../db/types.js";

const auth = new Hono<{ Bindings: Env }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEnabled(flag: string | undefined): boolean {
  return flag !== "false";
}

// ─── POST /auth/login  (password-based — gated by FEATURE_PASSWORD_LOGIN) ────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  tenantSlug: z.string().min(1),
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  if (!isEnabled(c.env.FEATURE_PASSWORD_LOGIN)) {
    return c.json(
      {
        success: false,
        error: "Forbidden",
        message: "Password login is disabled. Use the OTP flow instead.",
      },
      403
    );
  }

  const { email, password, tenantSlug } = c.req.valid("json");

  if (!password) {
    return c.json(
      { success: false, error: "BadRequest", message: "password is required" },
      400
    );
  }

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

// ─── POST /auth/otp/request  (gated by FEATURE_OTP_LOGIN) ────────────────────

const otpRequestSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1),
});

auth.post(
  "/otp/request",
  zValidator("json", otpRequestSchema),
  async (c) => {
    if (!isEnabled(c.env.FEATURE_OTP_LOGIN)) {
      return c.json(
        { success: false, error: "Forbidden", message: "OTP login is disabled." },
        403
      );
    }

    const { email, tenantSlug } = c.req.valid("json");

    const tenant = await c.env.DB.prepare(
      "SELECT * FROM tenants WHERE slug = ? AND status = 'active'"
    )
      .bind(tenantSlug)
      .first<TenantRow>();

    if (!tenant) {
      // Return success to avoid email enumeration
      return c.json({ success: true, data: { message: "Si el email está registrado, recibirás el código." } });
    }

    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE tenant_id = ? AND email = ? AND status = 'active'"
    )
      .bind(tenant.id, email)
      .first<{ id: string }>();

    if (!user) {
      // Same response to avoid enumeration
      return c.json({ success: true, data: { message: "Si el email está registrado, recibirás el código." } });
    }

    // Generate 6-digit OTP
    const code = generateOtp();
    const kvKey = `otp:${tenant.id}:${email}`;
    const kvValue = JSON.stringify({ code, attempts: 0 });

    // Store in KV with 10-minute TTL
    await c.env.SESSIONS.put(kvKey, kvValue, { expirationTtl: 600 });

    // Send via Cloudflare Email Workers
    await sendOtpEmail(c.env, email, code);

    return c.json({
      success: true,
      data: { message: "Si el email está registrado, recibirás el código." },
    });
  }
);

// ─── POST /auth/otp/verify  (gated by FEATURE_OTP_LOGIN) ─────────────────────

const otpVerifySchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1),
  code: z.string().length(6),
});

auth.post(
  "/otp/verify",
  zValidator("json", otpVerifySchema),
  async (c) => {
    if (!isEnabled(c.env.FEATURE_OTP_LOGIN)) {
      return c.json(
        { success: false, error: "Forbidden", message: "OTP login is disabled." },
        403
      );
    }

    const { email, tenantSlug, code } = c.req.valid("json");

    const tenant = await c.env.DB.prepare(
      "SELECT * FROM tenants WHERE slug = ? AND status = 'active'"
    )
      .bind(tenantSlug)
      .first<TenantRow>();

    if (!tenant) {
      return c.json(
        { success: false, error: "Unauthorized", message: "Invalid or expired code" },
        401
      );
    }

    const kvKey = `otp:${tenant.id}:${email}`;
    const stored = await c.env.SESSIONS.get(kvKey);

    if (!stored) {
      return c.json(
        { success: false, error: "Unauthorized", message: "Invalid or expired code" },
        401
      );
    }

    const otpData = JSON.parse(stored) as { code: string; attempts: number };

    // Allow max 5 attempts before invalidating
    if (otpData.attempts >= 5) {
      await c.env.SESSIONS.delete(kvKey);
      return c.json(
        { success: false, error: "Unauthorized", message: "Invalid or expired code" },
        401
      );
    }

    if (otpData.code !== code) {
      otpData.attempts += 1;
      await c.env.SESSIONS.put(kvKey, JSON.stringify(otpData), {
        expirationTtl: 600,
      });
      return c.json(
        { success: false, error: "Unauthorized", message: "Invalid or expired code" },
        401
      );
    }

    // Valid code — delete OTP and issue JWT
    await c.env.SESSIONS.delete(kvKey);

    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE tenant_id = ? AND email = ? AND status = 'active'"
    )
      .bind(tenant.id, email)
      .first<UserRow>();

    if (!user) {
      return c.json(
        { success: false, error: "Unauthorized", message: "Invalid or expired code" },
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
  }
);

// ─── POST /auth/register-tenant ───────────────────────────────────────────────

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

// ─── OTP generator ────────────────────────────────────────────────────────────

function generateOtp(): string {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return digits.toString().padStart(6, "0");
}

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

