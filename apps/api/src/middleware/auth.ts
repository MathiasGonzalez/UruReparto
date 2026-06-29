import { createMiddleware } from "hono/factory";
import type { Env } from "../db/types.js";

interface JWTPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signature,
      encoder.encode(data)
    );

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized", message: "Missing or invalid Authorization header" }, 401);
    }

    const token = authorization.slice(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({ success: false, error: "Unauthorized", message: "Invalid or expired token" }, 401);
    }

    c.set("user", payload);
    await next();
  }
);

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encoder = new TextEncoder();
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = encode(header);
  const payloadB64 = encode(fullPayload);
  const data = `${headerB64}.${payloadB64}`;

  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signatureB64}`;
}
