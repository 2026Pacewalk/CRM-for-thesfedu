import "server-only";

// Integration credentials are read from environment variables (kept out of the DB).
// When a channel's credentials are absent, the app runs that channel in SIMULATION
// mode: messages are rendered and logged but not actually sent. Add the env vars
// (see .env.example) to switch a channel to live sending.

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

export function isWhatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export function isSmsConfigured(): boolean {
  return !!(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}

export function channelConfigured(channel: string): boolean {
  switch (channel) {
    case "EMAIL": return isEmailConfigured();
    case "WHATSAPP": return isWhatsappConfigured();
    case "SMS": return isSmsConfigured();
    default: return false;
  }
}

// Status summary for the admin Integrations page.
export function integrationStatus() {
  return [
    {
      channel: "EMAIL",
      configured: isEmailConfigured(),
      envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
      note: "SMTP (works with Gmail, Outlook, or any provider).",
    },
    {
      channel: "WHATSAPP",
      configured: isWhatsappConfigured(),
      envVars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
      note: "WhatsApp Business Cloud API (Meta). Two-way: webhook at /api/integrations/whatsapp/webhook.",
    },
    {
      channel: "SMS",
      configured: isSmsConfigured(),
      envVars: ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER"],
      note: "Generic HTTP SMS gateway (JSON POST).",
    },
    {
      channel: "PAYMENT",
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      envVars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
      note: "Razorpay payment links for online fee collection (INR).",
    },
    {
      channel: "LEADFORMS",
      configured: !!(process.env.LEADFORM_VERIFY_TOKEN && process.env.LEADFORM_PAGE_TOKEN),
      envVars: ["LEADFORM_VERIFY_TOKEN", "LEADFORM_PAGE_TOKEN", "LEADFORM_APP_SECRET", "LEADFORM_BRANCH_CODE", "LEADFORM_VERTICAL"],
      note: "Facebook/Instagram Lead Ads → auto-capture leads. Webhook at /api/integrations/leadforms/webhook.",
    },
  ];
}
