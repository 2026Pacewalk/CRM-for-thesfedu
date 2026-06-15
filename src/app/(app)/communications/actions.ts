"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dispatchMessage } from "@/lib/integrations";
import { CHANNELS } from "@/lib/constants";

// Send a message to a lead from their profile (Section 7.1). Renders nothing —
// the body is already final (the form lets the user edit a template-prefilled body).
export async function sendLeadMessageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const leadId = String(formData.get("leadId"));
  const channel = String(formData.get("channel"));
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!Object.keys(CHANNELS).includes(channel) || !body) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, phone: true, email: true },
  });
  if (!lead) return;

  const to = channel === "EMAIL" ? lead.email ?? "" : lead.phone;

  await dispatchMessage({
    channel,
    to,
    subject: channel === "EMAIL" ? subject : undefined,
    body,
    leadId,
    userId: user.id,
    logInteraction: true,
  });

  revalidatePath(`/leads/${leadId}`);
}
