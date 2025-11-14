const { PrismaClient } = require('@prisma/client');

async function checkUser() {
  const prisma = new PrismaClient();

  try {
    const users = await prisma.authUser.findMany({
      select: {
        id: true,
        username: true,
        phone: true
      }
    });

    console.log('Users in database:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Phone: ${user.phone}`);
    });

    // Check support requests
    const requests = await prisma.supportRequest.findMany({
      select: {
        id: true,
        phone: true,
        status: true
      }
    });

    console.log('\nSupport requests:');
    requests.forEach(req => {
      console.log(`ID: ${req.id}, Phone: ${req.phone}, Status: ${req.status}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();