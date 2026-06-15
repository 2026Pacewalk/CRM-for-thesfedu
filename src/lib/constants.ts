// Enum-like domain values for the CRM. Stored as String in the DB (Postgres-portable)
// and validated here. These mirror the blueprint (Sections 2.1, 2.4, 2.5, 1.2).

// --- Verticals (Section 1.1) ---
export const VERTICALS = {
  B2C_DIRECT: "B2C — Direct Students",
  B2C_CAREER: "B2C — Career Desk",
  BOTH: "B2C — Both (Direct + Career)",
  B2B: "B2B — Partner Referral",
} as const;
export type VerticalKey = keyof typeof VERTICALS;

// --- Lead Sources (Section 2.1) ---
export const LEAD_SOURCES = {
  SOCIAL_MEDIA: "Social Media Campaign",
  WALK_IN: "Walk-In",
  INBOUND_CALL: "Inbound Call",
  WHATSAPP: "WhatsApp Promotion / Inquiry",
  EMAIL: "Email Inquiry",
  WEBSITE_FORM: "Website Form Submission",
  BULK_UPLOAD: "Bulk Upload (CSV/Excel)",
  B2B_PARTNER: "B2B Partner Referral",
  REFERRAL: "Referral (existing client)",
  OTHER: "Other",
} as const;
export type LeadSourceKey = keyof typeof LEAD_SOURCES;

export const SOCIAL_PLATFORMS = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "Other",
] as const;

// --- Service Types (Section 2.4, multi-select) ---
export const SERVICE_TYPES = {
  STUDY_VISA: "Study Visa",
  VISITOR_VISA: "Visitor Visa",
  SPOUSE_VISA: "Spouse / Family Visa",
  PSYCHOMETRIC: "Psychometric Test",
  CAREER_COUNSELLING: "Career Counselling",
  PR_IMMIGRATION: "PR / Immigration",
  IELTS_PREP: "IELTS / English Test Prep",
  OFFER_LETTER: "Offer Letter Assistance Only",
  UNI_SELECTION: "University / College Selection",
  OTHER: "Other",
} as const;
export type ServiceTypeKey = keyof typeof SERVICE_TYPES;

// --- Destination Countries (Section 4.1) ---
export const COUNTRIES = [
  "Canada",
  "Australia",
  "New Zealand",
  "UK",
  "Europe",
  "USA",
  "Dubai",
] as const;

// --- Lead Status Workflow (Section 2.5) ---
export const LEAD_STATUSES = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-up Scheduled",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  NOT_ELIGIBLE: "Not Eligible",
  ENROLLED: "Enrolled",
  VISA_APPROVED: "Visa Approved",
  VISA_REFUSED: "Visa Refused",
  ON_HOLD: "On Hold",
  DUPLICATE: "Duplicate",
} as const;
export type LeadStatusKey = keyof typeof LEAD_STATUSES;

// Statuses that require a reason when set (Section 2.5).
export const STATUS_REQUIRES_REASON: LeadStatusKey[] = [
  "NOT_INTERESTED",
  "NOT_ELIGIBLE",
  "VISA_REFUSED",
];

// Allowed status transitions (configurable later via admin — Section 7.8).
export const STATUS_TRANSITIONS: Record<LeadStatusKey, LeadStatusKey[]> = {
  NEW: ["CONTACTED", "NOT_INTERESTED", "NOT_ELIGIBLE", "DUPLICATE", "ON_HOLD"],
  CONTACTED: ["FOLLOW_UP", "INTERESTED", "NOT_INTERESTED", "NOT_ELIGIBLE", "ON_HOLD"],
  FOLLOW_UP: ["CONTACTED", "INTERESTED", "NOT_INTERESTED", "NOT_ELIGIBLE", "ON_HOLD"],
  INTERESTED: ["ENROLLED", "FOLLOW_UP", "NOT_INTERESTED", "ON_HOLD"],
  NOT_INTERESTED: ["CONTACTED", "INTERESTED"],
  NOT_ELIGIBLE: ["CONTACTED", "INTERESTED"],
  ENROLLED: ["VISA_APPROVED", "VISA_REFUSED", "ON_HOLD"],
  VISA_APPROVED: [],
  VISA_REFUSED: ["ENROLLED"],
  ON_HOLD: ["CONTACTED", "INTERESTED", "ENROLLED"],
  DUPLICATE: [],
};

// Tailwind color classes per status for badges.
export const STATUS_COLORS: Record<LeadStatusKey, string> = {
  NEW: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-sky-100 text-sky-700",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  INTERESTED: "bg-indigo-100 text-indigo-700",
  NOT_INTERESTED: "bg-rose-100 text-rose-700",
  NOT_ELIGIBLE: "bg-rose-100 text-rose-700",
  ENROLLED: "bg-emerald-100 text-emerald-700",
  VISA_APPROVED: "bg-green-100 text-green-800",
  VISA_REFUSED: "bg-red-100 text-red-800",
  ON_HOLD: "bg-zinc-100 text-zinc-600",
  DUPLICATE: "bg-orange-100 text-orange-700",
};

