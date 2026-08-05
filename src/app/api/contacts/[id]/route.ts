import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { list: true, emails: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!contact) return jsonError("Contact not found", 404);
  return jsonOk(contact);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Record<string, string | null | undefined>>(request);

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(body.firstName != null ? { firstName: String(body.firstName).trim() } : {}),
      ...(body.lastName != null ? { lastName: String(body.lastName).trim() } : {}),
      ...(body.email != null ? { email: String(body.email).trim().toLowerCase() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone) : null } : {}),
      ...(body.address !== undefined
        ? { address: body.address ? String(body.address) : null }
        : {}),
      ...(body.city != null ? { city: String(body.city).trim() } : {}),
      ...(body.state != null ? { state: String(body.state).trim().toUpperCase() } : {}),
      ...(body.zip !== undefined ? { zip: body.zip ? String(body.zip) : null } : {}),
      ...(body.company !== undefined
        ? { company: body.company ? String(body.company) : null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      ...(body.listId !== undefined
        ? { listId: body.listId ? String(body.listId) : null }
        : {}),
    },
    include: { list: true },
  });

  return jsonOk(contact);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return jsonOk({ ok: true });
}
