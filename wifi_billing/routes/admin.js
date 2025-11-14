const express = require("express");
const router = express.Router();
const prisma = require("../config/prismaClient");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // optional if later you want hashed passwords
const logger = require("../src/logger");
const {
  disconnectAllUsers,
  disconnectByMac,
  getActiveDevices,
  getStatus
} = require("../config/mikrotik");

// 🔐 ========================
// ADMIN LOGIN (via .env)
// ==========================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info("Admin login attempt", { username });

    // Check primary admin credentials
    const isPrimaryAdmin = (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    );

    // Check secondary admin credentials
    const isSecondaryAdmin = (
      username === process.env.ADMIN_USERNAME_2 &&
      password === process.env.ADMIN_PASSWORD_2
    );

    if (isPrimaryAdmin) {
      const token = jwt.sign(
        { role: "admin", username, email: process.env.ADMIN_EMAIL },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      logger.info("Admin login successful", { username });
      return res.json({
        success: true,
        token,
        admin: { username, email: process.env.ADMIN_EMAIL }
      });
    }

    if (isSecondaryAdmin) {
      const token = jwt.sign(
        { role: "admin", username, email: process.env.ADMIN_EMAIL_2 },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      logger.info("Admin login successful", { username });
      return res.json({
        success: true,
        token,
        admin: { username, email: process.env.ADMIN_EMAIL_2 }
      });
    }

    logger.warn("Admin login failed - invalid credentials", { username });
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (error) {
    logger.error("Admin login error", { error: error.message });
    return res.status(500).json({ success: false, error: "Login failed" });
  }
});

// 🔐 ========================
// AUTH MIDDLEWARE
// ==========================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ============================
// ADMIN ENDPOINTS
// ============================

// ✅ Get All Payments
router.get("/payments", authMiddleware, async (req, res) => {
  try {
    logger.info("Fetching payments", { admin: req.user.username });
    const payments = await prisma.payment.findMany({
      orderBy: { timePurchased: "desc" },
      select: {
        phone: true,
        amount: true,
        timePurchased: true,
        status: true
      }
    });
    logger.info("Payments fetched successfully", { count: payments.length });
    res.json({ success: true, data: payments });
  } catch (error) {
    logger.error("Payments error", { error: error.message });
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// ✅ Get Summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    logger.info("Fetching admin summary", { admin: req.user.username });
    // Count unique phones from completed payments
    const completedPayments = await prisma.payment.findMany({
      where: { status: "completed" },
      select: { phone: true }
    });
    const uniquePhones = new Set(completedPayments.map(p => p.phone));
    const totalUsers = uniquePhones.size;

    const totalRevenue = await prisma.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true }
    });

    const pendingPayments = await prisma.payment.count({
      where: { status: "pending" }
    });

    const activeSessions = 0; // Placeholder for now

    logger.info("Admin summary fetched", { totalUsers, totalRevenue: totalRevenue._sum.amount || 0 });
    res.json({
      success: true,
      data: {
        totalUsers,
        totalRevenue: totalRevenue._sum.amount || 0,
        activeSessions,
        pendingPayments
      }
    });
  } catch (error) {
    logger.error("Summary error", { error: error.message });
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ============================
// USERS
// ============================
router.get("/users", authMiddleware, async (req, res) => {
  try {
    logger.info("Fetching users", { admin: req.user.username, query: req.query });
    const { search = "", status = "all", page = 1, limit = 10 } = req.query;
    const pageNum = Number(page) || 1;
    const per = Number(limit) || 10;
    const where = {};
    if (search) {
      where.phone = { contains: search, mode: "insensitive" };
    }
    if (status !== "all") {
      where.status = status;
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (pageNum - 1) * per,
        take: per,
        orderBy: { lastSeen: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / per));
    logger.info("Users fetched successfully", { count: users.length, total });
    return res.json({ success: true, data: { users, total, page: pageNum, totalPages } });
  } catch (error) {
    logger.error("Users fetch error", { error: error.message });
    return res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

router.post("/users/:id/block", authMiddleware, async (req, res) => {
  return res.json({ success: true });
});

router.post("/users/:id/unblock", authMiddleware, async (req, res) => {
  return res.json({ success: true });
});

router.post("/users/:id/disconnect", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.promise().query("SELECT mac_address AS mac FROM payments WHERE id = ? LIMIT 1", [id]);
    const mac = rows && rows[0] && rows[0].mac;
    if (!mac) return res.json({ success: true });
    const resp = await disconnectByMac(mac);
    return res.json({ success: resp.success, message: resp.message });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to disconnect user" });
  }
});

router.delete("/users/:id", authMiddleware, async (req, res) => {
  return res.json({ success: true });
});

// ============================
// TRANSACTIONS
// ============================
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    logger.info("Fetching transactions", { admin: req.user.username, query: req.query });
    const { search = "", status = "all", page = 1, limit = 10, startDate = null, endDate = null } = req.query;
    const pageNum = Number(page) || 1;
    const per = Number(limit) || 10;
    const where = {};
    if (status !== "all") {
      where.status = status;
    }
    if (startDate) {
      where.timePurchased = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.timePurchased = { ...where.timePurchased, lte: new Date(endDate) };
    }
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { mpesaRef: { contains: search, mode: "insensitive" } }
      ];
    }
    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (pageNum - 1) * per,
        take: per,
        orderBy: { timePurchased: "desc" },
        select: {
          transactionId: true,
          phone: true,
          amount: true,
          status: true,
          timePurchased: true,
          mpesaRef: true
        }
      }),
      prisma.payment.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / per));
    logger.info("Transactions fetched successfully", { count: transactions.length, total });
    return res.json({ success: true, data: { transactions, total, page: pageNum, totalPages } });
  } catch (error) {
    logger.error("Transactions fetch error", { error: error.message });
    return res.status(500).json({ success: false, error: "Failed to fetch transactions" });
  }
});

router.post("/transactions/:transactionId/refund", authMiddleware, async (req, res) => {
  return res.json({ success: false, error: "Refund not implemented" });
});

router.get("/transactions/:transactionId/receipt", authMiddleware, async (req, res) => {
  return res.json({ success: false, error: "Receipt generation not implemented" });
});

// ============================
// SUPPORT
// ============================
router.post("/support/contact", async (req, res) => {
  return res.json({ success: true });
});

router.get("/support/requests", authMiddleware, async (req, res) => {
  return res.json({ success: true, data: { requests: [], total: 0, page: 1, totalPages: 1 } });
});

// ============================
// LOGS
// ============================
router.get("/system/logs", authMiddleware, async (req, res) => {
  return res.json({ success: true, data: [] });
});

// ============================
// NETWORK
// ============================
router.get("/network/devices", authMiddleware, async (req, res) => {
  const resp = await getActiveDevices();
  if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
  return res.json({ success: true, data: resp.data });
});

router.post("/network/disconnect-all", authMiddleware, async (req, res) => {
  const resp = await disconnectAllUsers();
  return res.json({ success: resp.success, message: resp.message });
});

router.get("/network/status", authMiddleware, async (req, res) => {
  const resp = await getStatus();
  if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
  return res.json({ success: true, data: resp.data });
});

module.exports = router;
