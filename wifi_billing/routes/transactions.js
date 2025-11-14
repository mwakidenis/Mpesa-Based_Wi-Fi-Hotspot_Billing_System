const express = require("express");
const router = express.Router();
const prisma = require("../config/prismaClient");
const logger = require("../src/logger");

// Get transactions with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    // Search filter
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { mpesaRef: { contains: search, mode: "insensitive" } }
      ];
    }

    // Status filter
    if (status && status !== "all") {
      where.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      where.timePurchased = {};
      if (startDate) {
        where.timePurchased.gte = new Date(startDate);
      }
      if (endDate) {
        where.timePurchased.lte = new Date(endDate);
      }
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { timePurchased: "desc" },
        skip,
        take: limitNum,
        select: {
          id: true,
          phone: true,
          amount: true,
          transactionId: true,
          status: true,
          timePurchased: true,
          mpesaRef: true,
          expiresAt: true,
          macAddress: true
        }
      }),
      prisma.payment.count({ where })
    ]);

    // Transform to match frontend expectations
    const transformedTransactions = transactions.map(tx => ({
      id: tx.transactionId,
      phone: tx.phone,
      amount: tx.amount,
      package: "WiFi Access", // Default package name
      status: tx.status,
      timestamp: tx.timePurchased.toISOString(),
      mpesaRef: tx.mpesaRef || "",
      mpesaReceipt: tx.mpesaRef || ""
    }));

    const totalPages = Math.ceil(total / limitNum);

    logger.info(`Fetched ${transactions.length} transactions for page ${pageNum}`);

    res.json({
      success: true,
      data: {
        transactions: transformedTransactions,
        total,
        page: pageNum,
        totalPages
      }
    });

  } catch (error) {
    logger.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transactions"
    });
  }
});

// Get transaction by ID
router.get("/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.payment.findUnique({
      where: { transactionId },
      select: {
        id: true,
        phone: true,
        amount: true,
        transactionId: true,
        status: true,
        timePurchased: true,
        mpesaRef: true,
        expiresAt: true,
        macAddress: true
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found"
      });
    }

    // Transform to match frontend expectations
    const transformedTransaction = {
      id: transaction.transactionId,
      phone: transaction.phone,
      amount: transaction.amount,
      package: "WiFi Access",
      status: transaction.status,
      timestamp: transaction.timePurchased.toISOString(),
      mpesaRef: transaction.mpesaRef || "",
      mpesaReceipt: transaction.mpesaRef || ""
    };

    res.json({
      success: true,
      data: transformedTransaction
    });

  } catch (error) {
    logger.error("Error fetching transaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transaction"
    });
  }
});

// Refund transaction (placeholder - implement based on your refund logic)
router.post("/:transactionId/refund", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    // Find the transaction
    const transaction = await prisma.payment.findUnique({
      where: { transactionId }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found"
      });
    }

    if (transaction.status !== "completed") {
      return res.status(400).json({
        success: false,
        error: "Only completed transactions can be refunded"
      });
    }

    // Update transaction status to refunded
    await prisma.payment.update({
      where: { transactionId },
      data: { status: "refunded" }
    });

    logger.info(`Transaction ${transactionId} refunded: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: "Transaction refunded successfully"
    });

  } catch (error) {
    logger.error("Error refunding transaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refund transaction"
    });
  }
});

// Download receipt (placeholder - implement based on your receipt generation)
router.get("/:transactionId/receipt", async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.payment.findUnique({
      where: { transactionId }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found"
      });
    }

    // For now, return a simple receipt URL
    // In production, generate actual PDF receipt
    const receiptUrl = `/receipts/${transactionId}.pdf`;

    res.json({
      success: true,
      data: { receiptUrl }
    });

  } catch (error) {
    logger.error("Error generating receipt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate receipt"
    });
  }
});

module.exports = router;