import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.investigation.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('Latest investigation:', inv);
}

main().catch(console.error).finally(() => prisma.$disconnect());
