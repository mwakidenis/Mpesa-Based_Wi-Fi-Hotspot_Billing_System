const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
const { stkPush } = require("../config/mpesa");
const {
  checkEligibility,
  createLoan,
  repayLoan,
  getUserLoans,
  getAllLoans,
  createBypassLoan
} = require("../services/loanService");

const router = express.Router();

// Middleware to verify JWT token (for regular users only)
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "No token provided"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Reject admin tokens from user endpoints
    if (decoded.role === "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access not allowed on user endpoints"
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid token"
    });
  }
};

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "No token provided"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid token"
    });
  }
};

// Check loan eligibility
router.get("/eligibility", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const eligibility = await checkEligibility(userId);

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error("Error checking eligibility:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check eligibility"
    });
  }
});

// Request a loan
router.post("/request", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid loan amount is required"
      });
    }

    const loan = await createLoan(userId, parseInt(amount));

    res.json({
      success: true,
      message: "Loan request successful",
      data: loan
    });
  } catch (error) {
    console.error("Error requesting loan:", error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Initiate loan repayment (M-Pesa STK Push)
router.post("/repay/initiate/:loanId", verifyToken, async (req, res) => {
  console.log("Loan repayment initiate request received:", req.body);

  const { loanId } = req.params;
  const userId = req.user.userId;

  try {
    // Verify loan belongs to user and get loan details
    const loan = await prisma.loan.findUnique({
      where: { id: parseInt(loanId) },
      include: { user: true }
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: "Loan not found"
      });
    }

    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: "Loan is not active"
      });
    }

    // Calculate total amount due (principal + interest)
    const totalDue = Math.ceil(loan.amount * (1 + loan.interestRate));

    // Get user's phone number
    const phone = loan.user.phone;
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "User phone number not found"
      });
    }

    // Accept +2547XXXXXXXX or 2547XXXXXXXX
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone;
    if (!/^2547\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format"
      });
    }

    const transactionId = `LOAN_REPAY_${loanId}_${Date.now()}`;

    // Create loan repayment record in database
    try {
      await prisma.loanRepayment.create({
        data: {
          loanId: parseInt(loanId),
          transactionId,
          amount: totalDue,
          status: "pending"
        }
      });
    } catch (dbError) {
      console.error("Database error creating loan repayment:", dbError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Use real MPesa STK Push
    console.log(`Initiating STK Push for loan repayment: Phone: ${normalizedPhone}, Amount: ${totalDue}`);
    try {
      const stkResponse = await stkPush(normalizedPhone, totalDue, transactionId);
      if (!stkResponse) {
        // Mark repayment as failed in database
        try {
          await prisma.loanRepayment.updateMany({
            where: { transactionId },
            data: { status: "failed" }
          });
        } catch (dbError) {
          console.error("Failed to update repayment status:", dbError);
        }
        return res.status(500).json({ success: false, error: "STK Push failed. No response from MPesa API." });
      }

      // Persist CheckoutRequestID for callback correlation
      try {
        const checkoutId = stkResponse.CheckoutRequestID || null;
        if (checkoutId) {
          await prisma.loanRepayment.updateMany({
            where: { transactionId },
            data: { mpesaRef: checkoutId }
          });
        }
      } catch (e) {
        console.error("Failed to persist mpesa_ref:", e);
      }

      console.log("Returning success response for loan repayment transaction:", transactionId);
      return res.json({
        success: true,
        data: {
          transactionId,
          mpesaRef: stkResponse.CheckoutRequestID || stkResponse.MerchantRequestID || null,
          amount: totalDue,
          status: "pending",
        },
        message: "STK Push sent for loan repayment!",
      });
    } catch (stkError) {
      console.error('STK Push Error:', stkError);

      // Mark repayment as failed in database
      try {
        await prisma.loanRepayment.updateMany({
          where: { transactionId },
          data: { status: "failed" }
        });
      } catch (dbError) {
        console.error("Failed to update repayment status:", dbError);
      }

      return res.status(500).json({ success: false, error: "STK Push failed. No response from MPesa API." });
    }
  } catch (error) {
    console.error("Error initiating loan repayment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate loan repayment"
    });
  }
});

// Check loan repayment status
router.get("/repay/status/:transactionId", verifyToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const repayment = await prisma.loanRepayment.findUnique({
      where: { transactionId },
      select: { status: true, mpesaRef: true, amount: true, loanId: true }
    });
    if (!repayment) {
      return res.json({ success: true, data: { status: "pending", mpesaRef: null, amount: 0 } });
    }
    return res.json({ success: true, data: {
      status: repayment.status || "pending",
      mpesaRef: repayment.mpesaRef,
      amount: repayment.amount,
      loanId: repayment.loanId
    }});
  } catch (error) {
    console.error("/repay/status error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch repayment status" });
  }
});

