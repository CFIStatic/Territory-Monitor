import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";

type CsvRow = Record<string, string>;

function pick(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const found = Object.entries(row).find(
      ([k]) => k.trim().toLowerCase() === key.toLowerCase()
    );
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return "";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const listId = String(form.get("listId") || "") || null;
  const listName = String(form.get("listName") || "").trim();

  if (!(file instanceof File)) {
    return jsonError("CSV file is required");
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    return jsonError(`CSV parse error: ${parsed.errors[0]?.message}`);
  }

  let targetListId = listId;
  if (!targetListId && listName) {
    const list = await prisma.contactList.create({
      data: { name: listName, description: "Uploaded from CSV" },
    });
    targetListId = list.id;
  }

  const created = [];
  const skipped: string[] = [];

  for (const row of parsed.data) {
    const firstName = pick(row, ["firstName", "first_name", "first", "firstname"]);
    const lastName = pick(row, ["lastName", "last_name", "last", "lastname"]);
    const email = pick(row, ["email", "email_address", "e-mail"]);
    const city = pick(row, ["city", "town"]);
    const state = pick(row, ["state", "st", "province"]);

    if (!firstName || !lastName || !email || !city || !state) {
      skipped.push(email || `${firstName} ${lastName}`.trim() || "unknown row");
      continue;
    }

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: pick(row, ["phone", "mobile", "cell"]) || null,
        address: pick(row, ["address", "street", "address1"]) || null,
        city,
        state: state.toUpperCase(),
        zip: pick(row, ["zip", "zipcode", "postal", "postal_code"]) || null,
        company: pick(row, ["company", "organization", "org"]) || null,
        notes: pick(row, ["notes", "note"]) || null,
        listId: targetListId,
      },
    });
    created.push(contact);
  }

  return jsonOk(
    {
      imported: created.length,
      skipped: skipped.length,
      skippedSamples: skipped.slice(0, 10),
      listId: targetListId,
      contacts: created,
    },
    { status: 201 }
  );
}
