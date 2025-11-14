const express = require("express");
const prisma = require("../config/prismaClient");
const logger = require("../src/logger");

const router = express.Router();

// Submit support request
router.post("/submit", async (req, res) => {
  logger.info("Support request received", { body: req.body });

  const { name, phone, transactionCode, message } = req.body;

  if (!name || !phone || !transactionCode || !message) {
    return res.status(400).json({
      success: false,
      error: "All fields are required"
    });
  }

  // Basic phone validation (Kenyan format)
  const phoneRegex = /^(\+254|254|0)[17]\d{8}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format"
    });
  }

  try {
    const supportRequest = await prisma.supportRequest.create({
      data: {
        name,
        phone,
        transactionCode,
        message,
        status: "pending"
      }
    });

    logger.info("Support request created", { requestId: supportRequest.id });

    // Broadcast real-time update to the user
    if (global.emitSupportEvent && supportRequest.phone) {
      global.emitSupportEvent("support_request_created", {
        type: "new_request",
        request: supportRequest
      }, supportRequest.phone);
    }

    res.json({
      success: true,
      message: "Support request submitted successfully",
      data: {
        id: supportRequest.id,
        status: supportRequest.status
      }
    });
  } catch (error) {
    logger.error("Error creating support request", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to submit support request"
    });
  }
});

// Get all support requests (Admin only)
router.get("/requests", async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const where = {};
    if (status && status !== "all") {
      where.status = status;
    }

    // Add search functionality
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { transactionCode: { contains: search } },
        { message: { contains: search } }
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.supportRequest.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        requests,
        total,
        page: pageNum,
        totalPages
      }
    });
  } catch (error) {
    logger.error("Error fetching support requests", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to fetch support requests"
    });
  }
});

// Update support request status (Admin only)
router.put("/requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status"
      });
    }

    const updatedRequest = await prisma.supportRequest.update({
      where: { id: parseInt(id) },
      data: { status, updatedAt: new Date() }
    });

    // Broadcast real-time update to the user
    if (global.emitSupportEvent && updatedRequest.phone) {
      global.emitSupportEvent("support_status_update", {
        type: "status_update",
        request: updatedRequest
      }, updatedRequest.phone);
    }

    res.json({
      success: true,
      message: "Support request status updated",
      data: updatedRequest
    });
  } catch (error) {
    logger.error("Error updating support request", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to update support request"
    });
  }
});

// Get user's own support requests (User endpoint)
router.get("/user/requests", async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    const requests = await prisma.supportRequest.findMany({
      where: { phone: phone },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    logger.error("Error fetching user support requests", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to fetch support requests"
    });
  }
});

// Get single support request (Admin only)
router.get("/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.supportRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Support request not found"
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error("Error fetching support request", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to fetch support request"
    });
  }
});

module.exports = router;