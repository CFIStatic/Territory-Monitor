import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { parseContactFiles } from "@/lib/contact-import";
import { bulkInsertContacts } from "@/lib/bulk-import";
import { scanUploadFile } from "@/lib/security/malware-scan";
import { guardRequest } from "@/lib/security/guard";
import { logSecurityEvent } from "@/lib/security/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file
const MAX_CONTACTS = 100_000;
const MAX_FILES = 20;

function collectFiles(form: FormData): File[] {
  const files: File[] = [];

  for (const key of ["files", "file"]) {
    for (const value of form.getAll(key)) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }
  }

  const seen = new Set<string>();
  return files.filter((f) => {
    const key = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "contacts-upload",
    limit: 10,
    windowMs: 60_000,
    requireAuth: true,
  });
  if (blocked) return blocked;

  try {
    const form = await request.formData();
    const files = collectFiles(form);
    const listId = String(form.get("listId") || "") || null;
    const listName = String(form.get("listName") || "").trim();

    if (files.length === 0) {
      return jsonError(
        "Upload one or more CSV, Excel (.xlsx/.xls), or PDF contact files for bulk import"
      );
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Too many files (max ${MAX_FILES} per upload)`);
    }

    const tooLarge = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooLarge.length) {
      return jsonError(
        `File too large (max 50MB each): ${tooLarge.map((f) => f.name).join(", ")}`
      );
    }

    // Cyber defense: signature scan every file before parsers run
    const scanResults = [];
    for (const file of files) {
      const verdict = await scanUploadFile(file);
      scanResults.push({
        name: file.name,
        ok: verdict.ok,
        threat: verdict.threat,
        format: verdict.format,
        bytes: verdict.bytes,
        details: verdict.details,
      });
      if (!verdict.ok) {
        logSecurityEvent("malware_block", `Blocked upload: ${file.name}`, {
          threat: verdict.threat,
          details: verdict.details,
          bytes: verdict.bytes,
        });
        return jsonError(
          `Malware defense blocked "${file.name}": ${verdict.details.join("; ") || verdict.threat}`,
          422
        );
      }
    }

    const parsed = await parseContactFiles(files);

    if (parsed.contacts.length === 0) {
      return jsonError(
        `No valid contacts found. Need first/last name (or full name), email, city, and state. Skipped ${parsed.skipped.length} rows.`
      );
    }

    if (parsed.contacts.length > MAX_CONTACTS) {
      return jsonError(
        `This file has ${parsed.contacts.length.toLocaleString()} valid contacts. Max per upload is ${MAX_CONTACTS.toLocaleString()}. Split the file and try again.`
      );
    }

    let targetListId = listId;
    if (!targetListId) {
      const defaultName =
        listName ||
        (files.length === 1
          ? files[0].name.replace(/\.[^.]+$/, "")
          : `Bulk import ${new Date().toLocaleDateString()}`);
      const list = await prisma.contactList.create({
        data: {
          name: defaultName,
          description: `Bulk uploaded from ${files.map((f) => f.name).join(", ")} (${parsed.contacts.length.toLocaleString()} rows parsed)`,
        },
      });
      targetListId = list.id;
    }

    const bulk = await bulkInsertContacts(parsed.contacts, targetListId);
    const skippedParse = parsed.skipped.length;
    const totalSkipped = skippedParse + bulk.skippedExisting;

    const sample = await prisma.contact.findMany({
      where: { listId: targetListId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const totalInList = await prisma.contact.count({ where: { listId: targetListId } });
    const totalContacts = await prisma.contact.count();

    return jsonOk(
      {
        ok: true,
        mode: "bulk",
        imported: bulk.imported,
        skipped: totalSkipped,
        skippedExisting: bulk.skippedExisting,
        skippedParse,
        skippedSamples: parsed.skipped.slice(0, 15),
        parsed: parsed.contacts.length,
        batches: bulk.batches,
        durationMs: bulk.durationMs,
        listId: targetListId,
        listCount: totalInList,
        workspaceCount: totalContacts,
        security: {
          scanned: scanResults.length,
          blocked: 0,
          scans: scanResults,
          defense: "signature_scan",
        },
        files: parsed.files.map((f) => ({
          ...f,
          sizeBytes: files.find((x) => x.name === f.name)?.size ?? null,
        })),
        formats: [...new Set(parsed.files.map((f) => f.format))],
        sample,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk upload failed";
    console.error("[bulk upload]", error);
    return jsonError(message, 400);
  }
}
