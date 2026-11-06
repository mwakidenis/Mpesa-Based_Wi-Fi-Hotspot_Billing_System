"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("../src/logger");

const LOGS_DIR = path.join(__dirname, "..", "logs");
const SECURITY_LOG = path.join(LOGS_DIR, "security.log");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * CIDR / IP range helpers for Safaricom Daraja webhook IP verification.
 */
function parseCIDR(cidr) {
  const [ip, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10) || 32;
  const parts = ip.split(".").map(Number);
  let ipInt = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  // Network mask with `bits` leading 1s (robust for bits 0..32).
  const mask = bits === 0 ? 0 : ((0xFFFFFFFF << (32 - bits)) & 0xFFFFFFFF);
  return { ipInt, mask };
}

function ipToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.some((p) => p == null || p < 0 || p > 255)) return null;
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

function ipInCidr(ip, cidr) {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;
  const { ipInt: netInt, mask } = parseCIDR(cidr);
  return (ipInt & mask) === (netInt & mask);
}

function normalizeIp(ip) {
  if (!ip) return null;
  // Strip IPv6-mapped IPv4 prefix ::ffff:
  return ip.replace(/^::ffff:/, "");
}

function splitForwardedFor(header) {
  if (!header) return null;
  const first = header.split(",")[0].trim();
  return first || null;
}

/**
 * Default Safaricom Daraja callback IP ranges (sandbox + production).
 * Operators MUST override MPESA_TRUSTED_IPS in .env with their exact Safaricom ranges.
 * Defaults are permissive in development; in production these should be tightened.
 */
const DEFAULT_MPESA_TRUSTED_IPS = [
  "197.231.184.0/24",   // Daraja sandbox
  "196.201.214.0/24",   // Daraja production (common)
  "197.231.243.0/24",   // Daraja production (common)
  "127.0.0.1/32",       // Local development
  "::1/128",
];

/**
 * Sliding-window request tracker. Each IP keeps a timestamped hit list.
 * Old hits expire after `windowMs`.
 */
class SlidingWindowTracker {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.hits = new Map(); // ip -> Array<timestamp>
  }

  record(ip) {
    const now = Date.now();
    const hits = this.hits.get(ip) || [];
    const cutoff = now - this.windowMs;
    // Prune expired hits
    while (hits.length && hits[0] <= cutoff) hits.shift();
    hits.push(now);
    this.hits.set(ip, hits);
    return hits;
  }

  count(ip) {
    const now = Date.now();
    const hits = this.hits.get(ip) || [];
    const cutoff = now - this.windowMs;
    while (hits.length && hits[0] <= cutoff) hits.shift();
    this.hits.set(ip, hits);
    return hits.length;
  }

  clear(ip) {
    this.hits.delete(ip);
  }
}

/**
 * In-memory ban store with TTL. Each banned IP stores expiry timestamp and reason.
 */
class BanStore {
  constructor() {
    this.bans = new Map(); // ip -> { until, reason, count }
  }

  isBanned(ip) {
    const entry = this.bans.get(ip);
    if (!entry) return false;
    if (Date.now() >= entry.until) {
      this.bans.delete(ip);
      return false;
    }
    return true;
  }

  ban(ip, ttlMs, reason) {
    this.bans.set(ip, { until: Date.now() + ttlMs, reason, count: 1 });
  }

  increment(ip) {
    const entry = this.bans.get(ip);
    if (entry) entry.count += 1;
  }

  get(ip) {
    return this.bans.get(ip);
  }
}

