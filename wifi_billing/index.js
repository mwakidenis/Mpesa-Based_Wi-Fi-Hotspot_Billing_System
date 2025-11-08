require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const prisma = require("./config/prismaClient"); // Make sure this exists
const {
  disconnectAllUsers,
  disconnectByMac,
  getActiveDevices,
  getStatus,
} = require("./config/mikrotik"); // Make sure this exists

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
  console.log("Request received at /pay");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  // Get data from either JSON body or URL-encoded body
  const phone = req.body.phone;
  const amount = req.body.amount;

  console.log("Parsed phone:", phone, "amount:", amount);

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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// -------------------- USERS --------------------
app.get("/users", authMiddleware, async (req, res) => {
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
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Disconnect user by ID
app.post("/users/:id/disconnect", authMiddleware, async (req, res) => {
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
    console.error(err);
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
app.use("/auth", authRoutes);

// -------------------- ADMIN ROUTES --------------------
// const adminRoutes = require("./routes/admin");
// app.use("/api/admin", adminRoutes);

// -------------------- M-PESA ROUTES --------------------
app.use("/api", mpesaRoutes);
app.use("/api", mpesaCallback);

// -------------------- SUPPORT ROUTES --------------------
app.use("/api/support", supportRoutes);


// -------------------- DEVICE INFO ROUTE --------------------
app.get("/api/device/info", (req, res) => {
  // Mock device info for development
  res.json({
    success: true,
    data: {
      macAddress: "00:11:22:33:44:55",
      ipAddress: "192.168.1.100",
      deviceId: "DEV001"
    }
  });
});

// -------------------- ROOT ROUTE --------------------
app.get("/", (req, res) => {
  res.json({ message: "WiFi Billing System API is running", status: "OK" });
});

// -------------------- START SERVER --------------------

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for real-time updates`);
});
