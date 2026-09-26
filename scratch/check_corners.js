import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.investigation.findFirst({
    where: { id: 35 },
  });
  console.log('Corners:', JSON.stringify(inv.lens?.corners, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