class DDoSProtectionService {
  constructor(options = {}) {
    const {
      // General API window
      apiWindowMs = 15 * 60 * 1000,
      apiMax = 100,
      // Auth window
      authWindowMs = 15 * 60 * 1000,
      authMax = 5,
      // Payment window
      paymentWindowMs = 1 * 60 * 1000,
      paymentMax = 10,
      // Ban configuration
      banWindowMs = 10 * 60 * 1000, // observe suspicious bursts over 10 min
      banThreshold = 100, // hits within banWindowMs => ban
      banTtlMs = 60 * 60 * 1000, // ban for 1 hour by default
      escalateBanTtlMs = 24 * 60 * 60 * 1000, // repeat offenders banned 24h
      maxBanEscalations = 3,
      // Trusted IPs never blocked
      trustedIps = [],
      // M-Pesa trusted IP ranges
      mpesaTrustedIps = DEFAULT_MPESA_TRUSTED_IPS,
      // MikroTik circuit breaker
      mikrotikFailureThreshold = 5,
      mikrotikRecoveryTimeoutMs = 30 * 1000,
      mikrotikFailureWindowMs = 60 * 1000,
    } = options;

    this.apiTracker = new SlidingWindowTracker(apiWindowMs);
    this.authTracker = new SlidingWindowTracker(authWindowMs);
    this.paymentTracker = new SlidingWindowTracker(paymentWindowMs);
    this.suspiciousTracker = new SlidingWindowTracker(banWindowMs);

    this.bans = new BanStore();
    this.apiMax = apiMax;
    this.authMax = authMax;
    this.paymentMax = paymentMax;
    this.banThreshold = banThreshold;
    this.banTtlMs = banTtlMs;
    this.escalateBanTtlMs = escalateBanTtlMs;
    this.maxBanEscalations = maxBanEscalations;
    this.trustedIps = new Set(
      trustedIps.filter(Boolean).map((ip) => normalizeIp(ip)).filter(Boolean)
    );
    this.mpesaTrustedCidrs = mpesaTrustedIps.map(parseCIDR);

    // MikroTik circuit breaker state
    this.mikrotikState = "closed"; // closed | open | half-open
    this.mikrotikFailures = new SlidingWindowTracker(mikrotikFailureWindowMs);
    this.mikrotikFailureThreshold = mikrotikFailureThreshold;
    this.mikrotikRecoveryTimeoutMs = mikrotikRecoveryTimeoutMs;
    this.mikrotikNextAttempt = 0;

    this._securityWriteStream = null;
  }

  /* ---------- Logging ---------- */

  _ensureSecurityStream() {
    if (!this._securityWriteStream) {
      this._securityWriteStream = fs.createWriteStream(SECURITY_LOG, {
        flags: "a",
      });
    }
  }

