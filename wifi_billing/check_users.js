const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();

  try {
    console.log('Checking AuthUser table...');
    const users = await prisma.authUser.findMany();
    console.log('Found users:', users.length);
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Phone: ${user.phone}`);
    });

    console.log('\nChecking User table...');
    const wifiUsers = await prisma.user.findMany();
    console.log('Found wifi users:', wifiUsers.length);
    wifiUsers.forEach(user => {
      console.log(`ID: ${user.id}, Phone: ${user.phone}, Status: ${user.status}, Owed: ${user.owedAmount}, Can Borrow: ${user.canBorrow}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();