// --- Interaction types (Section 7.1) ---
export const INTERACTION_TYPES = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  WALKIN: "Walk-in",
  SMS: "SMS",
  OTHER: "Other",
} as const;
export type InteractionTypeKey = keyof typeof INTERACTION_TYPES;

// --- User Roles & Hierarchy (Section 1.2) ---
export const ROLES = {
  RECEPTION: "Reception Staff",
  B2C_COUNSELOR_DIRECT: "B2C Counselor (Direct)",
  B2C_COUNSELOR_CAREER: "B2C Counselor (Career Desk)",
  B2C_TL_DIRECT: "B2C Team Leader (Direct)",
  B2C_TL_CAREER: "B2C Team Leader (Career Desk)",
  BACKEND_COUNSELOR: "Backend Country Counselor",
  ADMISSIONS: "Admissions Officer",
  FILLING: "Filling Team Member",
  DESTINATION_MANAGER: "Destination Manager",
  BRANCH_MANAGER: "Branch Manager",
  B2B_COUNSELOR: "B2B Backend Counselor",
  BDM: "Business Development Manager",
  VP: "VP / Management",
  ADMIN: "System Administrator",
} as const;
export type RoleKey = keyof typeof ROLES;

// Task priorities & statuses (Section 7.3)
export const TASK_PRIORITIES = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
export const TASK_STATUSES = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
} as const;

// --- Enrollment & payments (Section 3.2–3.3) ---
export const PAYMENT_MODES = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK: "Bank Transfer",
  CHEQUE: "Cheque",
  ONLINE: "Online Gateway",
} as const;

export const PAYMENT_STATUSES = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  COMPLETE: "Complete",
} as const;

// --- Backend country pipeline (Section 4.2) ---
export const APPLICATION_STAGES = {
  ST_1: "Study Options Provided",
  ST_2: "OL Applied",
  ST_3: "OL Received",
  ST_4: "Fee Paid",
  ST_5: "File Lodged",
  ST_6: "Visa Approved",
  ST_7: "Visa Refused",
} as const;
export type StageKey = keyof typeof APPLICATION_STAGES;

// Ordered forward pipeline. ST_6 (approved) and ST_7 (refused) are terminal.
export const STAGE_ORDER: StageKey[] = ["ST_1", "ST_2", "ST_3", "ST_4", "ST_5"];

export const STAGE_COLORS: Record<string, string> = {
  ST_1: "bg-slate-100 text-slate-700",
  ST_2: "bg-sky-100 text-sky-700",
  ST_3: "bg-indigo-100 text-indigo-700",
  ST_4: "bg-amber-100 text-amber-700",
  ST_5: "bg-violet-100 text-violet-700",
  ST_6: "bg-green-100 text-green-800",
  ST_7: "bg-red-100 text-red-800",
};

// Which next stages are allowed from a given stage.
export const STAGE_TRANSITIONS: Record<StageKey, StageKey[]> = {
  ST_1: ["ST_2"],
  ST_2: ["ST_3"],
  ST_3: ["ST_4"],
  ST_4: ["ST_5"],
  ST_5: ["ST_6", "ST_7"],
  ST_6: [],
  ST_7: [],
};

// --- Document types (Section 4.5 & 7.5) ---
export const DOCUMENT_TYPES = {
  PASSPORT: "Passport Copy",
  TRANSCRIPTS: "Academic Transcripts / Certificates",
  ENGLISH_SCORE: "English Test Score (IELTS/PTE/TOEFL)",
  FINANCIAL: "Financial Documents",
  SOP: "Statement of Purpose / Cover Letter",
  OFFER_LETTER: "Offer Letter",
  FEE_RECEIPT: "Fee Payment Receipt",
  VISA_FORM: "Visa Application Form",
  VISA_OUTCOME: "Visa Approval / Refusal Letter",
  OTHER: "Other Supporting Document",
} as const;
export type DocumentTypeKey = keyof typeof DOCUMENT_TYPES;

export const ALLOWED_UPLOAD_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB (Section 7.5)

// Required-document checklist per service / visa type (Section 7.5). A lead's
// checklist is the union of the lists for its selected services. Code-configurable
// here; an admin-managed UI can layer on later.
export const DOCUMENT_CHECKLISTS: Partial<Record<ServiceTypeKey, DocumentTypeKey[]>> = {
  STUDY_VISA: ["PASSPORT", "TRANSCRIPTS", "ENGLISH_SCORE", "FINANCIAL", "SOP", "OFFER_LETTER"],
  VISITOR_VISA: ["PASSPORT", "FINANCIAL"],
  SPOUSE_VISA: ["PASSPORT", "FINANCIAL"],
  PR_IMMIGRATION: ["PASSPORT", "TRANSCRIPTS", "ENGLISH_SCORE", "FINANCIAL"],
  IELTS_PREP: ["ENGLISH_SCORE"],
  OFFER_LETTER: ["PASSPORT", "TRANSCRIPTS", "ENGLISH_SCORE"],
  UNI_SELECTION: ["TRANSCRIPTS", "ENGLISH_SCORE"],
};

