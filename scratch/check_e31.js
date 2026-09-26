import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const e31 = await prisma.decryptionEvent.findUnique({
    where: { id: 31 },
    include: { user: true, asset: true },
  });
  console.log('Event 31:', e31);
}

main().catch(console.error).finally(() => prisma.$disconnect());
