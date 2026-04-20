import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY is not set");
    return null;
  }
  return new Resend(key);
}

const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@iranenovin.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  personalMessage?: string;
  projectTitle?: string;
  projectUrl?: string;
}) {
  const { to, inviterName, personalMessage, projectTitle, projectUrl } = params;
  try {
    await getResend()?.emails.send({
      from: `IranENovin <${fromEmail}>`,
      to,
      subject: "دعوت به IranENovin | You're invited to IranENovin",
      html: `
<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FAFAF8;">
  <div style="background: linear-gradient(135deg, #0A5E3F, #0D8C6A); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px;">✦ IranENovin</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">ساختن آینده ایران، با هم</p>
  </div>
  <div style="background: white; padding: 24px; border-radius: 12px; border: 1px solid #E5E7EB;">
    <p style="font-size: 16px; color: #1A1A18;"><strong>${inviterName}</strong> شما را به IranENovin دعوت کرده است.</p>
    ${personalMessage ? `<blockquote style="border-right: 3px solid #0D8C6A; padding-right: 12px; margin: 16px 0; color: #4B5563;">${personalMessage}</blockquote>` : ""}
    ${projectTitle ? `<p>پروژه: <strong>${projectTitle}</strong></p>` : ""}
    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
    <p style="font-size: 14px; color: #4B5563;">IranENovin is a community where Iranians worldwide submit ideas, collaborate, and build projects together.</p>
    ${projectUrl ? `<a href="${projectUrl}" style="display: inline-block; background: #0A5E3F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 12px 0;">مشاهده پروژه | View Project</a>` : ""}
    <a href="${appUrl}/en/join" style="display: inline-block; background: #C9921A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 12px 4px;">عضو شو | Join Now</a>
    <p style="font-size: 13px; color: #6B7280; margin-top: 16px;">حساب گیت‌هاب ندارید؟ مشکلی نیست — نشونتون می‌دیم چطور عضو بشید.</p>
    <a href="${appUrl}/en" style="font-size: 13px; color: #0D8C6A;">بدون ثبت‌نام مرور کن | Explore without signing up →</a>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Failed to send invite email:", e);
  }
}

export async function sendSuggestionConfirmation(to: string) {
  try {
    await getResend()?.emails.send({
      from: `IranENovin <${fromEmail}>`,
      to,
      subject: "We got your idea! | ایده‌ات رو دریافت کردیم!",
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0A5E3F, #0D8C6A); padding: 20px; border-radius: 12px; color: white; text-align: center;">
    <h2>✦ IranENovin</h2>
  </div>
  <div style="padding: 24px; background: white; border-radius: 12px; margin-top: 12px; border: 1px solid #E5E7EB;">
    <p style="text-align: right; color: #1A1A18;">ایده‌ات دریافت شد! اگه مورد استقبال قرار بگیره، به بورد اصلی اضافه می‌شه.</p>
    <hr style="border: none; border-top: 1px solid #E5E7EB;">
    <p>Your suggestion has been received. If it gets traction, we'll post it to the main board.</p>
    <a href="${appUrl}/en/ideas" style="display: inline-block; background: #0A5E3F; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">Browse Ideas</a>
    <p style="font-size: 13px; color: #6B7280; margin-top: 12px;">Want to be notified if your idea gets popular? <a href="${appUrl}/en" style="color: #0D8C6A;">Sign in →</a></p>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Failed to send suggestion confirmation:", e);
  }
}

export async function sendNominationConfirmation(to: string) {
  try {
    await getResend()?.emails.send({
      from: `IranENovin <${fromEmail}>`,
      to,
      subject: "Thanks for your nomination | ممنون از معرفی‌ات",
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0A5E3F, #0D8C6A); padding: 20px; border-radius: 12px; color: white; text-align: center;">
    <h2>✦ IranENovin</h2>
  </div>
  <div style="padding: 24px; background: white; border-radius: 12px; margin-top: 12px; border: 1px solid #E5E7EB;">
    <p style="text-align: right;">ممنون از معرفی‌ات! بررسیش می‌کنیم و باهاش تماس می‌گیریم. نتیجه رو بهت اطلاع می‌دیم.</p>
    <hr style="border: none; border-top: 1px solid #E5E7EB;">
    <p>Thanks for your nomination! We'll review it and reach out to them. We'll let you know what happens.</p>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Failed to send nomination confirmation:", e);
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    await getResend()?.emails.send({
      from: `IranENovin <${fromEmail}>`,
      to,
      subject: "Welcome to IranENovin | به IranENovin خوش اومدی",
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0A5E3F, #0D8C6A); padding: 30px; border-radius: 12px; color: white; text-align: center;">
    <h1 style="margin: 0;">✦ IranENovin</h1>
    <p style="opacity: 0.9;">خوش اومدی ${name}!</p>
  </div>
  <div style="padding: 24px; background: white; border-radius: 12px; margin-top: 12px; border: 1px solid #E5E7EB;">
    <p style="text-align: right; font-size: 16px;">خوشحالیم که عضو شدی! ۳ کار اول:</p>
    <ul style="text-align: right; line-height: 2;">
      <li><a href="${appUrl}/fa/ideas" style="color: #0D8C6A;">ایده‌های برتر رو ببین</a></li>
      <li><a href="${appUrl}/fa/submit" style="color: #0D8C6A;">اولین ایده‌ات رو ثبت کن</a></li>
      <li><a href="${appUrl}/fa/projects" style="color: #0D8C6A;">به یک پروژه بپیوند</a></li>
    </ul>
    <hr style="border: none; border-top: 1px solid #E5E7EB;">
    <p>Welcome, ${name}! Here are 3 things to do first:</p>
    <ul style="line-height: 2;">
      <li><a href="${appUrl}/en/ideas" style="color: #0D8C6A;">Browse top ideas</a></li>
      <li><a href="${appUrl}/en/submit" style="color: #0D8C6A;">Submit your first idea</a></li>
      <li><a href="${appUrl}/en/projects" style="color: #0D8C6A;">Join a project</a></li>
    </ul>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Failed to send welcome email:", e);
  }
}
