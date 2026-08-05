import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");
  const city = searchParams.get("city");
  const q = searchParams.get("q");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
  const skip = (page - 1) * limit;

  const where = {
    ...(listId ? { listId } : {}),
    ...(city ? { city: { equals: city } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { city: { contains: q } },
            { company: { contains: q } },
            { spouseName: { contains: q } },
            { familyNotes: { contains: q } },
            { personalTouch: { contains: q } },
            { lastConversation: { contains: q } },
            { notes: { contains: q } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { list: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return jsonOk({
    contacts,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: Request) {
  const body = await readJson<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    company?: string;
    spouseName?: string;
    familyNotes?: string;
    personalTouch?: string;
    lastConversation?: string;
    notes?: string;
    listId?: string | null;
  }>(request);

  if (!body.firstName || !body.lastName || !body.email || !body.city || !body.state) {
    return jsonError("firstName, lastName, email, city, and state are required");
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
        zip: body.zip?.trim() || null,
        company: body.company?.trim() || null,
        spouseName: body.spouseName?.trim() || null,
        familyNotes: body.familyNotes?.trim() || null,
        personalTouch: body.personalTouch?.trim() || null,
        lastConversation: body.lastConversation?.trim() || null,
        notes: body.notes?.trim() || null,
        listId: body.listId || null,
      },
      include: { list: true },
    });
    return jsonOk(contact, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    if (message.toLowerCase().includes("unique")) {
      return jsonError("A contact with this email already exists", 409);
    }
    return jsonError(message, 400);
  }
}
