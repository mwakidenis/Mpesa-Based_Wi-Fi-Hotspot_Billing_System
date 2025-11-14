require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const socketIo = require("socket.io");
const prisma = require("./config/prismaClient"); // Make sure this exists
const {
  disconnectAllUsers,
  disconnectByMac,
  getActiveDevices,
  getStatus,
} = require("./config/mikrotik"); // Make sure this exists
const logger = require("./src/logger");

// M-Pesa routes
const mpesaRoutes = require("./routes/mpesaRoutes");
const mpesaCallback = require("./routes/mpesaCallback");

// Support routes
const supportRoutes = require("./routes/support");

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json({ limit: '10mb' })); // JSON middleware
app.use(express.urlencoded({ extended: true })); // URL-encoded middleware

// -------------------- PAYMENT ENDPOINT FOR FRONTEND --------------------
app.post("/pay", (req, res) => {
  logger.info("Request received at /pay", { headers: req.headers, body: req.body });

  // Get data from either JSON body or URL-encoded body
  const phone = req.body.phone;
  const amount = req.body.amount;

  logger.info("Parsed phone and amount", { phone, amount });

  // Simple response for testing
  res.json({
    success: true,
    data: {
      CheckoutRequestID: `ws_${Date.now()}`,
      MerchantRequestID: `mr_${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing"
    },
    message: "STK Push sent!"
  });
});

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

// -------------------- ADMIN LOGIN (Hidden Route) --------------------
// Disabled for security reasons
// app.post("/api/admin/login", (req, res) => {
//   const { username, password } = req.body;

//   if (
//     username === process.env.ADMIN_USERNAME &&
//     password === process.env.ADMIN_PASSWORD
//   ) {
//     const token = jwt.sign({ username, role: "admin" }, process.env.JWT_SECRET, {
//       expiresIn: "1h",
//     });
//     return res.json({ success: true, token });
//   } else {
//     return res.status(401).json({ success: false, error: "Invalid credentials" });
//   }
// });

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

// -------------------- NETWORK --------------------
app.get("/network/devices", authMiddleware, async (req, res) => {
  const resp = await getActiveDevices();
  if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
  res.json({ success: true, data: resp.data });
});

// Disconnect all users
app.post("/network/disconnect-all", authMiddleware, async (req, res) => {
  const resp = await disconnectAllUsers();
  res.json({ success: resp.success, message: resp.message });
});

// Network status
app.get("/network/status", authMiddleware, async (req, res) => {
  const resp = await getStatus();
  if (!resp.success) return res.status(500).json({ success: false, error: resp.error });
  res.json({ success: true, data: resp.data });
});
// -------------------- AUTH ROUTES --------------------
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// -------------------- LOAN ROUTES --------------------
const loanRoutes = require("./routes/loanRoutes");
app.use("/loans", loanRoutes);
app.use("/api/loans", loanRoutes);

// -------------------- ADMIN ROUTES --------------------
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

// -------------------- M-PESA ROUTES --------------------
app.use("/api", mpesaRoutes);
app.use("/api", mpesaCallback);

// -------------------- SUPPORT ROUTES --------------------
app.use("/api/support", supportRoutes);

// -------------------- TRANSACTION ROUTES --------------------
const transactionRoutes = require("./routes/transactions");
app.use("/api/transactions", transactionRoutes);


// -------------------- DEVICE INFO ROUTE --------------------
app.get("/api/device/info", async (req, res) => {
  try {
    // Get client IP address
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress ||
                     req.connection.socket?.remoteAddress ||
                     "127.0.0.1";

    // Clean up IPv6 localhost
    const ipAddress = clientIP.replace(/^::ffff:/, '');

    logger.info(`Device info request from IP: ${ipAddress}`);

    // Try to get real device info from MikroTik first
    const { getDeviceInfoByIP } = require("./config/mikrotik");
    const mikrotikResult = await getDeviceInfoByIP(ipAddress);

    if (mikrotikResult.success) {
      logger.info("Retrieved real device info from MikroTik", mikrotikResult.data);
      return res.json({
        success: true,
        data: mikrotikResult.data
      });
    }

    // Fallback to mock data for development or when MikroTik is not available
    logger.info("Using mock device info (MikroTik not available or device not found)");
    res.json({
      success: true,
      data: {
        macAddress: "00:11:22:33:44:55",
        ipAddress: ipAddress,
        deviceId: "DEV001"
      }
    });
  } catch (error) {
    logger.error("Error retrieving device info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve device information"
    });
  }
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

// -------------------- START SERVER --------------------

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('User connected:', socket.id);

  // Handle loan-related events
  socket.on('join_loan_room', (userId) => {
    socket.join(`loan_${userId}`);
    logger.info(`User ${userId} joined loan room`);
  });

  socket.on('leave_loan_room', (userId) => {
    socket.leave(`loan_${userId}`);
    logger.info(`User ${userId} left loan room`);
  });

  // Handle admin loan monitoring
  socket.on('join_admin_loans', () => {
    socket.join('admin_loans');
    logger.info('Admin joined loan monitoring room');
  });

  // Handle support requests
  socket.on('join_support', (phone) => {
    socket.join(`support_${phone}`);
    logger.info(`User with phone ${phone} joined support room`);
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected:', socket.id);
  });
});

// Make io available globally for routes
global.io = io;

// Function to emit loan events
const emitLoanEvent = (event, data, userId = null) => {
  if (userId) {
    io.to(`loan_${userId}`).emit(event, data);
  }
  io.to('admin_loans').emit(event, data);
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
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on http://0.0.0.0:${PORT}`);
  logger.info(`WebSocket server ready for real-time updates`);
});
