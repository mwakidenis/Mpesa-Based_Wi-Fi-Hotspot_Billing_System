const prisma = require("../config/prismaClient");
const logger = require("../src/logger");

// Check if user is eligible for a loan
async function checkEligibility(userId) {
  try {
    // Check if user has any active loans
    const activeLoan = await prisma.loan.findFirst({
      where: {
        userId: userId,
        status: { in: ['active', 'overdue'] }
      }
    });

    if (activeLoan) {
      return {
        eligible: false,
        reason: 'User already has an active loan'
      };
    }

    // Check 1-week activity (7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentActivities = await prisma.userActivity.findMany({
      where: {
        userId: userId,
        action: 'purchase',
        createdAt: {
          gte: oneWeekAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentActivities.length === 0) {
      return {
        eligible: false,
        reason: 'No purchase activity in the last week'
      };
    }

    // Loan amount is fixed to lowest package amount (10 KES)
    const loanAmount = 10;

    return {
      eligible: true,
      loanAmount: loanAmount,
      recentPurchases: recentActivities.length,
      mostFrequentAmount: loanAmount
    };
  } catch (error) {
    logger.error('Error checking loan eligibility', { error: error.message });
    return {
      eligible: false,
      reason: 'Error checking eligibility'
    };
  }
}

// Create a new loan
async function createLoan(userId, amount) {
  try {
    // Check eligibility first
    const eligibility = await checkEligibility(userId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    // Ensure loan amount matches eligibility
    if (amount !== eligibility.loanAmount) {
      throw new Error('Loan amount must match most frequent purchase amount');
    }

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const loan = await prisma.loan.create({
      data: {
        userId: userId,
        amount: amount,
        dueAt: dueDate,
        status: 'active'
      },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    // Log the loan activity
    await prisma.userActivity.create({
      data: {
        userId: userId,
        action: 'loan_borrowed',
        amount: amount
      }
    });

    // Emit real-time event
    if (global.emitLoanEvent) {
      global.emitLoanEvent('loan_created', {
        loanId: loan.id,
        userId: loan.userId,
        amount: loan.amount,
        dueAt: loan.dueAt
      }, userId);
    }

    return loan;
  } catch (error) {
    logger.error('Error creating loan', { error: error.message });
    throw error;
  }
}

// Repay a loan
async function repayLoan(loanId, repaymentAmount) {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { user: true }
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== 'active') {
      throw new Error('Loan is not active');
    }

    // Calculate total amount due (principal + interest)
    const totalDue = Math.ceil(loan.amount * (1 + loan.interestRate));

    if (repaymentAmount < totalDue) {
      throw new Error(`Insufficient repayment amount. Required: ${totalDue} KES`);
    }

    // Update loan status
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'repaid',
        repaidAt: new Date(),
        repaymentAmount: repaymentAmount
      }
    });

    // Log the repayment activity
    await prisma.userActivity.create({
      data: {
        userId: loan.userId,
        action: 'loan_repaid',
        amount: repaymentAmount
      }
    });

    return updatedLoan;
  } catch (error) {
    logger.error('Error repaying loan', { error: error.message });
    throw error;
  }
}

// Get user's loan status
async function getUserLoans(userId) {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    return loans;
  } catch (error) {
    logger.error('Error getting user loans', { error: error.message });
    throw error;
  }
}

// Get all loans for admin
async function getAllLoans(filters = {}) {
  try {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;

    const loans = await prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    return loans;
  } catch (error) {
    logger.error('Error getting all loans', { error: error.message });
    throw error;
  }
}

// Check for overdue loans and update status
async function checkOverdueLoans() {
  try {
    const now = new Date();

    const overdueLoans = await prisma.loan.updateMany({
      where: {
        status: 'active',
        dueAt: {
          lt: now
        }
      },
      data: {
        status: 'overdue'
      }
    });

    return overdueLoans.count;
  } catch (error) {
    logger.error('Error checking overdue loans', { error: error.message });
    throw error;
  }
}

// Bypass mode for testing (allows loan for specific user regardless of eligibility)
async function createBypassLoan(userId, amount) {
  try {
    // Check if user exists
    const user = await prisma.authUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has any active loans (bypass should still enforce one loan at a time)
    const activeLoan = await prisma.loan.findFirst({
      where: {
        userId: userId,
        status: { in: ['active', 'overdue'] }
      }
    });

    if (activeLoan) {
      throw new Error('User already has an active loan');
    }

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const loan = await prisma.loan.create({
      data: {
        userId: userId,
        amount: amount,
        dueAt: dueDate,
        status: 'active'
      },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    // Log the loan activity
    await prisma.userActivity.create({
      data: {
        userId: userId,
        action: 'loan_borrowed_bypass',
        amount: amount
      }
    });

    // Emit real-time event
    if (global.emitLoanEvent) {
      global.emitLoanEvent('loan_created', {
        loanId: loan.id,
        userId: loan.userId,
        amount: loan.amount,
        dueAt: loan.dueAt
      }, userId);
    }

    return loan;
  } catch (error) {
    logger.error('Error creating bypass loan', { error: error.message });
    throw error;
  }
}

module.exports = {
  checkEligibility,
  createLoan,
  repayLoan,
  getUserLoans,
  getAllLoans,
  checkOverdueLoans,
  createBypassLoan
};
