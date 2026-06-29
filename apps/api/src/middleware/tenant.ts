import { createMiddleware } from "hono/factory";
import type { Env } from "../db/types.js";

declare module "hono" {
  interface ContextVariableMap {
    tenantId: string;
  }
}

/**
 * Tenant resolution middleware.
 * Reads the X-Tenant-Slug header and resolves tenantId from DB.
 * Must be used after authMiddleware so that the user is already set.
 */
export const tenantMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const user = c.get("user");

    if (!user?.tenantId) {
      return c.json(
        { success: false, error: "Forbidden", message: "Tenant context missing" },
        403
      );
    }

    c.set("tenantId", user.tenantId);
    await next();
  }
);
