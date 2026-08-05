import Papa from "papaparse";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  company?: string | null;
  spouseName?: string | null;
  familyNotes?: string | null;
  personalTouch?: string | null;
  lastConversation?: string | null;
  notes?: string | null;
};

export type ParseResult = {
  contacts: ContactDraft[];
  skipped: string[];
  source: string;
  format: "csv" | "excel" | "pdf" | "unknown";
};

type Row = Record<string, string>;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/;
const STATE_RE = /\b([A-Z]{2})\b/;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
const CITY_STATE_ZIP_RE =
  /([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)?/;

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pick(row: Row, keys: string[]): string {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), String(v ?? "").trim()])
  );
  for (const key of keys) {
    const value = normalized[normalizeKey(key)];
    if (value) return value;
  }
  return "";
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = fullName.replace(/\s+/g, " ").trim();
  if (!cleaned) return { firstName: "", lastName: "" };
  if (cleaned.includes(",")) {
    const [last, ...rest] = cleaned.split(",").map((p) => p.trim());
    return { firstName: rest.join(" ").trim(), lastName: last };
  }
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "Unknown" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function parseCityState(value: string): { city: string; state: string; zip: string } {
  const match = value.match(CITY_STATE_ZIP_RE);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim().toUpperCase(),
      zip: (match[3] || "").trim(),
    };
  }
  return { city: "", state: "", zip: "" };
}

function rowToContact(row: Row): ContactDraft | null {
  let firstName = pick(row, [
    "first_name",
    "firstname",
    "first",
    "given_name",
    "fname",
  ]);
  let lastName = pick(row, [
    "last_name",
    "lastname",
    "last",
    "surname",
    "lname",
    "family_name",
  ]);
  const fullName = pick(row, ["name", "full_name", "contact", "contact_name", "customer"]);

  if ((!firstName || !lastName) && fullName) {
    const split = splitName(fullName);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }

  const email = pick(row, [
    "email",
    "email_address",
    "e_mail",
    "mail",
    "primary_email",
  ]).toLowerCase();

  let city = pick(row, ["city", "town", "municipality"]);
  let state = pick(row, ["state", "st", "province", "region"]).toUpperCase();
  let zip = pick(row, ["zip", "zipcode", "zip_code", "postal", "postal_code"]);

  const cityState = pick(row, ["city_state", "city_st", "location", "locale"]);
  if ((!city || !state) && cityState) {
    const parsed = parseCityState(cityState);
    city = city || parsed.city;
    state = state || parsed.state;
    zip = zip || parsed.zip;
  }

  const address = pick(row, [
    "address",
    "street",
    "street_address",
    "address1",
    "address_1",
    "addr",
  ]);
  const address2 = pick(row, ["address2", "address_2", "suite", "unit"]);

  // Handle "Milwaukee WI" style in city field
  if (city && !state) {
    const parts = city.trim().split(/\s+/);
    const maybeState = parts[parts.length - 1]?.toUpperCase();
    if (maybeState && US_STATES.has(maybeState)) {
      state = maybeState;
      city = parts.slice(0, -1).join(" ");
    }
  }

  if (!firstName || !lastName || !email || !city || !state) {
    return null;
  }

  if (!EMAIL_RE.test(email)) return null;

  return {
    firstName,
    lastName,
    email,
    phone: pick(row, ["phone", "mobile", "cell", "telephone", "phone_number"]) || null,
    address: [address, address2].filter(Boolean).join(", ") || null,
    city,
    state: state.slice(0, 2).toUpperCase(),
    zip: zip || null,
    company:
      pick(row, ["company", "organization", "org", "business", "account"]) || null,
    spouseName:
      pick(row, ["spouse", "spouse_name", "partner", "partner_name", "husband", "wife"]) ||
      null,
    familyNotes:
      pick(row, [
        "family",
        "family_notes",
        "kids",
        "children",
        "pets",
        "family_details",
      ]) || null,
    personalTouch:
      pick(row, [
        "personal_touch",
        "personal",
        "hobby",
        "hobbies",
        "interests",
        "home_notes",
      ]) || null,
    lastConversation:
      pick(row, [
        "last_conversation",
        "last_talked",
        "last_call",
        "remember",
        "memories",
      ]) || null,
    notes: pick(row, ["notes", "note", "comment", "comments"]) || null,
  };
}

