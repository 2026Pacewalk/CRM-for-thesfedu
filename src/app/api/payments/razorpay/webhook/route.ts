import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRazorpaySignature } from "@/lib/integrations/payments";
import { settlePaymentLink } from "@/app/(app)/payments/actions";

// Razorpay webhook for online fee collection (Section 7.10). Configure this URL in
// the Razorpay dashboard with the same secret as RAZORPAY_WEBHOOK_SECRET.
// Handles the `payment_link.paid` event by settling the matching PaymentLink.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyRazorpaySignature(raw, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  if (event?.event === "payment_link.paid") {
    const providerRef: string | undefined = event?.payload?.payment_link?.entity?.id;
    if (providerRef) {
      const link = await prisma.paymentLink.findFirst({ where: { providerRef } });
      if (link) await settlePaymentLink(link.id);
    }
  }

  return NextResponse.json({ ok: true });
}
