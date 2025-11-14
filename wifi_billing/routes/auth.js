const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
const logger = require("../src/logger");

const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
  logger.info("Registration request received", { body: req.body });

  const { username, email, phone, password } = req.body;

  if (!username || !phone || !password) {
    return res.status(400).json({
      success: false,
      error: "Username, phone, and password are required"
    });
  }

  // Validate password (6 digits, alphanumeric combo)
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const isLengthValid = password.length === 6;

  if (!hasNumber || !hasLetter || !isLengthValid) {
    return res.status(400).json({
      success: false,
      error: "Password must be exactly 6 characters with both numbers and letters"
    });
  }

  // Validate phone number (Kenyan format)
  const phoneRegex = /^(\+254|254|0)[17]\d{8}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format"
    });
  }

  try {
    // Check if username or phone already exists
    const existingUser = await prisma.authUser.findFirst({
      where: {
        OR: [
          { username: username },
          { phone: phone }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Username or phone number already exists"
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.authUser.create({
      data: {
        username,
        email: email || null,
        phone,
        password: hashedPassword,
      }
    });

    logger.info("User created", { userId: user.id });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Account created successfully",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone
        },
        token
      }
    });
  } catch (error) {
    logger.error("Error creating user", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to create account"
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  logger.info("Login request received", { body: req.body });

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required"
    });
  }

  try {
    // Check for admin accounts first
    const adminAccounts = [
      { username: 'Mathew Kioko', password: 'Mathew12345', email: 'kiokomathew1985@gmail.com', role: 'admin' },
      { username: 'Denis2', password: 'Denis2', email: 'denis@gmail.com', role: 'admin' }
    ];

    const adminAccount = adminAccounts.find(account => account.username === username);
    if (adminAccount && password === adminAccount.password) {
      // Generate admin JWT token
      const token = jwt.sign(
        { userId: adminAccount.username, username: adminAccount.username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        success: true,
        message: "Admin login successful",
        data: {
          user: {
            id: adminAccount.username,
            username: adminAccount.username,
            email: adminAccount.email,
            role: 'admin'
          },
          token
        },
        redirectTo: '/admin'
      });
    }

    // Find regular user by username
    const user = await prisma.authUser.findUnique({
      where: { username: username }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone
        },
        token
      }
    });
  } catch (error) {
    logger.error("Error logging in", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Login failed"
    });
  }
});

// Get current user profile (protected route)
router.get("/profile", async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.authUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error("Error fetching profile", { error: error.message });
    res.status(401).json({
      success: false,
      error: "Invalid token"
    });
  }
});

module.exports = router;