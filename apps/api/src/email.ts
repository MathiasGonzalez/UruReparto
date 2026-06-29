// @ts-ignore — cloudflare:email is a Workers runtime module; types come from @cloudflare/workers-types
import { EmailMessage } from "cloudflare:email";
import type { Env } from "./db/types.js";

/**
 * Sends an OTP code to `toEmail` using the Cloudflare send_email binding.
 *
 * Requires:
 *  - `env.SEND_EMAIL` binding configured in wrangler.toml
 *  - `env.SEND_EMAIL_FROM` set to a verified sender address in Cloudflare Email Routing
 */
export async function sendOtpEmail(
  env: Env,
  toEmail: string,
  code: string
): Promise<void> {
  const from = env.SEND_EMAIL_FROM;
  const subject = "Tu código de acceso — UruReparto";
  const body = [
    `Tu código de verificación es: ${code}`,
    "",
    "Este código expira en 10 minutos.",
    "Si no solicitaste este código, podés ignorar este mensaje.",
  ].join("\n");

  const rawEmail = [
    `From: UruReparto <${from}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(rawEmail));
      controller.close();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const message = new EmailMessage(from, toEmail, stream);
  await env.SEND_EMAIL.send(message);
}
