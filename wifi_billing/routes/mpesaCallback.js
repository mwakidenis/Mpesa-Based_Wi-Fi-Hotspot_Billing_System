const express = require("express");
const prisma = require("../config/prismaClient");
const { whitelistMAC } = require("../config/mikrotik");

const router = express.Router();

router.post("/mpesa/callback", async (req, res) => {
  console.log("📲 M-Pesa Callback Received:", JSON.stringify(req.body, null, 2));

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
      console.log(`❌ Payment failed for checkout ID: ${checkoutId} - Result Code: ${resultCode}`);
      return res.json({ success: false, message: "Payment failed or canceled" });
    } catch (error) {
      console.error("❌ Failed to update payment status:", error);
      return res.status(500).json({ success: false, error: "Failed to update payment status" });
    }
  }

  const amount = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === "Amount")?.Value;
  const mpesaRef = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === "MpesaReceiptNumber")?.Value;

  // Validate that we have the required M-Pesa transaction details
  if (!amount || !mpesaRef) {
    console.error("❌ Invalid callback data - missing amount or M-Pesa receipt number");
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
      console.error("❌ Failed to update payment status:", error);
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
        console.error("❌ Loan repayment transaction not found for checkout ID:", checkoutId);
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

      console.log(`✅ Loan repayment completed for checkout ID: ${checkoutId} - Amount: ${amount}, Loan ID: ${repayment.loanId}`);
      return res.json({ success: true, message: "Loan repayment completed successfully" });

    } else {
      // Handle regular WiFi payment
      const payment = await prisma.payment.findFirst({
        where: { mpesaRef: checkoutId },
        select: { macAddress: true }
      });
      if (!payment || !payment.macAddress) {
        console.error("❌ Transaction not found for checkout ID:", checkoutId);
        return res.status(500).json({ success: false, error: "Transaction not found" });
      }
      const mac = payment.macAddress;
      let time = "1Hr";
      if (Number(amount) === 30) time = "24Hrs";
      else if (Number(amount) === 20) time = "12Hrs";
      else if (Number(amount) === 15) time = "4Hrs";

      console.log(`✅ Whitelisting MAC ${mac} for ${time}...`);

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

        console.log(`✅ Payment completed for checkout ID: ${checkoutId} - Amount: ${amount}, Expires: ${expiresAt}`);
        return res.json({ success: true, message: mikrotikResponse.message });
      } else {
        console.error("❌ MikroTik Error:", mikrotikResponse.message);
        return res.status(500).json({ success: false, error: "MikroTik whitelist failed" });
      }
    }
  } catch (error) {
    console.error("❌ Database Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
