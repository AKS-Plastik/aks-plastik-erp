const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const count = await prisma.productionTask.updateMany({
    where: { date: '' },
    data: { date: today }
  });
  console.log(`Updated ${count.count} tasks with date = ${today}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
