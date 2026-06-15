// Seed data: branches, a user per major role, B2B partners, and sample leads.
// Run with: npm run db:seed   (or it runs as part of `npm run setup`)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "Password123!";

async function main() {
  console.log("Seeding database…");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Branches ---
  const ho = await prisma.branch.upsert({
    where: { code: "HO" },
    update: {},
    create: {
      code: "HO",
      name: "Head Office",
      address: "Head Office",
      isHeadOffice: true,
    },
  });
  const chd = await prisma.branch.upsert({
    where: { code: "CHD" },
    update: {},
    create: { code: "CHD", name: "Chandigarh Branch", address: "Chandigarh" },
  });
  const ldh = await prisma.branch.upsert({
    where: { code: "LDH" },
    update: {},
    create: { code: "LDH", name: "Ludhiana Branch", address: "Ludhiana" },
  });

  // --- Users (one per major role) ---
  const users: {
    email: string;
    name: string;
    role: string;
    vertical?: string;
    branchId?: string;
  }[] = [
    { email: "admin@thesfedu.com", name: "System Admin", role: "ADMIN" },
    { email: "vp@thesfedu.com", name: "Vandana (VP)", role: "VP" },
    { email: "manager@thesfedu.com", name: "Branch Manager", role: "BRANCH_MANAGER", branchId: chd.id },
    { email: "reception@thesfedu.com", name: "Reception Desk", role: "RECEPTION", branchId: chd.id },
    { email: "tl.direct@thesfedu.com", name: "TL Direct", role: "B2C_TL_DIRECT", vertical: "B2C_DIRECT", branchId: chd.id },
    { email: "tl.career@thesfedu.com", name: "TL Career Desk", role: "B2C_TL_CAREER", vertical: "B2C_CAREER", branchId: chd.id },
    { email: "counselor.direct@thesfedu.com", name: "Ravi (Direct Counselor)", role: "B2C_COUNSELOR_DIRECT", vertical: "B2C_DIRECT", branchId: chd.id },
    { email: "counselor.career@thesfedu.com", name: "Simran (Career Counselor)", role: "B2C_COUNSELOR_CAREER", vertical: "B2C_CAREER", branchId: chd.id },
    { email: "backend.canada@thesfedu.com", name: "Backend - Canada", role: "BACKEND_COUNSELOR", branchId: ho.id },
    { email: "admissions@thesfedu.com", name: "Admissions Officer", role: "ADMISSIONS", branchId: ho.id },
    { email: "filling@thesfedu.com", name: "Filling Team", role: "FILLING", branchId: ho.id },
    { email: "destmanager@thesfedu.com", name: "Destination Manager", role: "DESTINATION_MANAGER", branchId: ho.id },
    { email: "bdm@thesfedu.com", name: "Business Dev Manager", role: "BDM", branchId: ho.id },
    { email: "b2b@thesfedu.com", name: "B2B Counselor", role: "B2B_COUNSELOR", vertical: "B2B", branchId: ho.id },
  ];

  const created: Record<string, string> = {};
  for (const u of users) {
    const rec = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, vertical: u.vertical ?? null, branchId: u.branchId ?? null },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        vertical: u.vertical ?? null,
        branchId: u.branchId ?? null,
        passwordHash,
      },
    });
    created[u.role] = rec.id;
  }

  // --- B2B Partner ---
  const partner = await prisma.b2BPartner.upsert({
    where: { id: "seed-partner-1" },
    update: {},
    create: {
      id: "seed-partner-1",
      companyName: "Global Edu Partners",
      contactName: "Amit Sharma",
      contactPhone: "+91 98000 11111",
      contactEmail: "amit@globaledu.example",
      partnerType: "Direct Partner",
      assignedBdmId: created["BDM"],
    },
  });

  // --- Service packages (config) ---
  const packages = [
    { id: "pkg-canada-premium", name: "Study Visa Canada Premium", serviceCategory: "STUDY_VISA", basePrice: 50000, taxRate: 18, allowInstallments: true },
    { id: "pkg-career-basic", name: "Career Counselling Basic", serviceCategory: "CAREER_COUNSELLING", basePrice: 8000, taxRate: 18, allowInstallments: false },
    { id: "pkg-ielts", name: "IELTS Preparation", serviceCategory: "IELTS_PREP", basePrice: 12000, taxRate: 18, allowInstallments: false },
  ];
  for (const p of packages) {
    await prisma.servicePackage.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  // --- Institutions (config) ---
  const institutions = [
    { id: "inst-uoft", name: "University of Toronto", country: "Canada" },
    { id: "inst-ubc", name: "University of British Columbia", country: "Canada" },
    { id: "inst-melb", name: "University of Melbourne", country: "Australia" },
    { id: "inst-auckland", name: "University of Auckland", country: "New Zealand" },
  ];
  for (const i of institutions) {
    await prisma.institution.upsert({ where: { id: i.id }, update: {}, create: i });
  }

  // --- Default message templates (Section 7.8 / 7.10) ---
  const templates = [
    { id: "tpl-welcome-wa", name: "Enrollment Welcome (WhatsApp)", channel: "WHATSAPP", event: "ENROLLMENT_WELCOME", subject: null as string | null, body: "Hi {{name}}, welcome to {{company}}! 🎉 Your enrollment is confirmed. Your counselor {{counselor}} will guide you through the next steps." },
    { id: "tpl-welcome-email", name: "Enrollment Welcome (Email)", channel: "EMAIL", event: "ENROLLMENT_WELCOME", subject: "Welcome to {{company}}!", body: "Dear {{name}},\n\nWelcome to {{company}}! Your enrollment is confirmed and your counselor {{counselor}} will be in touch shortly.\n\nWarm regards,\n{{company}} Team" },
    { id: "tpl-visa-approved", name: "Visa Approved (SMS)", channel: "SMS", event: "VISA_APPROVED", subject: null, body: "Congratulations {{name}}! Your {{country}} visa has been APPROVED. - {{company}}" },
    { id: "tpl-visa-refused", name: "Visa Update (WhatsApp)", channel: "WHATSAPP", event: "VISA_REFUSED", subject: null, body: "Hi {{name}}, there is an important update on your {{country}} application. Please contact your counselor at {{company}} to discuss next steps." },
    { id: "tpl-followup-wa", name: "Follow-up (WhatsApp)", channel: "WHATSAPP", event: "FOLLOW_UP", subject: null, body: "Hi {{name}}, just following up on your enquiry with {{company}}. Are you free for a quick call? - {{counselor}}" },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.upsert({ where: { id: t.id }, update: {}, create: t });
  }

  // --- Sample leads (only if none exist) ---
  const leadCount = await prisma.lead.count();
  if (leadCount === 0) {
    const directCounselor = created["B2C_COUNSELOR_DIRECT"];
    const careerCounselor = created["B2C_COUNSELOR_CAREER"];
    const reception = created["RECEPTION"];

    const lead1 = await prisma.lead.create({
      data: {
        fullName: "Harpreet Kaur",
        phone: "+91 98765 43210",
        phoneNormalized: "919876543210",
        isWhatsapp: true,
        email: "harpreet@example.com",
        source: "WALK_IN",
        vertical: "B2C_DIRECT",
        services: JSON.stringify(["STUDY_VISA", "IELTS_PREP"]),
        status: "CONTACTED",
        notes: "Interested in Canada study visa, Sept intake.",
        branchId: chd.id,
        enteredById: reception,
        counselors: { create: [{ userId: directCounselor, stream: "DIRECT" }] },
        statusHistory: { create: [{ toStatus: "CONTACTED", fromStatus: "NEW", changedById: reception }] },
      },
    });

    await prisma.lead.create({
      data: {
        fullName: "Rohit Verma",
        phone: "+91 91234 56789",
        phoneNormalized: "919123456789",
        isWhatsapp: true,
        source: "SOCIAL_MEDIA",
        sourceSubType: "Instagram",
        vertical: "BOTH",
        services: JSON.stringify(["CAREER_COUNSELLING", "PSYCHOMETRIC", "STUDY_VISA"]),
        status: "INTERESTED",
        notes: "Wants career counselling + study options.",
        branchId: chd.id,
        enteredById: reception,
        counselors: {
          create: [
            { userId: directCounselor, stream: "DIRECT" },
            { userId: careerCounselor, stream: "CAREER" },
          ],
        },
      },
    });

    const lead3 = await prisma.lead.create({
      data: {
        fullName: "Neha Gupta",
        phone: "+91 99887 76655",
        phoneNormalized: "919988776655",
        source: "B2B_PARTNER",
        vertical: "B2B",
        services: JSON.stringify(["STUDY_VISA", "OFFER_LETTER"]),
        status: "NEW",
        branchId: ho.id,
        partnerId: partner.id,
        enteredById: created["B2B_COUNSELOR"],
      },
    });

    // a follow-up task
    await prisma.task.create({
      data: {
        title: "Call Harpreet for document collection",
        priority: "HIGH",
        status: "PENDING",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        leadId: lead1.id,
        assignedToId: directCounselor,
        createdById: reception,
      },
    });

    // Enroll Harpreet (lead1) onto the Canada package, with a part payment.
    await prisma.lead.update({ where: { id: lead1.id }, data: { status: "ENROLLED" } });
    await prisma.leadStatusHistory.create({
      data: { leadId: lead1.id, fromStatus: "CONTACTED", toStatus: "ENROLLED", changedById: directCounselor },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        leadId: lead1.id,
        enrolledById: directCounselor,
        discountAmount: 5000,
        paymentStatus: "PARTIAL",
        items: {
          create: [
            { packageId: "pkg-canada-premium", price: 50000, taxRate: 18 },
            { packageId: "pkg-ielts", price: 12000, taxRate: 18 },
          ],
        },
      },
    });
    await prisma.payment.create({
      data: {
        enrollmentId: enrollment.id,
        amount: 30000,
        mode: "UPI",
        receiptNumber: "RCPT-1001",
        recordedById: directCounselor,
      },
    });

    // A Canada application for Harpreet at the OL-Applied stage.
    await prisma.application.create({
      data: {
        leadId: lead1.id,
        country: "Canada",
        currentStage: "ST_2",
        institutionId: "inst-uoft",
        program: "MSc Computer Science",
        intake: "Sept 2026",
        backendCounselorId: created["BACKEND_COUNSELOR"],
        admissionsOfficerId: created["ADMISSIONS"],
        stageHistory: {
          create: [
            { stageCode: "ST_1", byId: created["BACKEND_COUNSELOR"], note: "Study options shared" },
            { stageCode: "ST_2", byId: created["ADMISSIONS"], note: "Applied to University of Toronto" },
          ],
        },
      },
    });

    // A B2B assessment + commission for the partner-sourced lead (Neha).
    await prisma.assessment.create({
      data: {
        studentName: "Neha Gupta",
        leadId: lead3.id,
        partnerId: partner.id,
        bdmId: created["BDM"],
        country: "Australia",
        program: "MBA",
        eligibilityOutcome: "ELIGIBLE",
        notes: "Strong profile, 7.0 IELTS.",
        enteredById: created["B2B_COUNSELOR"],
      },
    });
    await prisma.commission.create({
      data: { partnerId: partner.id, amount: 15000, status: "OWED", note: "Neha Gupta enrollment" },
    });
  }

  console.log("Seed complete.");
  console.log("\nLogin with any of these (password for all: " + DEFAULT_PASSWORD + "):");
  console.log("  admin@thesfedu.com            (System Administrator)");
  console.log("  vp@thesfedu.com               (VP / Management)");
  console.log("  reception@thesfedu.com        (Reception Staff)");
  console.log("  counselor.direct@thesfedu.com (B2C Counselor - Direct)");
  console.log("  bdm@thesfedu.com              (Business Development Manager)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
