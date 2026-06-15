import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Local file storage for document uploads. Files live in `uploads/` at the project
// root (outside /public, so they are only served through the authenticated
// /api/documents/[id] download route). For multi-server VPS deploys this can later
// be swapped for S3-compatible object storage behind the same interface.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function randomStoredName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return crypto.randomBytes(16).toString("hex") + ext;
}

export async function saveUpload(storedName: string, data: Buffer): Promise<void> {
  await ensureUploadDir();
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), data);
}

export async function readUpload(storedName: string): Promise<Buffer> {
  // Guard against path traversal — only a bare filename is allowed.
  const safe = path.basename(storedName);
  return fs.readFile(path.join(UPLOAD_DIR, safe));
}

export async function deleteUpload(storedName: string): Promise<void> {
  const safe = path.basename(storedName);
  await fs.unlink(path.join(UPLOAD_DIR, safe)).catch(() => {});
}
