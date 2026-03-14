# Security Policy

## Supported Versions

The following versions of the **Mpesa-Based Wi-Fi Hotspot Billing System** are currently supported with security updates.

| Version | Supported |
|--------|-----------|
| 2.x | :white_check_mark: |
| 1.x | :white_check_mark: |
| < 1.0 | :x: |

---

# Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

Send a detailed report to:

📧 **mwakidenice@gmail.com**

Your report should include:

- Description of the vulnerability
- Steps to reproduce the issue
- Proof-of-concept exploit (if available)
- Impact assessment
- Suggested mitigation (optional)

Please avoid publicly disclosing the vulnerability until it has been reviewed and patched.

---

# Security Scope

This project involves **Wi-Fi hotspot billing and M-Pesa payment processing**, therefore the following areas are considered critical:

- Payment processing endpoints
- Authentication systems
- Network access control
- Router / hotspot integration
- API callbacks from payment providers
- User account and billing data

Mobile payment integrations such as **M-Pesa APIs** typically require secure token authentication and callback validation, which are important areas to monitor for vulnerabilities. :contentReference[oaicite:2]{index=2}

---

# Disclosure Process

After receiving a vulnerability report:

1. The issue will be acknowledged within **48 hours**.
2. The vulnerability will be assessed and verified.
3. A security patch will be developed.
4. A fix will be released in a new version.
5. The reporter may be credited if they wish.

---

# Security Best Practices

Users deploying this system should follow these recommendations:

- Always run the **latest version** of the software
- Use **HTTPS for all API endpoints**
- Protect M-Pesa API credentials
- Restrict callback URLs to trusted sources
- Regularly update dependencies
- Secure hotspot router management interfaces

---

# Dependencies Vulnerabilities

If you discover a vulnerability related to a dependency used in this project, please verify:

1. The dependency version used by this project is vulnerable.
2. The vulnerability affects this system's functionality.

If both conditions apply, please report it through the security contact above.

---

# Responsible Disclosure

We kindly request responsible disclosure practices.

Please do not publicly disclose vulnerabilities until they are fixed.

---

Thank you for helping keep the **Mpesa-Based Wi-Fi Hotspot Billing System** secure 🔐
