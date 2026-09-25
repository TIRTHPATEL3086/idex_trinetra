import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.decryptionEvent.findMany({
    where: { id: { in: [31, 32, 33, 34] } },
    include: { user: true },
  });
  for (const e of events) {
    console.log({
      id: e.id,
      officer: e.user.name,
      createdAt: e.createdAt,
      deviceLabel: e.deviceLabel,
      shortId: e.shortId.toString(),
      payloadBits: e.payloadBits,
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