// Get user's loan status
router.get("/status", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const loans = await getUserLoans(userId);

    res.json({
      success: true,
      data: loans
    });
  } catch (error) {
    console.error("Error getting loan status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get loan status"
    });
  }
});

// Admin: Get all loans
router.get("/admin/all", verifyAdmin, async (req, res) => {
  try {
    const { status, userId } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (userId) filters.userId = parseInt(userId);

    const loans = await getAllLoans(filters);

    res.json({
      success: true,
      data: loans
    });
  } catch (error) {
    console.error("Error getting all loans:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get loans"
    });
  }
});

// Admin: Create bypass loan for testing
router.post("/admin/bypass", verifyAdmin, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid userId and amount are required"
      });
    }

    const loan = await createBypassLoan(parseInt(userId), parseInt(amount));

    res.json({
      success: true,
      message: "Bypass loan created successfully",
      data: loan
    });
  } catch (error) {
    console.error("Error creating bypass loan:", error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Special bypass for Duncan Ndulu testing
router.post("/bypass/duncan", async (req, res) => {
  try {
    console.log("Duncan Ndulu bypass request received");

    // Find Duncan Ndulu's user record
    const duncanUser = await prisma.authUser.findFirst({
      where: { username: "Duncan Ndulu" }
    });

    if (!duncanUser) {
      return res.status(404).json({
        success: false,
        error: "Duncan Ndulu user not found"
      });
    }

    // Update user to be eligible for borrowing
    await prisma.authUser.update({
      where: { id: duncanUser.id },
      data: {
        owedAmount: 0,
        canBorrow: true,
        borrowCount: 0
      }
    });

    console.log("Duncan Ndulu bypass applied successfully");

    res.json({
      success: true,
      message: "Duncan Ndulu bypass applied - now eligible for borrowing",
      data: {
        userId: duncanUser.id,
        username: duncanUser.username,
        canBorrow: true,
        owedAmount: 0,
        borrowCount: 0
      }
    });
  } catch (error) {
    console.error("Error applying Duncan bypass:", error);
    res.status(500).json({
      success: false,
      error: "Failed to apply bypass"
    });
  }
});

// Create a test user for loan testing
router.post("/create-test-user", async (req, res) => {
  try {
    console.log("Creating test user for loan testing");

    // Check if test user already exists
    const existingUser = await prisma.authUser.findFirst({
      where: { username: "Test Borrower" }
    });

    if (existingUser) {
      // Update existing test user to be eligible
      await prisma.authUser.update({
        where: { id: existingUser.id },
        data: {
          owedAmount: 0,
          canBorrow: true,
          borrowCount: 0
        }
      });

      return res.json({
        success: true,
        message: "Test user updated - now eligible for borrowing",
        data: {
          userId: existingUser.id,
          username: existingUser.username,
          phone: existingUser.phone,
          canBorrow: true,
          owedAmount: 0,
          borrowCount: 0
        }
      });
    }

    // Create new test user
    const hashedPassword = await require('bcryptjs').hash('Test123', 10);

    const testUser = await prisma.authUser.create({
      data: {
        username: "Test Borrower",
        email: "test@borrower.com",
        phone: "0712345678",
        password: hashedPassword
      }
    });

    // Update the user to be eligible for borrowing (separate update to ensure fields exist)
    await prisma.authUser.update({
      where: { id: testUser.id },
      data: {
        owedAmount: 0,
        canBorrow: true,
        borrowCount: 0
      }
    });

    console.log("Test user created successfully:", testUser.id);

    res.json({
      success: true,
      message: "Test user created - eligible for borrowing",
      data: {
        userId: testUser.id,
        username: testUser.username,
        phone: testUser.phone,
        password: "Test123", // Plain text for testing
        canBorrow: true,
        owedAmount: 0,
        borrowCount: 0
      }
    });
  } catch (error) {
    console.error("Error creating test user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create test user"
    });
  }
});

// Admin: Update loan status
router.put("/admin/:loanId/status", verifyAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'repaid', 'overdue', 'defaulted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status"
      });
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: parseInt(loanId) },
      data: { status },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: "Loan status updated successfully",
      data: updatedLoan
    });
  } catch (error) {
    console.error("Error updating loan status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update loan status"
    });
  }
});

module.exports = router;
