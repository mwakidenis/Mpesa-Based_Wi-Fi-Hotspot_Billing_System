"use strict";

// Shared singleton DDoS protection instance.
// Require this module after dotenv has been loaded (server.js loads dotenv first).
const { DDoSProtectionService } = require("./ddosProtection.service");

const trustedIps = process.env.TRUSTED_IPS
  ? process.env.TRUSTED_IPS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const mpesaTrustedIps = process.env.MPESA_TRUSTED_IPS
  ? process.env.MPESA_TRUSTED_IPS.split(",").map((s) => s.trim()).filter(Boolean)
  : undefined;

const instance = new DDoSProtectionService({
  apiMax: parseInt(process.env.API_RATE_LIMIT_MAX) || 100,
  apiWindowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  paymentMax: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX) || 10,
  paymentWindowMs: parseInt(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000,
  banThreshold: parseInt(process.env.BAN_THRESHOLD) || 100,
  banWindowMs: parseInt(process.env.BAN_WINDOW_MS) || 10 * 60 * 1000,
  banTtlMs: parseInt(process.env.BAN_TTL_MS) || 60 * 60 * 1000,
  escalateBanTtlMs: parseInt(process.env.ESCALATE_BAN_TTL_MS) || 24 * 60 * 60 * 1000,
  trustedIps,
  mpesaTrustedIps,
  mikrotikFailureThreshold: parseInt(process.env.MIKROTIK_CIRCUIT_FAILURE_THRESHOLD) || 5,
  mikrotikRecoveryTimeoutMs: parseInt(process.env.MIKROTIK_CIRCUIT_RECOVERY_MS) || 30 * 1000,
  mikrotikFailureWindowMs: parseInt(process.env.MIKROTIK_CIRCUIT_FAILURE_WINDOW_MS) || 60 * 1000,
});

module.exports = instance;
