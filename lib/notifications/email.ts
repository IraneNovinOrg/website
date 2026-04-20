/**
 * Resend email wrapper. Skips silently if RESEND_API_KEY is not configured.
 * Never throws — returns false on failure.
 */

import { Resend } from "resend";

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  linkUrl?: string;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@iranenovin.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    return new Resend(key);
  } catch (e) {
    console.error("[notifications/email] failed to init Resend:", e);
    return null;
  }
}

function renderHtml(subject: string, body: string, linkUrl?: string): string {
  const safeBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeSubject = subject
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const cta = linkUrl
    ? `<a href="${linkUrl}" style="display:inline-block;background:#0A5E3F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">Open on IranENovin</a>`
    : "";
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#FAFAF8;">
  <div style="background:linear-gradient(135deg,#0A5E3F,#0D8C6A);padding:24px;border-radius:12px;color:white;text-align:center;">
    <h1 style="margin:0;font-size:22px;">IranENovin</h1>
  </div>
  <div style="padding:24px;background:white;border-radius:12px;margin-top:12px;border:1px solid #E5E7EB;">
    <h2 style="margin:0 0 12px;color:#1A1A18;font-size:18px;">${safeSubject}</h2>
    <div style="color:#374151;line-height:1.6;white-space:pre-wrap;">${safeBody}</div>
    ${cta}
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
    <p style="font-size:12px;color:#6B7280;">You are receiving this because you opted in to email notifications. <a href="${APP_URL}/profile" style="color:#0D8C6A;">Manage preferences</a>.</p>
  </div>
</body>
</html>`;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    if (!opts.to || !opts.subject) return false;

    await resend.emails.send({
      from: `IranENovin <${FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: renderHtml(opts.subject, opts.body, opts.linkUrl),
    });
    return true;
  } catch (e) {
    console.error("[notifications/email] sendEmail failed:", e);
    return false;
  }
}
