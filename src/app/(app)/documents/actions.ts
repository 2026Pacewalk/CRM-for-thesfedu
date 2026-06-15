"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_UPLOAD_DOCS } from "@/lib/rbac";
import { saveUpload, deleteUpload, randomStoredName } from "@/lib/storage";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES, DOCUMENT_TYPES } from "@/lib/constants";

export type UploadState = { error?: string; ok?: boolean };

// Upload a document against a lead and/or an application (Section 4.5 & 7.5).
// Maintains a version number per (lead/application + type).
export async function uploadDocumentAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_UPLOAD_DOCS)) return { error: "Not permitted." };

  const leadId = String(formData.get("leadId") ?? "") || null;
  const applicationId = String(formData.get("applicationId") ?? "") || null;
  const type = String(formData.get("type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!Object.keys(DOCUMENT_TYPES).includes(type)) return { error: "Choose a document type." };
  if (!file || file.size === 0) return { error: "Select a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File exceeds the 20 MB limit." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return { error: `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = randomStoredName(file.name);
  await saveUpload(storedName, buffer);

  const priorVersions = await prisma.document.count({
    where: { type, leadId: leadId ?? undefined, applicationId: applicationId ?? undefined },
  });

  await prisma.document.create({
    data: {
      type,
      label: label || null,
      fileName: file.name,
      storedName,
      mimeType: file.type || null,
      fileSize: file.size,
      version: priorVersions + 1,
      leadId,
      applicationId,
      uploadedById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Document", entityId: leadId ?? applicationId },
  });

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
  return { ok: true };
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_UPLOAD_DOCS)) return;

  const id = String(formData.get("id"));
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return;

  await deleteUpload(doc.storedName);
  await prisma.document.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "DELETE", entityType: "Document", entityId: id },
  });

  if (doc.leadId) revalidatePath(`/leads/${doc.leadId}`);
  if (doc.applicationId) revalidatePath(`/applications/${doc.applicationId}`);
}