  logSecurityEvent(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };
    const line = JSON.stringify(entry) + "\n";
    try {
      this._ensureSecurityStream();
      this._securityWriteStream.write(line);
    } catch (err) {
      // Fall back to app logger so security events are never silently dropped
      logger.warn("DDoS security log write failed", { error: err.message });
    }
    logger.info(`SECURITY EVENT: ${event.type}`, {
      ip: event.ip,
      path: event.path,
      reason: event.reason,
    });
  }

  /* ---------- Trust / ban helpers ---------- */

  isTrustedIp(ip) {
    const n = normalizeIp(ip);
    return n ? this.trustedIps.has(n) : false;
  }

  isBanned(ip) {
    return this.bans.isBanned(ip);
  }

  banReason(ip) {
    const entry = this.bans.get(ip);
    return entry ? entry.reason : null;
  }

  /**
   * Record a suspicious hit. Returns true if the IP should be banned now.
   */
  recordSuspicious(ip, reason) {
    if (this.isTrustedIp(ip)) return false;
    const count = this.suspiciousTracker.record(ip);
    if (count >= this.banThreshold) {
      const existing = this.bans.get(ip);
      let ttl = this.banTtlMs;
      let escalations = 1;
      if (existing) {
        escalations = Math.min(existing.count + 1, this.maxBanEscalations);
        ttl =
          escalations >= this.maxBanEscalations
            ? this.escalateBanTtlMs
            : this.banTtlMs * escalations;
      }
      this.bans.ban(ip, ttl, reason);
      this.logSecurityEvent({
        type: "ip_auto_banned",
        ip,
        reason,
        ttlMs: ttl,
        hits: count,
      });
      return true;
    }
    return false;
  }

  /* ---------- Route limiters (middleware factories) ---------- */

  apiLimiter() {
    return (req, res, next) => {
      const ip = this.clientIp(req);
      if (this.isTrustedIp(ip)) return next();
      if (this.isBanned(ip)) {
        this.logSecurityEvent({
          type: "blocked_banned_ip",
          ip,
          path: req.originalUrl || req.url,
          reason: this.banReason(ip) || "banned",
        });
        return res.status(429).json({
          success: false,
          error: "Too many requests. Your IP has been temporarily blocked.",
        });
      }
      const count = this.apiTracker.count(ip);
      if (count > this.apiMax) {
        this.recordSuspicious(ip, "api_rate_limit_exceeded");
        return res.status(429).json({
          success: false,
          error: "Too many requests, please try again later.",
        });
      }
      this.apiTracker.record(ip);
      res.set("RateLimit-Limit", String(this.apiMax));
      res.set("RateLimit-Remaining", String(Math.max(0, this.apiMax - count)));
      next();
    };
  }

  authLimiter() {
    return (req, res, next) => {
      const ip = this.clientIp(req);
      if (this.isTrustedIp(ip)) return next();
      if (this.isBanned(ip)) {
        this.logSecurityEvent({
          type: "blocked_banned_ip",
          ip,
          path: req.originalUrl || req.url,
          reason: this.banReason(ip) || "banned",
        });
        return res.status(429).json({
          success: false,
          error: "Too many authentication attempts, please try again later.",
        });
      }
      const count = this.authTracker.count(ip);
      if (count >= this.authMax) {
        this.recordSuspicious(ip, "auth_rate_limit_exceeded");
        return res.status(429).json({
          success: false,
          error: "Too many authentication attempts, please try again later.",
        });
      }
      this.authTracker.record(ip);
      res.set("RateLimit-Limit", String(this.authMax));
      res.set("RateLimit-Remaining", String(Math.max(0, this.authMax - count)));
      next();
    };
  }

  paymentLimiter() {
    return (req, res, next) => {
      const ip = this.clientIp(req);
      if (this.isTrustedIp(ip)) return next();
      if (this.isBanned(ip)) {
        this.logSecurityEvent({
          type: "blocked_banned_ip",
          ip,
          path: req.originalUrl || req.url,
          reason: this.banReason(ip) || "banned",
        });
        return res.status(429).json({
          success: false,
          error: "Too many payment requests, please try again later.",
        });
      }
      const count = this.paymentTracker.count(ip);
      if (count >= this.paymentMax) {
        this.recordSuspicious(ip, "payment_rate_limit_exceeded");
        return res.status(429).json({
          success: false,
          error: "Too many payment requests, please try again later.",
        });
      }
      this.paymentTracker.record(ip);
      res.set("RateLimit-Limit", String(this.paymentMax));
      res.set("RateLimit-Remaining", String(Math.max(0, this.paymentMax - count)));
      next();
    };
  }

  /* ---------- Client IP extraction ---------- */

  clientIp(req) {
    const forwarded = splitForwardedFor(req.headers["x-forwarded-for"]);
    if (forwarded) return normalizeIp(forwarded);
    return normalizeIp(
      req.socket.remoteAddress ||
        req.connection.remoteAddress ||
        req.ip ||
        "127.0.0.1"
    );
  }

  mpesaIpMiddleware() {
    const trustedCidrs = (this.mpesaTrustedIps || DEFAULT_MPESA_TRUSTED_IPS).map(
      (c) => {
        const obj = parseCIDR(c);
        obj._cidr = c;
        return obj;
      }
    );
    return (req, res, next) => {
      const ip = this.clientIp(req);
      if (!ip) {
        this.logSecurityEvent({
          type: "mpesa_callback_rejected",
          ip: "unknown",
          path: req.originalUrl || req.url,
          reason: "unable_to_determine_client_ip",
        });
        return res.status(403).json({
          success: false,
          error: "Forbidden: unable to verify caller identity",
        });
      }
      const allowed = trustedCidrs.some((c) => ipInCidr(ip, c._cidr));
      if (!allowed) {
        this.logSecurityEvent({
          type: "mpesa_callback_rejected",
          ip,
          path: req.originalUrl || req.url,
          reason: "untrusted_source_ip",
        });
        return res.status(403).json({
          success: false,
          error: "Forbidden: untrusted callback source",
        });
      }
      next();
    };
  }

  /**
   * Idempotency key check for M-Pesa callbacks.
   * Returns { duplicate: true } if the same CheckoutRequestID was recently processed.
   */
  checkMpesaIdempotency(checkoutId) {
    if (!checkoutId) return { duplicate: false };
    const now = Date.now();
    const key = `mpesa:${checkoutId}`;
    const seen = this._mpesaSeen || (this._mpesaSeen = new Map());
    const entry = seen.get(key);
    if (entry && now - entry.ts < 5 * 60 * 1000) {
      return { duplicate: true, firstSeen: entry.ts };
    }
    seen.set(key, { ts: now });
    // Prune old entries occasionally
    if (seen.size > 10000) {
      for (const [k, v] of seen) {
        if (now - v.ts > 10 * 60 * 1000) seen.delete(k);
      }
    }
    return { duplicate: false };
  }

  /* ---------- MikroTik circuit breaker ---------- */

  mikrotikCircuitMiddleware() {
    return (req, res, next) => {
      // Only apply to routes that touch the router (whitelist/disconnect/status)
      const isMikrotikRoute =
        /\/network\/(devices|disconnect-all|status)|whitelistMAC|disconnectByMac/.test(
          req.originalUrl || req.url
        );
      if (!isMikrotikRoute) return next();

      const now = Date.now();
      if (this.mikrotikState === "open") {
        if (now < this.mikrotikNextAttempt) {
          this.logSecurityEvent({
            type: "mikrotik_circuit_open",
            ip: this.clientIp(req),
            path: req.originalUrl || req.url,
            reason: "router_unreachable_circuit_open",
          });
          return res.status(503).json({
            success: false,
            error: "Network services temporarily unavailable. Please retry shortly.",
            retryAfter: Math.ceil((this.mikrotikNextAttempt - now) / 1000),
          });
        }
        // Half-open: allow a single probe request
        this.mikrotikState = "half-open";
        return next();
      }
      next();
    };
  }

  recordMikrotikSuccess() {
    if (this.mikrotikState === "half-open") {
      this.mikrotikState = "closed";
      this.mikrotikFailures = new SlidingWindowTracker(
        this.mikrotikFailureWindowMs
      );
      this.mikrotikNextAttempt = 0;
      logger.info("MikroTik circuit breaker closed (recovered)");
      this.logSecurityEvent({
        type: "mikrotik_circuit_closed",
        reason: "router_recovered",
      });
    }
  }

  recordMikrotikFailure(error) {
    const count = this.mikrotikFailures.record("mikrotik");
    logger.error("MikroTik request failed", {
      error: error.message || String(error),
      failureCount: count,
    });
    this.logSecurityEvent({
      type: "mikrotik_request_failed",
      error: error.message || String(error),
      failureCount: count,
    });

    if (count >= this.mikrotikFailureThreshold) {
      this.mikrotikState = "open";
      this.mikrotikNextAttempt =
        Date.now() + this.mikrotikRecoveryTimeoutMs;
      this.logSecurityEvent({
        type: "mikrotik_circuit_opened",
        reason: `failure_threshold_reached (${count})`,
        retryAfter: Math.ceil(this.mikrotikRecoveryTimeoutMs / 1000),
      });
    }
  }

  /* ---------- MAC/IP spoofing heuristics ---------- */

  /**
   * Tracks recent MAC<->IP associations per client port/session to detect
   * rapid MAC cycling or abrupt concurrent IP changes.
   */
  macIpAssociation = new Map(); // mac -> { ip, firstSeen, lastSeen, changes }
  ipMacAssociation = new Map(); // ip -> { mac, lastSeen }

  recordMacIpSeen(mac, ip, clientPort) {
    if (!mac || !ip) return { suspicious: false };
    const key = String(mac).toLowerCase();
    const now = Date.now();
    const entry = this.macIpAssociation.get(key);
    let suspicious = false;
    let reason = null;

    if (!entry) {
      this.macIpAssociation.set(key, {
        ip,
        firstSeen: now,
        lastSeen: now,
        changes: 0,
        ports: clientPort ? [clientPort] : [],
      });
    } else {
      if (entry.ip !== ip) {
        entry.changes += 1;
        suspicious = entry.changes >= 3; // MAC seen with 3+ different IPs
        reason = "mac_ip_address_cycling";
      }
      entry.lastSeen = now;
      entry.ip = ip;
      if (clientPort && !entry.ports.includes(clientPort)) {
        entry.ports.push(clientPort);
        if (entry.ports.length > 5) entry.ports.shift();
      }
    }

    // Track IP -> MAC (reverse): abrupt IP reassignment to a different MAC
    const ipEntry = this.ipMacAssociation.get(ip);
    if (!ipEntry) {
      this.ipMacAssociation.set(ip, { mac: key, lastSeen: now });
    } else if (ipEntry.mac !== key) {
      suspicious = true;
      reason = "ip_mac_address_swapping";
      ipEntry.mac = key;
      ipEntry.lastSeen = now;
    }

    if (suspicious) {
      this.logSecurityEvent({
        type: "hotspot_spoofing_suspected",
        mac: key,
        ip,
        clientPort,
        reason,
      });
    }
    return { suspicious, reason };
  }

  getMacIpStats(mac) {
    return this.macIpAssociation.get(String(mac).toLowerCase()) || null;
  }

  /* ---------- Utility: general request logging / anomaly ---------- */

  logAnomaly(ip, type, detail) {
    this.logSecurityEvent({
      type: `anomaly_${type}`,
      ip,
      ...detail,
    });
  }

  close() {
    if (this._securityWriteStream) {
      this._securityWriteStream.end();
      this._securityWriteStream = null;
    }
  }
}

module.exports = {
  DDoSProtectionService,
  normalizeIp,
  ipInCidr,
  parseCIDR,
  DEFAULT_MPESA_TRUSTED_IPS,
  ipToInt,
};
