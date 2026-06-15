import "server-only";
import { prisma } from "@/lib/db";
import { notifyMany } from "@/lib/notify";

// Record an inbound WhatsApp message against the matching lead (Section 7.1 —
// two-way messaging). Matches the sender's number to a lead by normalized phone
// (last 8 digits, ignoring country-code/formatting differences), logs it to the
// message timeline, and notifies the lead's counselors. Returns the match result.
export async function recordInboundWhatsApp(from: string, body: string): Promise<{ logged: boolean; leadId: string | null }> {
  const digits = from.replace(/\D/g, "");
  const last8 = digits.slice(-8);

  const lead = last8
    ? await prisma.lead.findFirst({
        where: { phoneNormalized: { contains: last8 } },
        orderBy: { createdAt: "desc" },
        select: { id: true, fullName: true, counselors: { select: { userId: true } } },
      })
    : null;

  await prisma.messageLog.create({
    data: {
      channel: "WHATSAPP",
      toAddress: from, // sender's number (inbound)
      body,
      status: "RECEIVED",
      event: "INBOUND",
      leadId: lead?.id ?? null,
    },
  });

  if (lead) {
    await notifyMany(
      lead.counselors.map((c) => c.userId),
      "MESSAGE_RECEIVED",
      `New WhatsApp from ${lead.fullName}: ${body.slice(0, 60)}`,
      `/leads/${lead.id}`
    );
  }

  return { logged: true, leadId: lead?.id ?? null };
}
