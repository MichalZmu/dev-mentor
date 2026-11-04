import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Pool } from "pg";
import type { RuntimeEnvironment } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  url?: string;
}
export async function deliverEmail(
  pool: Pool,
  env: RuntimeEnvironment,
  message: EmailMessage,
): Promise<void> {
  if (env.APP_MODE === "demo") {
    await pool.query(
      `insert into auth.demo_mailbox(id, owner_hash, subject, body, url, created_at)
      select $1, owner_hash, $3, $4, $5, now() from auth.demo_mailbox_owner where email=$2`,
      [
        randomUUID(),
        message.to.toLowerCase(),
        message.subject,
        message.text,
        message.url ?? null,
      ],
    );
    return;
  }
  if (!env.SMTP_URL) throw new Error("Email transport unavailable");
  const transport = nodemailer.createTransport(env.SMTP_URL);
  try {
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  } finally {
    transport.close();
  }
}
