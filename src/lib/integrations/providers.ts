import "server-only";
import { isEmailConfigured, isWhatsappConfigured, isSmsConfigured } from "./config";

export type SendResult = { status: "SENT" | "SIMULATED" | "FAILED"; error?: string };

// --- Email (SMTP via nodemailer) ---
export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!isEmailConfigured()) return { status: "SIMULATED" };
  try {
    // Imported lazily so the dependency only loads when email is actually configured.
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text: body });
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Email send failed" };
  }
}

// --- WhatsApp (Meta WhatsApp Business Cloud API) ---
export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  if (!isWhatsappConfigured()) return { status: "SIMULATED" };
  try {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { status: "FAILED", error: `WhatsApp API ${res.status}: ${t.slice(0, 200)}` };
    }
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "WhatsApp send failed" };
  }
}

// --- SMS (generic HTTP gateway: JSON POST { to, message, sender }) ---
export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!isSmsConfigured()) return { status: "SIMULATED" };
  try {
    const res = await fetch(process.env.SMS_API_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, message: body, sender: process.env.SMS_SENDER ?? "SFEDU" }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { status: "FAILED", error: `SMS gateway ${res.status}: ${t.slice(0, 200)}` };
    }
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "SMS send failed" };
  }
}
