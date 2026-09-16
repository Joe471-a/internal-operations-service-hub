const { PrismaClient } = require('@prisma/client');
const { resetFixtures } = require('./fixtures');

const prisma = new PrismaClient();

async function main() {
  await resetFixtures(prisma);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => prisma.$disconnect());
