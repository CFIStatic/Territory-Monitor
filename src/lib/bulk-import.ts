import { prisma } from "@/lib/db";
import type { ContactDraft } from "@/lib/contact-import";

const BATCH_SIZE = 500;

export type BulkImportResult = {
  imported: number;
  skippedExisting: number;
  batches: number;
  listId: string;
  durationMs: number;
};

function toRow(draft: ContactDraft, listId: string) {
  return {
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
    listId,
  };
}

/**
 * High-throughput contact insert for lists in the thousands+.
 * Loads existing emails once, then writes with createMany in batches.
 */
export async function bulkInsertContacts(
  drafts: ContactDraft[],
  listId: string
): Promise<BulkImportResult> {
  const started = Date.now();

  const existing = await prisma.contact.findMany({
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((c) => c.email.toLowerCase()));

  const fresh: ReturnType<typeof toRow>[] = [];
  let skippedExisting = 0;

  for (const draft of drafts) {
    const email = draft.email.toLowerCase();
    if (existingEmails.has(email)) {
      skippedExisting += 1;
      continue;
    }
    existingEmails.add(email);
    fresh.push(toRow(draft, listId));
  }

  let imported = 0;
  let batches = 0;

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const chunk = fresh.slice(i, i + BATCH_SIZE);
    // Adapter/SQLite path: skipDuplicates is unsupported; we pre-filter emails above.
    const result = await prisma.contact.createMany({
      data: chunk,
    });
    imported += result.count;
    batches += 1;
  }

  return {
    imported,
    skippedExisting,
    batches,
    listId,
    durationMs: Date.now() - started,
  };
}
