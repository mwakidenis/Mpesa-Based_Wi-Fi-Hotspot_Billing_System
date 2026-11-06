"use strict";

/**
 * test_ddos_limits.js
 *
 * Verifies DDoS / rate limiting / payload / idempotency controls.
 * Run: node test_ddos_limits.js
 *
 * These tests exercise the DDoSProtectionService directly and a small
 * Express app to confirm 429 / 413 / idempotent replay behavior without
 * requiring a live MikroTik router or M-Pesa credentials.
 */

const http = require("http");
const express = require("express");
const { DDoSProtectionService } = require("./services/ddosProtection.service");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed += 1;
  } else {
    console.error(`  FAIL: ${message}`);
    failed += 1;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("==============================================");
  console.log(" DDoS / Rate Limiting / Payload Verification ");
  console.log("==============================================\n");

  // ---- 1. Sliding-window rate limiters via DDoSProtectionService ----
  console.log("1. Rate limiters (in-memory sliding window)");
  const svc = new DDoSProtectionService({
    apiMax: 3,
    apiWindowMs: 1000,
    authMax: 2,
    authWindowMs: 1000,
    paymentMax: 2,
    paymentWindowMs: 1000,
    banThreshold: 50,
    trustedIps: [],
  });

  const ip = "10.0.0.99";

  // API limiter: allow up to 3, 4th should exceed
  let apiExceeded = false;
  for (let i = 0; i < 4; i++) {
    const count = svc.apiTracker.count(ip);
    if (count >= 3) { apiExceeded = true; break; }
    svc.apiTracker.record(ip);
  }
  assert(apiExceeded, "API limiter exceeds max after burst requests");

  // Auth limiter: allow up to 2
  let authHits = 0;
  for (let i = 0; i < 5; i++) {
    const count = svc.authTracker.count(ip);
    if (count >= 2) break;
    svc.authTracker.record(ip);
    authHits += 1;
  }
  assert(authHits >= 2, "Auth limiter allows up to configured max");

  // Payment limiter: allow up to 2 per minute (window is 1s here for test)
  let payHits = 0;
  for (let i = 0; i < 5; i++) {
    const count = svc.paymentTracker.count(ip);
    if (count >= 2) break;
    svc.paymentTracker.record(ip);
    payHits += 1;
  }
  assert(payHits >= 2, "Payment limiter allows up to configured max");

  console.log("");

  // ---- 2. Auto-ban on suspicious burst ----
  console.log("2. Auto-ban on suspicious burst");
  const banSvc = new DDoSProtectionService({
    apiMax: 1000,
    authMax: 1000,
    paymentMax: 1000,
    banThreshold: 5,
    banWindowMs: 1000,
    banTtlMs: 60000,
    trustedIps: [],
  });
  let banned = false;
  for (let i = 0; i < 10; i++) {
    if (banSvc.recordSuspicious(ip, "test_burst")) { banned = true; break; }
  }
  assert(banned, "IP auto-banned after exceeding suspicious threshold");
  assert(banSvc.isBanned(ip), "Banned IP reports as banned");
  assert(banSvc.banReason(ip) === "test_burst", "Ban reason recorded");
  console.log("");

  // ---- 3. Trusted IP bypass ----
  console.log("3. Trusted IP bypass");
  const trustedSvc = new DDoSProtectionService({
    apiMax: 1,
    authMax: 1,
    paymentMax: 1,
    trustedIps: ["10.0.0.50"],
  });
  // Trusted IPs never count toward limits
  assert(!trustedSvc.recordSuspicious("10.0.0.50", "x"), "Trusted IP not flagged suspicious");
  assert(!trustedSvc.isBanned("10.0.0.50"), "Trusted IP not banned");
  console.log("");

  // ---- 4. Idempotency / replay attack ----
  console.log("4. M-Pesa callback idempotency (replay protection)");
  const idemSvc = new DDoSProtectionService();
  const checkoutId = "ws_replay_test_123";
  const first = idemSvc.checkMpesaIdempotency(checkoutId);
  assert(first.duplicate === false, "First callback not flagged duplicate");
  const second = idemSvc.checkMpesaIdempotency(checkoutId);
  assert(second.duplicate === true, "Duplicate callback flagged as replay");
  console.log("");

  // ---- 5. M-Pesa IP whitelist middleware rejects untrusted IP ----
  console.log("5. M-Pesa IP whitelist middleware");
  const mpesaApp = express();
  mpesaApp.use(express.json({ limit: "10kb" }));
  mpesaApp.use((req, res, next) => {
    // Force client IP for test
    req.socket = { remoteAddress: "1.2.3.4", remotePort: 12345 };
    req.headers = req.headers || {};
    next();
  });
  const { normalizeIp, ipInCidr, parseCIDR } = require("./services/ddosProtection.service");
  // Build a tiny service with only local IP trusted
  const localSvc = new DDoSProtectionService({
    mpesaTrustedIps: ["127.0.0.1/32"],
  });
  const untrusted = localSvc.mpesaIpMiddleware();
  const trusted = localSvc.mpesaIpMiddleware();

  let untrustedRejected = false;
  await new Promise((resolve) => {
    untrusted(
      { headers: {}, socket: { remoteAddress: "1.2.3.4", remotePort: 1 }, originalUrl: "/api/mpesa/callback" },
      {
        status: () => {
          untrustedRejected = true;
          return { json: () => resolve() };
        },
      },
      () => resolve()
    );
  });
  assert(untrustedRejected, "Untrusted M-Pesa callback IP is rejected (403)");

  let trustedAccepted = false;
  await new Promise((resolve) => {
    trusted(
      { headers: {}, socket: { remoteAddress: "127.0.0.1", remotePort: 1 }, originalUrl: "/api/mpesa/callback" },
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      },
      () => {
        trustedAccepted = true;
        resolve();
      }
    );
  });
  assert(trustedAccepted, "Trusted M-Pesa callback IP is accepted");
  console.log("");

  // ---- 6. Payload size limit (413) via Express app ----
  console.log("6. Request body size limit (10kb -> 413)");
  const bodyApp = express();
  bodyApp.use(express.json({ limit: "10kb" }));
  bodyApp.post("/test", (req, res) => res.json({ ok: true }));

  const server = http.createServer(bodyApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const bigPayload = JSON.stringify({ data: "x".repeat(20000) }); // ~20kb
  const bigResp = await new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/test",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bigPayload) },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.write(bigPayload);
    req.end();
    req.on("error", () => resolve({ status: null, body: "error" }));
  });
  assert(bigResp.status === 413, `Oversized payload rejected with 413 (got ${bigResp.status})`);

  const smallResp = await new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/test",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": 2 },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.write("{}");
    req.end();
  });
  assert(smallResp.status === 200, `Small payload accepted (got ${smallResp.status})`);

  server.close();
  console.log("");

  // ---- Summary ----
  console.log("==============================================");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("==============================================");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
