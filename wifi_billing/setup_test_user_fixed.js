const prisma = require('./config/prismaClient');
const bcrypt = require('bcryptjs');

async function setupTestUser() {
  try {
    console.log('Setting up test user...');

    // Check if user already exists
    let user = await prisma.authUser.findFirst({
      where: { username: 'Esther Kethi' }
    });

    if (user) {
      console.log('User already exists:', user.username);
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('Test123', 10);

    user = await prisma.authUser.create({
      data: {
        username: 'Esther Kethi',
        email: 'kethikioko2018@gmail.com',
        phone: '0712877555',
        password: hashedPassword
      }
    });

    console.log('Created user:', user.username);

    // Create 7 days of purchase activities
    const now = new Date();
    const activities = [];

    for (let i = 0; i < 7; i++) {
      const activityDate = new Date(now);
      activityDate.setDate(now.getDate() - i);

      activities.push({
        userId: user.id,
        action: 'purchase',
        amount: 10, // 1 hour package
        package: '1 Hour',
        createdAt: activityDate
      });
    }

    await prisma.userActivity.createMany({
      data: activities
    });

    console.log('Created 7 days of purchase activities');

    // The user is already created and eligible by default
    console.log('Test user setup complete!');
    console.log('Username: Esther Kethi');
    console.log('Password: Test123');

  } catch (error) {
    console.error('Error setting up test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUser();
