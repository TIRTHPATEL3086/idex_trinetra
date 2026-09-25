import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { asset: true, user: true },
  });
  console.log(`Found ${events.length} decryption events:`);
  for (const e of events) {
    console.log({
      id: e.id,
      shortId: e.shortId,
      user: e.user.name,
      asset: e.asset.title,
      markedPath: e.markedPath,
      payloadBits: e.payloadBits,
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
