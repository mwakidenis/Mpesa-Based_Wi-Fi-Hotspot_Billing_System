const { PrismaClient } = require('@prisma/client');

async function checkSupportRequests() {
  const prisma = new PrismaClient();

  try {
    const requests = await prisma.supportRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${requests.length} support requests:`);
    requests.forEach(req => {
      console.log(`ID: ${req.id}, Name: ${req.name}, Phone: ${req.phone}, Status: ${req.status}, Created: ${req.createdAt}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSupportRequests();