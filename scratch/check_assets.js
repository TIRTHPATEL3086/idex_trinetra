import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany();
  console.log('Assets in DB:', assets.map(a => ({ id: a.id, title: a.title, cipherPath: a.cipherPath })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
