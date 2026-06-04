/**
 * pocket email "<body>" --to <addr> — send an email via Gmail SMTP using
 * an App Password.
 *
 * Auth/config comes from $GMAIL_USER (the from address) and
 * $GMAIL_APP_PASSWORD (a Google App Password, not your account password —
 * generate one at https://myaccount.google.com/apppasswords). Sends over
 * smtp.gmail.com:465 (implicit TLS) via nodemailer.
 */

import nodemailer from "nodemailer";
import { getArg, getPositional } from "../lib/args";
import { error, success } from "../lib/output";

export async function run() {
  const body = getPositional(0);
  if (!body) {
    error('usage: pocket email "<body>" --to <addr> [--subject "<s>"] [--cc <addr>] [--bcc <addr>]', "MISSING_ARG");
  }

  const to = getArg("--to");
  if (!to) error("no recipient: pass --to <address>", "MISSING_TO");

  const subject = getArg("--subject") ?? "";
  const cc = getArg("--cc");
  const bcc = getArg("--bcc");

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    error(
      "missing credentials: add GMAIL_USER and GMAIL_APP_PASSWORD to .env (App Password from https://myaccount.google.com/apppasswords)",
      "MISSING_CREDENTIALS",
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({ from: user, to, cc, bcc, subject, text: body });
    success({ ok: true, messageId: info.messageId, accepted: info.accepted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`SMTP error: ${msg}`, "SMTP_ERROR");
  }
}
