"use strict";

const ddos = require("../services/ddosInstance");
const logger = require("../src/logger");

/**
 * Hotspot shield middleware.
 * Detects MAC/IP spoofing heuristics on hotspot provisioning paths and
 * logs security events. Does not block legitimate traffic by default;
 * repeat offenders are handed to the DDoS auto-ban tracker.
 */
function hotspotShield() {
  return (req, res, next) => {
    const ip = ddos.clientIp(req);
    const mac = req.body && (req.body.macAddress || req.body.mac || req.body["mac-address"]);
    const clientPort = req.socket && req.socket.remotePort ? String(req.socket.remotePort) : null;

    let suspicious = false;
    let reason = null;

    if (mac && ip) {
      const result = ddos.recordMacIpSeen(mac, ip, clientPort);
      suspicious = result.suspicious;
      reason = result.reason;
    }

    if (suspicious) {
      // Escalate repeat spoofing suspects into the ban tracker
      const hitCount = (req.app.locals.spoofHits = req.app.locals.spoofHits || {});
      hitCount[ip] = (hitCount[ip] || 0) + 1;
      if (hitCount[ip] >= 5) {
        ddos.recordSuspicious(ip, `hotspot_spoofing:${reason}`);
        logger.warn("Hotspot spoofing suspect auto-banned", { ip, mac, reason, hits: hitCount[ip] });
      }
    }

    // Attach security context for downstream route handlers
    req.security = req.security || {};
    req.security.clientIp = ip;
    req.security.spoofingSuspected = suspicious;
    req.security.spoofReason = reason;

    next();
  };
}

module.exports = { hotspotShield };
