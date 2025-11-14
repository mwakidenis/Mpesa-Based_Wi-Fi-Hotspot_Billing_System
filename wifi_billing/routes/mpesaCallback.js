const express = require("express");
const prisma = require("../config/prismaClient");
const { whitelistMAC } = require("../config/mikrotik");
const logger = require("../src/logger");

const router = express.Router();

router.post("/mpesa/callback", async (req, res) => {
  logger.info("M-Pesa Callback Received", { body: req.body });

  const callbackData = req.body?.Body?.stkCallback;
  const checkoutId = callbackData?.CheckoutRequestID;
  const resultCode = callbackData?.ResultCode;

  if (!callbackData || !checkoutId) {
    return res.status(400).json({ success: false, error: "Invalid callback payload" });
  }

  // Check if this is a loan repayment transaction
  const isLoanRepayment = checkoutId.includes('LOAN_REPAY');

  if (resultCode !== 0) {
    // Mark failed using parameterized query - payment was not completed
    try {
      if (isLoanRepayment) {
        await prisma.loanRepayment.updateMany({
          where: { mpesaRef: checkoutId },
          data: { status: "failed" }
        });
      } else {
        await prisma.payment.updateMany({
          where: { mpesaRef: checkoutId },
          data: { status: "failed" }
        });
      }
      logger.warn(`Payment failed for checkout ID: ${checkoutId}`, { resultCode });
      return res.json({ success: false, message: "Payment failed or canceled" });
    } catch (error) {
      logger.error("Failed to update payment status", { error: error.message, checkoutId });
      return res.status(500).json({ success: false, error: "Failed to update payment status" });
    }
  }

  const amount = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === "Amount")?.Value;
  const mpesaRef = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === "MpesaReceiptNumber")?.Value;

  // Validate that we have the required M-Pesa transaction details
  if (!amount || !mpesaRef) {
    logger.error("Invalid callback data - missing amount or M-Pesa receipt number", { checkoutId, amount, mpesaRef });
    try {
      if (isLoanRepayment) {
        await prisma.loanRepayment.updateMany({
          where: { mpesaRef: checkoutId },
          data: { status: "failed" }
        });
      } else {
        await prisma.payment.updateMany({
          where: { mpesaRef: checkoutId },
          data: { status: "failed" }
        });
      }
    } catch (error) {
      logger.error("Failed to update payment status", { error: error.message, checkoutId });
    }
    return res.status(400).json({ success: false, error: "Invalid callback data - missing transaction details" });
  }

  try {
    if (isLoanRepayment) {
      // Handle loan repayment
      const repayment = await prisma.loanRepayment.findFirst({
        where: { mpesaRef: checkoutId },
        include: { loan: true }
      });

      if (!repayment) {
        logger.error("Loan repayment transaction not found", { checkoutId });
        return res.status(500).json({ success: false, error: "Loan repayment transaction not found" });
      }

      // Update repayment status
      await prisma.loanRepayment.update({
        where: { id: repayment.id },
        data: {
          status: "completed",
          mpesaRef: mpesaRef
        }
      });

      // Update loan status to repaid
      await prisma.loan.update({
        where: { id: repayment.loanId },
        data: {
          status: 'repaid',
          repaidAt: new Date(),
          repaymentAmount: repayment.amount
        }
      });

      // Log the repayment activity
      await prisma.userActivity.create({
        data: {
          userId: repayment.loan.userId,
          action: 'loan_repaid_mpesa',
          amount: repayment.amount
        }
      });

      // After successful loan repayment, grant WiFi access
      // Get user's MAC address from loan repayment initiation activity
      const recentActivity = await prisma.userActivity.findFirst({
        where: {
          userId: repayment.loan.userId,
          action: 'loan_repay_initiated',
          macAddress: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentActivity && recentActivity.macAddress) {
        const mac = recentActivity.macAddress;
        // Use configurable WiFi duration for loan repayments
        const loanWifiDurationHours = parseInt(process.env.LOAN_WIFI_DURATION_HOURS) || 1;
        const timeLabel = loanWifiDurationHours === 1 ? "1Hr" :
                         loanWifiDurationHours === 4 ? "4Hrs" :
                         loanWifiDurationHours === 12 ? "12Hrs" :
                         loanWifiDurationHours === 24 ? "24Hrs" : "1Hr";

        logger.info(`Granting WiFi access after loan repayment`, { mac, timeLabel, durationHours: loanWifiDurationHours });

        const mikrotikResponse = await whitelistMAC(mac, timeLabel);

        if (mikrotikResponse.success) {
          // Calculate expiry time based on configured duration
          const expiresAt = new Date(Date.now() + loanWifiDurationHours * 60 * 60 * 1000);

          // Create a payment record for the WiFi access granted via loan repayment
          await prisma.payment.create({
            data: {
              phone: repayment.loan.user.phone,
              amount: repayment.amount,
              transactionId: `LOAN_WIFI_${repayment.id}_${Date.now()}`,
              macAddress: mac,
              status: "completed",
              mpesaRef: mpesaRef,
              expiresAt: expiresAt,
              authUserId: repayment.loan.userId
            }
          });

          logger.info(`WiFi access granted after loan repayment`, { mac, expiresAt, durationHours: loanWifiDurationHours });
        } else {
          logger.error("Failed to grant WiFi access after loan repayment", { mac, error: mikrotikResponse.message });
        }
      } else {
        logger.warn("No MAC address found for user, skipping WiFi access grant after loan repayment", { userId: repayment.loan.userId });
      }

      logger.info(`Loan repayment completed`, { checkoutId, amount, loanId: repayment.loanId });
      return res.json({ success: true, message: "Loan repayment completed successfully" });

    } else {
      // Handle regular WiFi payment
      const payment = await prisma.payment.findFirst({
        where: { mpesaRef: checkoutId },
        select: { macAddress: true }
      });
      if (!payment || !payment.macAddress) {
        logger.error("Transaction not found", { checkoutId });
        return res.status(500).json({ success: false, error: "Transaction not found" });
      }
      const mac = payment.macAddress;
      let time = "1Hr";
      if (Number(amount) === 30) time = "24Hrs";
      else if (Number(amount) === 20) time = "12Hrs";
      else if (Number(amount) === 15) time = "4Hrs";

      logger.info(`Whitelisting MAC for payment`, { mac, time, amount });

      const mikrotikResponse = await whitelistMAC(mac, time);

      if (mikrotikResponse.success) {
        // Calculate expiry time based on amount
        let expiryHours = 1; // Default 1 hour
        if (Number(amount) === 30) expiryHours = 24;
        else if (Number(amount) === 20) expiryHours = 12;
        else if (Number(amount) === 15) expiryHours = 4;

        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        // Update payment status using parameterized query - ONLY when M-Pesa PIN is entered and payment succeeds
        await prisma.payment.updateMany({
          where: { mpesaRef: checkoutId },
          data: {
            status: "completed",
            mpesaRef: mpesaRef || checkoutId || null,
            expiresAt: expiresAt
          }
        });

        logger.info(`Payment completed`, { checkoutId, amount, expiresAt });
        return res.json({ success: true, message: mikrotikResponse.message });
      } else {
        logger.error("MikroTik whitelist failed", { mac, error: mikrotikResponse.message });
        return res.status(500).json({ success: false, error: "MikroTik whitelist failed" });
      }
    }
  } catch (error) {
    logger.error("Database error in M-Pesa callback", { error: error.message, checkoutId });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
