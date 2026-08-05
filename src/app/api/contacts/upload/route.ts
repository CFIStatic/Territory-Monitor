import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { parseContactFiles } from "@/lib/contact-import";

export const runtime = "nodejs";

function collectFiles(form: FormData): File[] {
  const files: File[] = [];

  for (const key of ["files", "file"]) {
    for (const value of form.getAll(key)) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }
  }

  // De-dupe by name+size+lastModified
  const seen = new Set<string>();
  return files.filter((f) => {
    const key = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = collectFiles(form);
    const listId = String(form.get("listId") || "") || null;
    const listName = String(form.get("listName") || "").trim();

    if (files.length === 0) {
      return jsonError("Upload one or more CSV, Excel (.xlsx/.xls), or PDF contact files");
    }

    const unsupported = files.filter((f) => {
      const n = f.name.toLowerCase();
      return !(
        n.endsWith(".csv") ||
        n.endsWith(".tsv") ||
        n.endsWith(".txt") ||
        n.endsWith(".xlsx") ||
        n.endsWith(".xls") ||
        n.endsWith(".xlsm") ||
        n.endsWith(".pdf")
      );
    });
    if (unsupported.length) {
      return jsonError(
        `Unsupported file type: ${unsupported.map((f) => f.name).join(", ")}. Use CSV, Excel, or PDF.`
      );
    }

    const parsed = await parseContactFiles(files);

    if (parsed.contacts.length === 0) {
      return jsonError(
        `No valid contacts found. Need first/last name (or full name), email, city, and state. Skipped ${parsed.skipped.length} rows.`
      );
    }

    let targetListId = listId;
    if (!targetListId) {
      const defaultName =
        listName ||
        (files.length === 1
          ? files[0].name.replace(/\.[^.]+$/, "")
          : `Import ${new Date().toLocaleDateString()}`);
      const list = await prisma.contactList.create({
        data: {
          name: defaultName,
          description: `Uploaded from ${files.map((f) => f.name).join(", ")}`,
        },
      });
      targetListId = list.id;
    } else if (listName) {
      // optional rename ignored; list already selected
    }

    const created = [];
    const skipped = [...parsed.skipped];

    for (const draft of parsed.contacts) {
      const existing = await prisma.contact.findFirst({
        where: { email: draft.email.toLowerCase() },
      });
      if (existing) {
        skipped.push(`${draft.email} (already in workspace)`);
        continue;
      }

      const contact = await prisma.contact.create({
        data: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email.toLowerCase(),
          phone: draft.phone || null,
          address: draft.address || null,
          city: draft.city,
          state: draft.state.toUpperCase(),
          zip: draft.zip || null,
          company: draft.company || null,
          spouseName: draft.spouseName || null,
          familyNotes: draft.familyNotes || null,
          personalTouch: draft.personalTouch || null,
          lastConversation: draft.lastConversation || null,
          notes: draft.notes || null,
          listId: targetListId,
        },
      });
      created.push(contact);
    }

    return jsonOk(
      {
        imported: created.length,
        skipped: skipped.length,
        skippedSamples: skipped.slice(0, 15),
        listId: targetListId,
        files: parsed.files,
        formats: [...new Set(parsed.files.map((f) => f.format))],
        contacts: created,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return jsonError(message, 400);
  }
}
