const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const prisma = require("../config/prismaClient");
const { stkPush } = require("../config/mpesa");
const logger = require("../src/logger");
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

// Rate limiter for loan eligibility checks
const eligibilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many eligibility checks, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Check loan eligibility
router.get("/eligibility", verifyToken, eligibilityLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const eligibility = await checkEligibility(userId);

    logger.info(`Loan eligibility checked for user ${userId}: ${eligibility.eligible ? 'eligible' : 'not eligible'}`);

    // Emit real-time eligibility status update
    if (global.emitLoanEvent) {
      global.emitLoanEvent('loan_eligibility_checked', {
        userId,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        loanAmount: eligibility.loanAmount,
        recentPurchases: eligibility.recentPurchases,
        checkedAt: new Date()
      }, userId);
    }

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    logger.error("Error checking eligibility:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while checking eligibility"
    });
  }
});

// Rate limiter for loan requests
const loanRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 loan requests per hour
  message: "Too many loan requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Request a loan
router.post("/request", verifyToken, loanRequestLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    // Enhanced validation
    if (!amount || amount <= 0 || amount > 1000) {
      return res.status(400).json({
        success: false,
        error: "Loan amount must be between 1 and 1000 KES"
      });
    }

    // Validate amount is a number
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({
        success: false,
        error: "Invalid loan amount format"
      });
    }

    const loan = await createLoan(userId, parsedAmount);

    logger.info(`Loan requested by user ${userId} for amount ${parsedAmount}`);

    // Emit real-time loan application result
    if (global.emitLoanEvent) {
      global.emitLoanEvent('loan_application_result', {
        userId,
        status: 'approved',
        loanId: loan.id,
        amount: loan.amount,
        dueAt: loan.dueAt,
        message: 'Your loan application has been approved!',
        appliedAt: new Date()
      }, userId);
    }

    res.json({
      success: true,
      message: "Loan request successful",
      data: loan
    });
  } catch (error) {
    logger.error("Error requesting loan:", error);

    // Emit real-time loan application rejection
    if (global.emitLoanEvent) {
      global.emitLoanEvent('loan_application_result', {
        userId,
        status: 'rejected',
        amount: parsedAmount,
        reason: error.message || 'Unable to process loan request at this time',
        message: 'Your loan application has been rejected.',
        appliedAt: new Date()
      }, userId);
    }

    res.status(400).json({
      success: false,
      error: "Unable to process loan request at this time"
    });
  }
});

// Rate limiter for repayment initiation
const repaymentLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // limit each IP to 5 repayment initiations per windowMs
  message: "Too many repayment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Initiate loan repayment (M-Pesa STK Push)
router.post("/repay/initiate/:loanId", verifyToken, repaymentLimiter, async (req, res) => {
  logger.info(`Loan repayment initiate request received for loan ${req.params.loanId} by user ${req.user.userId}`);

  const { loanId } = req.params;
  const { macAddress } = req.body; // Optional MAC address for WiFi access
  const userId = req.user.userId;

  try {
    // Verify loan belongs to user and get loan details
    const loan = await prisma.loan.findUnique({
      where: { id: parseInt(loanId) },
      include: { user: true }
    });

    if (!loan || loan.userId !== userId) {
      logger.warn(`Loan ${loanId} not found or does not belong to user ${userId}`);
      return res.status(404).json({
        success: false,
        error: "Loan not found"
      });
    }

    if (loan.status !== 'active') {
      logger.warn(`Loan ${loanId} is not active (status: ${loan.status})`);
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
      logger.error(`User ${userId} has no phone number`);
      return res.status(400).json({
        success: false,
        error: "User phone number not found"
      });
    }

    // Enhanced phone number validation
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone;
    if (!/^2547\d{8}$/.test(normalizedPhone)) {
      logger.warn(`Invalid phone number format for user ${userId}: ${phone}`);
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format. Must be Kenyan mobile number."
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
      logger.info(`Created loan repayment record for loan ${loanId}, transaction ${transactionId}`);
    } catch (dbError) {
      logger.error("Database error creating loan repayment:", dbError);
      return res.status(500).json({ success: false, error: "Unable to process repayment request" });
    }

    // Store MAC address in user activity for WiFi access after repayment
    if (macAddress) {
      // Validate MAC address format (enhanced validation)
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress)) {
        logger.warn(`Invalid MAC address format: ${macAddress}`);
        return res.status(400).json({
          success: false,
          error: "Invalid MAC address format. Must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX"
        });
      }

      try {
        await prisma.userActivity.create({
          data: {
            userId: userId,
            action: 'loan_repay_initiated',
            macAddress: macAddress,
            amount: totalDue
          }
        });
        logger.info(`Stored MAC address for loan repayment: ${macAddress} for user ${userId}`);
      } catch (activityError) {
        logger.error("Failed to store MAC address in activity:", activityError);
        // Don't fail the repayment initiation for this
      }
    }

    // Use real MPesa STK Push
    logger.info(`Initiating STK Push for loan repayment: Phone: ${normalizedPhone}, Amount: ${totalDue}, Transaction: ${transactionId}`);
    try {
      const stkResponse = await stkPush(normalizedPhone, totalDue, transactionId);
      if (!stkResponse) {
        // Mark repayment as failed in database
        try {
          await prisma.loanRepayment.updateMany({
            where: { transactionId },
            data: { status: "failed" }
          });
          logger.error(`STK Push failed for transaction ${transactionId}: No response from MPesa API`);
        } catch (dbError) {
          logger.error("Failed to update repayment status:", dbError);
        }
        return res.status(500).json({ success: false, error: "Payment service temporarily unavailable" });
      }

      // Persist CheckoutRequestID for callback correlation
      try {
        const checkoutId = stkResponse.CheckoutRequestID || null;
        if (checkoutId) {
          await prisma.loanRepayment.updateMany({
            where: { transactionId },
            data: { mpesaRef: checkoutId }
          });
          logger.info(`Persisted M-Pesa reference ${checkoutId} for transaction ${transactionId}`);
        }
      } catch (e) {
        logger.error("Failed to persist mpesa_ref:", e);
      }

      logger.info(`Successfully initiated repayment for transaction ${transactionId}`);
      return res.json({
        success: true,
        data: {
          transactionId,
          mpesaRef: stkResponse.CheckoutRequestID || stkResponse.MerchantRequestID || null,
          amount: totalDue,
          status: "pending",
          willGrantWifiAccess: !!macAddress // Indicate if WiFi access will be granted
        },
        message: macAddress
          ? "STK Push sent for loan repayment! WiFi access will be granted upon successful payment."
          : "STK Push sent for loan repayment!",
      });
    } catch (stkError) {
      logger.error('STK Push Error:', stkError);

      // Mark repayment as failed in database
      try {
        await prisma.loanRepayment.updateMany({
          where: { transactionId },
          data: { status: "failed" }
        });
      } catch (dbError) {
        logger.error("Failed to update repayment status:", dbError);
      }

      return res.status(500).json({ success: false, error: "Payment service temporarily unavailable" });
    }
  } catch (error) {
    logger.error("Error initiating loan repayment:", error);
    res.status(500).json({
      success: false,
      error: "Unable to process repayment request"
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
    logger.error("Error fetching repayment status:", error);
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
    logger.error("Error getting loan status:", error);
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
    logger.error("Error getting all loans:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get loans"
    });
  }
});

// Admin: Create bypass loan for testing - REMOVED FOR PRODUCTION
// This endpoint has been removed for production security



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
    logger.error("Error updating loan status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update loan status"
    });
  }
});

module.exports = router;
