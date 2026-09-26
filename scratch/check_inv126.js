import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.investigation.findFirst({
    where: { id: 126 },
  });
  console.log('Investigation 126:', JSON.stringify(inv, null, 2));

  // Find all decryption events
  const events = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { asset: true, user: true },
  });
  console.log('Recent decryption events:');
  for (const e of events) {
    console.log({
      id: e.id,
      shortId: e.shortId,
      user: e.user.name,
      asset: e.asset.title,
      markedPath: e.markedPath,
      payloadBits: e.payloadBits,
      createdAt: e.createdAt,
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
