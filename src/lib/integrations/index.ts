import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail, sendWhatsApp, sendSms, type SendResult } from "./providers";
import { renderTemplate } from "./render";

export { integrationStatus, channelConfigured } from "./config";
export { TEMPLATE_PLACEHOLDERS } from "./render";

type DispatchArgs = {
  channel: string; // EMAIL | SMS | WHATSAPP
  to: string;
  subject?: string;
  body: string;
  event?: string;
  leadId?: string | null;
  userId?: string | null;
  logInteraction?: boolean;
};

// Send via the right provider, then log to MessageLog (and optionally to the lead
// interaction timeline). Always logs, even for simulated/failed sends.
export async function dispatchMessage(args: DispatchArgs): Promise<SendResult> {
  const { channel, to, subject, body, event, leadId, userId, logInteraction } = args;

  let result: SendResult;
  if (!to) {
    result = { status: "FAILED", error: "No recipient address." };
  } else if (channel === "EMAIL") {
    result = await sendEmail(to, subject ?? "", body);
  } else if (channel === "WHATSAPP") {
    result = await sendWhatsApp(to, body);
  } else if (channel === "SMS") {
    result = await sendSms(to, body);
  } else {
    result = { status: "FAILED", error: "Unknown channel." };
  }

  await prisma.messageLog.create({
    data: {
      channel,
      toAddress: to || "(none)",
      subject: subject || null,
      body,
      status: result.status,
      error: result.error || null,
      event: event || null,
      leadId: leadId || null,
      sentById: userId || null,
    },
  });

  if (logInteraction && leadId && userId) {
    await prisma.interaction.create({
      data: {
        leadId,
        userId,
        type: channel === "WHATSAPP" ? "WHATSAPP" : channel === "EMAIL" ? "EMAIL" : "SMS",
        summary: `${channel === "EMAIL" && subject ? subject + " — " : ""}${body}`.slice(0, 500),
      },
    });
  }

  return result;
}

// Auto-send the active template for an event to a lead (best channel available).
// Used by enrollment & visa-outcome triggers. Silent on missing template/recipient.
export async function autoSendForLead(
  event: string,
  lead: { id: string; fullName: string; phone: string; email: string | null },
  vars: Record<string, string | undefined | null>,
  preferredChannels: string[] = ["WHATSAPP", "SMS", "EMAIL"]
): Promise<void> {
  for (const channel of preferredChannels) {
    const tpl = await prisma.messageTemplate.findFirst({
      where: { event, channel, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!tpl) continue;
    const to = channel === "EMAIL" ? lead.email ?? "" : lead.phone;
    if (!to) continue;
    await dispatchMessage({
      channel,
      to,
      subject: tpl.subject ? renderTemplate(tpl.subject, vars) : undefined,
      body: renderTemplate(tpl.body, vars),
      event,
      leadId: lead.id,
    });
    return; // first matching channel wins
  }
}
