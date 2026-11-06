require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const http = require("http");
const socketIo = require("socket.io");
const next = require("next");
const prisma = require("./config/prismaClient");
const {
  disconnectAllUsers,
  disconnectByMac,
  getActiveDevices,
  getStatus,
} = require("./config/mikrotik");
const logger = require("./src/logger");
const ddos = require("./services/ddosInstance");

// M-Pesa routes
const mpesaRoutes = require("./routes/mpesaRoutes");
const mpesaCallback = require("./routes/mpesaCallback");

// Support routes
const supportRoutes = require("./routes/support");

// Rate limiters
const { authLimiter, paymentLimiter, apiLimiter } = require("./middleware/rateLimit");

// Hotspot spoofing shield
const { hotspotShield } = require("./middleware/hotspotShield");

// Initialize Next.js
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: "./frontend" });
const handle = nextApp.getRequestHandler();

const PORT = process.env.PORT || 5000;

// -------------------- AUTH MIDDLEWARE --------------------
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const tokenValue = token.replace("Bearer ", "");
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);

    if (decoded.exp && Date.now() >= decoded.exp * 1000)
      return res.status(401).json({ error: "Token has expired." });

    if (decoded.role !== "admin")
      return res.status(403).json({ error: "Access denied. Admins only." });

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
};

