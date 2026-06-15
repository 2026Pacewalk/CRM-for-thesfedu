import "server-only";
import crypto from "node:crypto";

// Payment gateway integration (Section 7.10). Uses Razorpay when keys are present;
// otherwise runs in SIMULATION mode (a placeholder link that staff settle manually
// via "Mark paid"). Going live = set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.

export function isPaymentConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export type PaymentLinkResult = {
  provider: "RAZORPAY" | "SIMULATED";
  providerRef: string | null;
  shortUrl: string | null;
  error?: string;
};

type Customer = { name: string; phone?: string | null; email?: string | null };

// Create a payment link for a given amount (INR). Razorpay expects paise.
export async function createPaymentLink(
  amountInr: number,
  description: string,
  customer: Customer,
  indexHint = 0
): Promise<PaymentLinkResult> {
  if (!isPaymentConfigured()) {
    // Deterministic-ish simulated reference (no Math.random in this codebase path).
    const ref = `plink_sim_${Date.now().toString(36)}${indexHint}`;
    return { provider: "SIMULATED", providerRef: ref, shortUrl: null };
  }

  try {
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amountInr * 100),
        currency: "INR",
        description,
        customer: {
          name: customer.name,
          contact: customer.phone ?? undefined,
          email: customer.email ?? undefined,
        },
        notify: { sms: !!customer.phone, email: !!customer.email },
        reminder_enable: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { provider: "RAZORPAY", providerRef: null, shortUrl: null, error: `Razorpay ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id: string; short_url: string };
    return { provider: "RAZORPAY", providerRef: data.id, shortUrl: data.short_url };
  } catch (e) {
    return { provider: "RAZORPAY", providerRef: null, shortUrl: null, error: e instanceof Error ? e.message : "Payment link failed" };
  }
}

// Verify a Razorpay webhook signature (HMAC-SHA256 of the raw body).
export function verifyRazorpaySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
