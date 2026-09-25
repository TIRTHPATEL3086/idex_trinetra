import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const assets = await prisma.asset.count();
  const events = await prisma.decryptionEvent.count();
  const investigations = await prisma.investigation.count();
  console.log({ users, assets, events, investigations });
  const allEvents = await prisma.decryptionEvent.findMany({
    select: { id: true, markedPath: true, createdAt: true, payloadBits: true }
  });
  console.log('Events in DB:', allEvents);
}

main().catch(console.error).finally(() => prisma.$disconnect());
