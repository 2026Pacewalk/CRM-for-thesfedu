import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { recordInboundWhatsApp } from "@/lib/integrations/inbound";

// Two-way WhatsApp webhook (Section 7.1 / 7.10) for the Meta WhatsApp Business
// Cloud API. Inbound messages are matched to leads and logged to their timeline.
//
// Setup: in the Meta app's webhook config, set the callback URL to
//   https://<your-domain>/api/integrations/whatsapp/webhook
// and the Verify Token to the value of WHATSAPP_VERIFY_TOKEN. Subscribe to the
// "messages" field. Optionally set WHATSAPP_APP_SECRET to enforce signature checks.

// GET — Meta verification handshake. Echoes hub.challenge when the token matches.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app
// secret). Only enforced when WHATSAPP_APP_SECRET is configured.
function signatureValid(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // not configured → skip (dev / simulation)
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

// POST — inbound message events. Always returns 200 quickly (Meta requirement);
// parsing/logging errors are swallowed so Meta does not retry indefinitely.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!signatureValid(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const payload = JSON.parse(raw);
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const messages = change?.value?.messages;
        if (!Array.isArray(messages)) continue;
        for (const m of messages) {
          const from: string = m?.from ?? "";
          // Text messages carry text.body; other types fall back to a type label.
          const body: string =
            m?.text?.body ??
            (m?.type ? `[${m.type} message]` : "");
          if (from && body) await recordInboundWhatsApp(from, body);
        }
      }
    }
  } catch {
    // Malformed payload — acknowledge anyway so Meta doesn't retry.
  }

  return NextResponse.json({ received: true });
}
