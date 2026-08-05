import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");
  const city = searchParams.get("city");
  const q = searchParams.get("q");

  const contacts = await prisma.contact.findMany({
    where: {
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
            ],
          }
        : {}),
    },
    include: { list: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return jsonOk(contacts);
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
    notes?: string;
    listId?: string | null;
  }>(request);

  if (!body.firstName || !body.lastName || !body.email || !body.city || !body.state) {
    return jsonError("firstName, lastName, email, city, and state are required");
  }

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
      notes: body.notes?.trim() || null,
      listId: body.listId || null,
    },
    include: { list: true },
  });

  return jsonOk(contact, { status: 201 });
}
