const { PrismaClient } = require('@prisma/client');
const { resetFixtures } = require('./fixtures');
const { resetUsers } = require('./users');

const prisma = new PrismaClient();

async function main() {
  await resetUsers(prisma);
  await resetFixtures(prisma);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => prisma.$disconnect());
