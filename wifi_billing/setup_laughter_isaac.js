const prisma = require('./config/prismaClient');
const bcrypt = require('bcryptjs');

async function setupLaughterIsaac() {
  try {
    console.log('Setting up Laughter Isaac test user...');

    // Check if user already exists
    let user = await prisma.authUser.findFirst({
      where: { username: 'Laughter Isaac' }
    });

    if (user) {
      console.log('User already exists:', user.username);
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('Test12', 10);

    user = await prisma.authUser.create({
      data: {
        username: 'Laughter Isaac',
        email: 'laughter.isaac@example.com',
        phone: '0712345680',
        password: hashedPassword
      }
    });

    console.log('Created user:', user.username);

    // Create 7 days of purchase activities to make them eligible for loans
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
    console.log('Laughter Isaac setup complete!');
    console.log('Username: Laughter Isaac');
    console.log('Password: Test12');

  } catch (error) {
    console.error('Error setting up Laughter Isaac:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupLaughterIsaac();