function rowsToContacts(rows: Row[], source: string, format: ParseResult["format"]): ParseResult {
  const contacts: ContactDraft[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const contact = rowToContact(row);
    if (!contact) {
      const hint =
        pick(row, ["email", "name", "first_name", "last_name"]) ||
        Object.values(row).filter(Boolean).slice(0, 2).join(" ") ||
        "unknown row";
      skipped.push(hint);
      continue;
    }
    const key = contact.email.toLowerCase();
    if (seen.has(key)) {
      skipped.push(`${contact.email} (duplicate in file)`);
      continue;
    }
    seen.add(key);
    contacts.push(contact);
  }

  return { contacts, skipped, source, format };
}

function detectFormat(fileName: string, mimeType = ""): ParseResult["format"] {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") || mime.includes("csv")) {
    return "csv";
  }
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    return "excel";
  }
  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    return "pdf";
  }
  return "unknown";
}

export async function parseCsvBuffer(buffer: Buffer, source: string): Promise<ParseResult> {
  const text = buffer.toString("utf8");
  const delimiter = source.toLowerCase().endsWith(".tsv") ? "\t" : undefined;
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length && parsed.data.length === 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0]?.message}`);
  }

  return rowsToContacts(parsed.data, source, "csv");
}

export async function parseExcelBuffer(buffer: Buffer, source: string): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const allRows: Row[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Row>(sheet, {
      defval: "",
      raw: false,
    });
    allRows.push(...json);
  }

  if (allRows.length === 0) {
    throw new Error("Excel file has no readable rows");
  }

  return rowsToContacts(allRows, source, "excel");
}

function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    (lower.includes("email") || lower.includes("e-mail")) &&
    (lower.includes("name") || lower.includes("first") || lower.includes("city"))
  );
}

function splitLooseColumns(line: string, expectedCols?: number): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim()).filter(Boolean);
  if (line.includes("|")) return line.split("|").map((c) => c.trim()).filter(Boolean);
  if ((line.match(/,/g) || []).length >= 3) {
    return line.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
  }
  const multiSpace = line.split(/\s{2,}|\s;\s/).map((c) => c.trim()).filter(Boolean);
  if (multiSpace.length >= 3) return multiSpace;

  // Fallback: single-space split when header told us column count
  if (expectedCols && expectedCols >= 3) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= expectedCols) {
      // Keep first N-1 tokens as columns, remainder joins into last column
      return [...parts.slice(0, expectedCols - 1), parts.slice(expectedCols - 1).join(" ")];
    }
  }
  return multiSpace;
}

function parsePdfAsTable(text: string, source: string): ParseResult | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headerIdx = lines.findIndex(looksLikeHeader);
  if (headerIdx === -1) return null;

  // Prefer explicit delimiters; for spaced headers like "firstName lastName email..."
  let headers = splitLooseColumns(lines[headerIdx]).map(normalizeKey);
  if (headers.length < 3 && /first(name)?|email|city/i.test(lines[headerIdx])) {
    headers = lines[headerIdx]
      .trim()
      .split(/\s+/)
      .map(normalizeKey)
      .filter(Boolean);
  }
  if (headers.length < 3) return null;

  const rows: Row[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (looksLikeHeader(line)) continue;
    if (/^freeform/i.test(line)) break;
    const cols = splitLooseColumns(line, headers.length);
    if (cols.length < 2) continue;
    const row: Row = {};
    headers.forEach((header, i) => {
      row[header] = cols[i] || "";
    });
    if (cols.length > headers.length) {
      row.notes = cols.slice(headers.length).join(" ");
    }
    rows.push(row);
  }

  if (rows.length === 0) return null;
  return rowsToContacts(rows, source, "pdf");
}

function parsePdfFreeform(text: string, source: string): ParseResult {
  const contacts: ContactDraft[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  // Split into blocks around emails
  const blocks = text.split(/\n{2,}/);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Also scan sliding windows of consecutive lines
  const windows: string[] = [...blocks];
  for (let i = 0; i < lines.length; i++) {
    windows.push(lines.slice(i, i + 5).join("\n"));
  }

  for (const block of windows) {
    const emailMatch = block.match(EMAIL_RE);
    if (!emailMatch) continue;
    const email = emailMatch[0].toLowerCase();
    if (seen.has(email)) continue;

    const phoneMatch = block.match(PHONE_RE);
    const cityStateMatch = block.match(CITY_STATE_ZIP_RE);
    const zipMatch = block.match(ZIP_RE);
    const stateMatch = block.match(STATE_RE);

    const withoutEmail = block
      .replace(EMAIL_RE, " ")
      .replace(PHONE_RE, " ")
      .replace(CITY_STATE_ZIP_RE, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Prefer a capitalized name-looking token sequence
    const nameMatch =
      withoutEmail.match(
        /\b([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,3})\b/
      ) || withoutEmail.match(/([A-Za-z'’-]+,\s*[A-Za-z'’-]+)/);

    if (!nameMatch || !cityStateMatch) {
      skipped.push(email);
      continue;
    }

    const { firstName, lastName } = splitName(nameMatch[1]);
    const city = cityStateMatch[1].trim();
    const state = cityStateMatch[2].trim().toUpperCase();
    const zip = (cityStateMatch[3] || zipMatch?.[1] || "").trim();

    if (!firstName || !lastName || !US_STATES.has(state)) {
      skipped.push(email);
      continue;
    }

    seen.add(email);
    contacts.push({
      firstName,
      lastName,
      email,
      phone: phoneMatch?.[0] || null,
      address: null,
      city,
      state: stateMatch?.[1] && US_STATES.has(stateMatch[1]) ? stateMatch[1] : state,
      zip: zip || null,
      company: null,
      notes: "Extracted from PDF",
    });
  }

  return { contacts, skipped, source, format: "pdf" };
}

export async function parsePdfBuffer(buffer: Buffer, source: string): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  const text = data.text || "";
  if (!text.trim()) {
    throw new Error("PDF has no extractable text. Try exporting as CSV/Excel or a text-based PDF.");
  }

  const tableResult = parsePdfAsTable(text, source);
  const freeform = parsePdfFreeform(text, source);

  const seen = new Set<string>();
  const contacts: ContactDraft[] = [];

  for (const contact of [...(tableResult?.contacts ?? []), ...freeform.contacts]) {
    const key = contact.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push(contact);
  }

  const skipped = [...(tableResult?.skipped ?? []), ...freeform.skipped].filter((item) => {
    const emailMatch = item.match(EMAIL_RE);
    return !(emailMatch && seen.has(emailMatch[0].toLowerCase()));
  });

  if (contacts.length === 0) {
    throw new Error(
      "Could not find contacts in PDF. Include name, email, and city/state (e.g. Milwaukee, WI 53202)."
    );
  }

  return { contacts, skipped, source, format: "pdf" };
}

export async function parseContactFile(
  file: File | { name: string; type?: string; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<ParseResult> {
  const format = detectFormat(file.name, file.type || "");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (format === "csv") return parseCsvBuffer(buffer, file.name);
  if (format === "excel") return parseExcelBuffer(buffer, file.name);
  if (format === "pdf") return parsePdfBuffer(buffer, file.name);

  // Fallback sniffing
  const head = buffer.subarray(0, 8).toString("utf8");
  if (head.startsWith("%PDF")) return parsePdfBuffer(buffer, file.name);
  if (head.charCodeAt(0) === 0x50 && head.charCodeAt(1) === 0x4b) {
    return parseExcelBuffer(buffer, file.name); // zip/xlsx
  }
  return parseCsvBuffer(buffer, file.name);
}

export async function parseContactFiles(files: File[]): Promise<{
  contacts: ContactDraft[];
  skipped: string[];
  files: Array<{ name: string; format: string; imported: number; skipped: number }>;
}> {
  const contacts: ContactDraft[] = [];
  const skipped: string[] = [];
  const fileSummaries = [];
  const seen = new Set<string>();

  for (const file of files) {
    const result = await parseContactFile(file);
    let imported = 0;
    for (const contact of result.contacts) {
      const key = contact.email.toLowerCase();
      if (seen.has(key)) {
        skipped.push(`${contact.email} (duplicate across uploads)`);
        continue;
      }
      seen.add(key);
      contacts.push(contact);
      imported += 1;
    }
    skipped.push(...result.skipped.map((s) => `${file.name}: ${s}`));
    fileSummaries.push({
      name: file.name,
      format: result.format,
      imported,
      skipped: result.skipped.length,
    });
  }

  return { contacts, skipped, files: fileSummaries };
}
