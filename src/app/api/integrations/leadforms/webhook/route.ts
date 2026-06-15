import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { ingestLeadForm, mapLeadFormFields } from "@/lib/integrations/leadforms";

// Facebook / Instagram Lead Ads webhook (Section 7.10). Captures lead-form
// submissions automatically as CRM leads.
//
// Setup: in the Meta app, add the "leadgen" webhook with callback URL
//   https://<your-domain>/api/integrations/leadforms/webhook
// and Verify Token = LEADFORM_VERIFY_TOKEN. Subscribe the Page to leadgen events.
// Set LEADFORM_PAGE_TOKEN (a Page access token) so the full field data can be
// fetched from the Graph API. Optionally set LEADFORM_APP_SECRET for signature
// validation, LEADFORM_BRANCH_CODE and LEADFORM_VERTICAL for routing defaults.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge") ?? "";
  const expected = process.env.LEADFORM_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function signatureValid(raw: string, header: string | null): boolean {
  const secret = process.env.LEADFORM_APP_SECRET;
  if (!secret) return true;
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

// Fetch a lead's field data from the Graph API when not delivered inline. The
// production webhook carries only a leadgen_id; the actual answers are fetched
// with the Page access token.
async function fetchLeadFields(leadgenId: string): Promise<{ name: string; values: string[] }[] | null> {
  const token = process.env.LEADFORM_PAGE_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data&access_token=${token}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.field_data) ? data.field_data : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!signatureValid(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let created = 0;
  let duplicates = 0;
  try {
    const payload = JSON.parse(raw);
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field !== "leadgen") continue;
        const value = change.value ?? {};
        // Prefer inline field_data (some integrations/tests include it); otherwise
        // fetch from the Graph API using the leadgen_id.
        const fieldData: { name: string; values: string[] }[] | null = Array.isArray(value.field_data)
          ? value.field_data
          : value.leadgen_id
          ? await fetchLeadFields(String(value.leadgen_id))
          : null;
        if (!fieldData) continue;

        const fields = mapLeadFormFields(fieldData);
        const platform = value.platform ? `${value.platform} Lead Form` : "Facebook/Instagram Lead Form";
        const result = await ingestLeadForm(fields, platform);
        if (result.created) created++;
        else if (result.duplicate) duplicates++;
      }
    }
  } catch {
    // Acknowledge anyway so Meta does not retry indefinitely.
  }

  return NextResponse.json({ received: true, created, duplicates });
}
