import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";

export async function GET() {
  const lists = await prisma.contactList.findMany({
    include: {
      _count: { select: { contacts: true, rules: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(lists);
}

export async function POST(request: Request) {
  const body = await readJson<{ name?: string; description?: string }>(request);
  if (!body.name?.trim()) return jsonError("name is required");

  const list = await prisma.contactList.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
    },
  });
  return jsonOk(list, { status: 201 });
}