// Document types that have a meaningful expiry to track (Section 7.5).
export const EXPIRY_TRACKED_TYPES: DocumentTypeKey[] = ["PASSPORT", "ENGLISH_SCORE", "VISA_OUTCOME"];

// Build the de-duplicated required-document checklist for a set of services.
export function requiredDocsForServices(services: ServiceTypeKey[]): DocumentTypeKey[] {
  const set = new Set<DocumentTypeKey>();
  for (const s of services) for (const d of DOCUMENT_CHECKLISTS[s] ?? []) set.add(d);
  return Array.from(set);
}

// Expiry alert tiers (Section 7.5): alerts at 90, 60, 30 days and once expired.
export type ExpiryTier = "EXPIRED" | "30" | "60" | "90" | "OK";

export function expiryTier(expiresAt: Date | string | null | undefined, now: Date = new Date()): ExpiryTier {
  if (!expiresAt) return "OK";
  const days = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "OK";
}

export const EXPIRY_TIER_LABELS: Record<ExpiryTier, string> = {
  EXPIRED: "Expired",
  "30": "Expires ≤30 days",
  "60": "Expires ≤60 days",
  "90": "Expires ≤90 days",
  OK: "Valid",
};

export const EXPIRY_TIER_COLORS: Record<ExpiryTier, string> = {
  EXPIRED: "bg-red-100 text-red-800",
  "30": "bg-rose-100 text-rose-700",
  "60": "bg-amber-100 text-amber-700",
  "90": "bg-yellow-100 text-yellow-700",
  OK: "bg-emerald-100 text-emerald-700",
};

// --- B2B (Section 5) ---
export const ELIGIBILITY_OUTCOMES = {
  ELIGIBLE: "Eligible",
  NOT_ELIGIBLE: "Not Eligible",
  CONDITIONAL: "Conditionally Eligible",
} as const;

export const PARTNER_TYPES = ["Sub-agent", "Direct Partner", "Institutional Partner"] as const;

export const COMMISSION_STATUSES = { OWED: "Owed", PAID: "Paid" } as const;

// --- Communications & integrations (Section 7.10) ---
export const COMPANY_NAME = "theSFedu";

export const CHANNELS = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
} as const;
export type ChannelKey = keyof typeof CHANNELS;

// Template events. GENERIC = manual-only; the rest fire automatically.
export const TEMPLATE_EVENTS = {
  GENERIC: "Manual / Generic",
  ENROLLMENT_WELCOME: "Enrollment Welcome",
  VISA_APPROVED: "Visa Approved",
  VISA_REFUSED: "Visa Update (Refused)",
  FOLLOW_UP: "Follow-up Reminder",
} as const;

export const MESSAGE_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-emerald-100 text-emerald-700",
  SIMULATED: "bg-sky-100 text-sky-700",
  FAILED: "bg-rose-100 text-rose-700",
  RECEIVED: "bg-violet-100 text-violet-700", // inbound message (Section 7.1)
};

export function channelLabel(key: string): string {
  if (key === "PAYMENT") return "Payment Gateway";
  return (CHANNELS as Record<string, string>)[key] ?? key;
}
export function templateEventLabel(key: string): string {
  return (TEMPLATE_EVENTS as Record<string, string>)[key] ?? key;
}

// --- helpers for new domains ---
export function stageLabel(key: string): string {
  return (APPLICATION_STAGES as Record<string, string>)[key] ?? key;
}
export function paymentModeLabel(key: string): string {
  return (PAYMENT_MODES as Record<string, string>)[key] ?? key;
}
export function documentTypeLabel(key: string): string {
  return (DOCUMENT_TYPES as Record<string, string>)[key] ?? key;
}
export function eligibilityLabel(key: string): string {
  return (ELIGIBILITY_OUTCOMES as Record<string, string>)[key] ?? key;
}

// --- helpers ---
// Strip phone formatting to digits only, for duplicate detection (Section 7.2).
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function parseServices(raw: string | null | undefined): ServiceTypeKey[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ServiceTypeKey[]) : [];
  } catch {
    return [];
  }
}

export function serviceLabel(key: string): string {
  return (SERVICE_TYPES as Record<string, string>)[key] ?? key;
}

export function statusLabel(key: string): string {
  return (LEAD_STATUSES as Record<string, string>)[key] ?? key;
}

export function sourceLabel(key: string): string {
  return (LEAD_SOURCES as Record<string, string>)[key] ?? key;
}

export function verticalLabel(key: string): string {
  return (VERTICALS as Record<string, string>)[key] ?? key;
}

export function roleLabel(key: string): string {
  return (ROLES as Record<string, string>)[key] ?? key;
}