// Prepare Next.js and start server
nextApp.prepare().then(() => {
  // Use the same app instance that was created earlier
  const app = express();

  // Trust proxy (Render / Railway / Nginx front the app)
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? true : "loopback");

  // -------------------- SECURITY MIDDLEWARE --------------------
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    })
  );

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : dev
      ? ["http://localhost:3000", "http://localhost:5000", "*"]
      : [];

  if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
    logger.warn(
      "CORS_ORIGINS not set in production; cross-origin browser requests will be denied. Set CORS_ORIGINS to your frontend domain."
    );
  }

  app.use(
    cors({
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // Strict body size limit across all routes (10kb) to mitigate memory-exhaustion
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // -------------------- PAYMENT ENDPOINT FOR FRONTEND --------------------
  app.post("/pay", paymentLimiter(), (req, res) => {
    logger.info("Request received at /pay", { headers: req.headers, body: req.body });

    const phone = req.body.phone;
    const amount = req.body.amount;

    logger.info("Parsed phone and amount", { phone, amount });

    res.json({
      success: true,
      data: {
        CheckoutRequestID: `ws_${Date.now()}`,
        MerchantRequestID: `mr_${Date.now()}`,
        ResponseCode: "0",
        ResponseDescription: "Success. Request accepted for processing",
        CustomerMessage: "Success. Request accepted for processing",
      },
      message: "STK Push sent!",
    });
  });

  // -------------------- ADMIN DASHBOARD --------------------

  // Get all payments
  app.get("/admin/payments", authMiddleware, async (req, res) => {
    try {
      const payments = await prisma.payment.findMany({
        orderBy: { time_purchased: "desc" },
        select: { phone: true, amount: true, time_purchased: true, status: true },
      });
      res.json({ success: true, data: payments });
    } catch (err) {
      logger.error("Database error in admin payments", { error: err.message });
      res.status(500).json({ success: false, error: "Database error" });
    }
  });

  // Get summary
  app.get("/admin/summary", authMiddleware, async (req, res) => {
    try {
      const totalUsers = await prisma.authUser.count();

      const totalRevenueAggregate = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "completed" },
      });

      const pendingPayments = await prisma.payment.count({
        where: { status: "pending" },
      });

      const activeSessions = 0; // Placeholder

      res.json({
        success: true,
        data: {
          totalUsers,
          totalRevenue: totalRevenueAggregate._sum.amount || 0,
          activeSessions,
          pendingPayments,
        },
      });
    } catch (err) {
      logger.error("Database error in admin summary", { error: err.message });
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  // -------------------- USERS --------------------
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const { search = "", status = "all", page = 1, limit = 10 } = req.query;
      const pageNum = Number(page) || 1;
      const per = Number(limit) || 10;

      const where = {};
      if (search) where.phone = { contains: search, mode: "insensitive" };
      if (status !== "all") where.status = status;

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
      res.json({ success: true, data: { users, total, page: pageNum, totalPages } });
    } catch (err) {
      logger.error("Database error fetching users", { error: err.message });
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  });

  // Disconnect user by ID
  app.post("/api/users/:id/disconnect", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await prisma.payment.findUnique({
        where: { id: Number(id) },
        select: { mac_address: true },
      });
      const mac = payment?.mac_address;
      if (!mac) return res.json({ success: true });

      const resp = await disconnectByMac(mac);
      res.json({ success: resp.success, message: resp.message });
    } catch (err) {
      logger.error("Error disconnecting user", { error: err.message });
      res.status(500).json({ success: false, error: "Failed to disconnect user" });
    }
  });

  // -------------------- NETWORK (circuit-breaker + spoof shield) --------------------
  app.get("/network/devices", authMiddleware, hotspotShield(), apiLimiter(), async (req, res) => {
    const resp = await getActiveDevices();
    if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
    res.json({ success: true, data: resp.data });
  });

  // Disconnect all users
  app.post("/network/disconnect-all", authMiddleware, hotspotShield(), apiLimiter(), async (req, res) => {
    const resp = await disconnectAllUsers();
    res.json({ success: resp.success, message: resp.message });
  });

  // Network status
  app.get("/network/status", authMiddleware, hotspotShield(), apiLimiter(), async (req, res) => {
    const resp = await getStatus();
    if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
    res.json({ success: true, data: resp.data });
  });

  // -------------------- AUTH ROUTES --------------------
  const authRoutes = require("./routes/auth");
  app.use("/api/auth", authLimiter(), authRoutes);

  // -------------------- LOAN ROUTES --------------------
  const loanRoutes = require("./routes/loanRoutes");
  app.use("/loans", apiLimiter(), loanRoutes);
  app.use("/api/loans", apiLimiter(), loanRoutes);

  // -------------------- ADMIN ROUTES --------------------
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", authLimiter(), adminRoutes);

  // -------------------- M-PESA ROUTES --------------------
  app.use("/api", apiLimiter(), mpesaRoutes);
  // M-Pesa callback: strict IP whitelist + idempotency before the handler
  app.use("/api", ddos.mpesaIpMiddleware(), paymentLimiter(), mpesaCallback);

  // -------------------- SUPPORT ROUTES --------------------
  app.use("/api/support", apiLimiter(), supportRoutes);

  // -------------------- TRANSACTION ROUTES --------------------
  const transactionRoutes = require("./routes/transactions");
  app.use("/api/transactions", apiLimiter(), transactionRoutes);

  // -------------------- DEVICE INFO ROUTE --------------------
  app.get("/api/device/info", apiLimiter(), async (req, res) => {
    try {
      // Get client IP address
      const clientIP = req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddress ||
        "127.0.0.1";

      // Clean up IPv6 localhost
      const ipAddress = clientIP.replace(/^::ffff:/, "");

      logger.info(`Device info request from IP: ${ipAddress}`);

      // Try to get real device info from MikroTik first
      const { getDeviceInfoByIP } = require("./config/mikrotik");
      const mikrotikResult = await getDeviceInfoByIP(ipAddress);

      if (mikrotikResult.success) {
        logger.info("Retrieved real device info from MikroTik", mikrotikResult.data);
        return res.json({
          success: true,
          data: mikrotikResult.data,
        });
      }

      // Fallback to mock data for development or when MikroTik is not available
      logger.info("Using mock device info (MikroTik not available or device not found)");
      res.json({
        success: true,
        data: {
          macAddress: "00:11:22:33:44:55",
          ipAddress: ipAddress,
          deviceId: "DEV001",
        },
      });
    } catch (error) {
      logger.error("Error retrieving device info:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve device information",
      });
    }
  });

  // -------------------- SECURITY STATUS (admin) --------------------
  app.get("/api/security/status", authMiddleware, async (_req, res) => {
    res.json({
      success: true,
      data: {
        circuitBreaker: {
          state: ddos.mikrotikState,
          nextAttempt: ddos.mikrotikNextAttempt,
          failureCount: ddos.mikrotikFailures.count("mikrotik"),
        },
        bans: Array.from(ddos.bans.bans.entries()).map(([ip, entry]) => ({
          ip,
          until: entry.until,
          reason: entry.reason,
        })),
      },
    });
  });

  // -------------------- WELCOME ENDPOINT --------------------
  app.get("/welcome", (req, res) => {
    logger.info(`Request received: ${req.method} ${req.path}`);
    res.json({ message: "Welcome to the WiFi Billing System API!" });
  });

  // -------------------- ROOT ROUTE --------------------
  app.get("/", (req, res) => {
    res.json({ message: "WiFi Billing System API is running", status: "OK" });
  });

  // -------------------- SERVE NEXT.JS FRONTEND --------------------
  // Handle all other routes with Next.js (MUST BE LAST)
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  // -------------------- START SERVER --------------------

  // Create HTTP server for Socket.IO
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: corsOrigins.length === 0 ? "*" : corsOrigins,
      methods: ["GET", "POST"],
    },
  });

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    logger.info("User connected:", socket.id);

    // Handle loan-related events
    socket.on("join_loan_room", (userId) => {
      socket.join(`loan_${userId}`);
      logger.info(`User ${userId} joined loan room`);
    });

    socket.on("leave_loan_room", (userId) => {
      socket.leave(`loan_${userId}`);
      logger.info(`User ${userId} left loan room`);
    });

    // Handle admin loan monitoring
    socket.on("join_admin_loans", () => {
      socket.join("admin_loans");
      logger.info("Admin joined loan monitoring room");
    });

    // Handle support requests
    socket.on("join_support", (phone) => {
      socket.join(`support_${phone}`);
      logger.info(`User with phone ${phone} joined support room`);
    });

    socket.on("disconnect", () => {
      logger.info("User disconnected:", socket.id);
    });
  });

  // Make io available globally for routes
  global.io = io;

  // Function to emit loan events
  const emitLoanEvent = (event, data, userId = null) => {
    if (userId) {
      io.to(`loan_${userId}`).emit(event, data);
    }
    io.to("admin_loans").emit(event, data);
  };

  // Function to emit support events
  const emitSupportEvent = (event, data, phone = null) => {
    if (phone) {
      io.to(`support_${phone}`).emit(event, data);
    }
  };

  global.emitLoanEvent = emitLoanEvent;
  global.emitSupportEvent = emitSupportEvent;

  // -------------------- START SERVER --------------------
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    logger.info(`WebSocket server ready for real-time updates`);
    logger.info(`Next.js frontend integrated and ready`);
    logger.info(`DDoS protection active (auth/payment/api limiters, circuit breaker)`);
  });
}).catch((err) => {
  logger.error("Error starting Next.js app:", err);
  process.exit(1);
});
