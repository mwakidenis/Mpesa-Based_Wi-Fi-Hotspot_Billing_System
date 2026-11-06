# Hotspot Management System

A comprehensive WiFi billing system with M-Pesa integration, loan management, and MikroTik hotspot control.
 
## Screenshots

![connections and payments](https://res.cloudinary.com/dqv8dlj2s/image/upload/v1777533729/Screenshot_2026-04-30_101603_x3ab5b.png)
*Dashboard view showing user connections and payments.*

![Billing interface and loan options](https://res.cloudinary.com/dqv8dlj2s/image/upload/v1777531451/Screenshot_2026-04-30_091812_ufsztq.png)
*Billing interface with M-Pesa integration and loan options.*

![Admin dashboard](https://res.cloudinary.com/dqv8dlj2s/image/upload/v1777493918/Screenshot_2026-04-29_231640_wyrb4z.png)
*Admin dashboard.*

![Admin panel overview](https://res.cloudinary.com/dqv8dlj2s/image/upload/v1777493686/Screenshot_2026-04-29_231221_laesba.png)
*Admin panel overview.*


## Features

- 🔐 **Secure Authentication** - JWT-based user authentication
- 💳 **M-Pesa Integration** - Mobile money payments for WiFi access
- 💰 **Loan System** - Credit-based WiFi access for users
- 🌐 **MikroTik Integration** - Automated hotspot user management
- 📊 **Admin Dashboard** - Real-time monitoring and management
- 📱 **Responsive UI** - Modern React/Next.js frontend
- 🔄 **Real-time Updates** - WebSocket notifications

## Quick Deploy to Render

### 🚀 One-Click Deploy

1. **Fork this repository** to your GitHub account

2. **Connect to Render:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

3. **Configure Environment Secrets:**
   In your Render dashboard, go to your service settings and add these environment variables:

   | Variable | Description | Example |
   |----------|-------------|---------|
   | `JWT_SECRET` | Secure random string for JWT | `your-secure-random-jwt-secret` |
   | `ADMIN_USERNAME` | Admin login username | `admin` |
   | `ADMIN_PASSWORD` | Admin login password | `secure_password_123` |
   | `ADMIN_EMAIL` | Admin email | `admin@yourdomain.com` |
   | `MPESA_CONSUMER_KEY` | M-Pesa API key | From Safaricom Portal |
   | `MPESA_CONSUMER_SECRET` | M-Pesa API secret | From Safaricom Portal |
   | `MPESA_SHORTCODE` | Your M-Pesa shortcode | `123456` |
   | `MPESA_PASSKEY` | M-Pesa passkey | From Safaricom Portal |
   | `MIKROTIK_HOST` | MikroTik router IP | `192.168.88.1` |
   | `MIKROTIK_USER` | MikroTik username | `admin` |
   | `MIKROTIK_PASSWORD` | MikroTik password | `your_password` |

4. **Deploy:**
   - Render will automatically create PostgreSQL database
   - Deploy the web service
   - Your app will be live at `https://your-app-name.onrender.com`

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Docker)
- Git

### Setup

```bash
# Clone repository
git clone <your-repo-url>
cd wifi_billing

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your environment variables in .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev

# Start frontend (in another terminal)
cd frontend && npm run dev
```

## Project Structure

```
wifi_billing/
├── config/          # Database and service configurations
├── routes/          # API endpoints
├── services/        # Business logic
├── middleware/      # Authentication and security
├── prisma/          # Database schema and migrations
├── frontend/        # Next.js React application
├── src/            # Shared utilities (logger, etc.)
└── logs/           # Application logs
```

## API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Payments
- `POST /pay` - Initiate M-Pesa payment
- `POST /api/mpesa/callback` - M-Pesa callback handler

### Loans
- `GET /loans/eligibility` - Check loan eligibility
- `POST /loans/request` - Request a loan
- `POST /loans/repay/initiate/:loanId` - Initiate loan repayment

### Admin
- `GET /api/admin/summary` - Dashboard summary
- `GET /admin/payments` - Payment history

## Environment Variables

See `.env.example` for all required environment variables.

## Deployment Options

- **Render** (Recommended): One-click cloud deployment
- **Docker**: Containerized deployment
- **PM2**: Process management for VPS
- **Manual**: Direct Node.js deployment

# Production Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- PM2 (for process management)
- Docker & Docker Compose (optional)
- Linux/Windows server with at least 2GB RAM

## Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd wifi_billing
   cp .env.example .env  # Configure your environment variables
   ```

2. **Run deployment script:**
   ```bash
   ./deploy.sh
   ```

3. **Start with PM2:**
   ```bash
   npm run pm2:start
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server
PORT=5000
NODE_ENV=production

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/wifi_billing

# Security
JWT_SECRET=your-secure-random-jwt-secret-here

# Admin Credentials
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_admin_password
ADMIN_EMAIL=admin@yourdomain.com

# M-Pesa Integration
MPESA_ENABLED=true
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_SHORTCODE=your_mpesa_shortcode
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# MikroTik Integration
MIKROTIK_ENABLED=true
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=your_mikrotik_user
MIKROTIK_PASSWORD=your_mikrotik_password
MIKROTIK_PORT=8728

# Loan Configuration
LOAN_WIFI_DURATION_HOURS=1
```

## Deployment Options

### Option 1: Render (Recommended for Cloud)

Render provides managed PostgreSQL and automatic deployments from Git.

#### Setup Steps:

1. **Connect Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select the `render.yaml` file

2. **Configure Secrets:**
   In Render Dashboard → Settings → Environment:
   ```
   JWT_SECRET: your-secure-random-jwt-secret
   ADMIN_USERNAME: your_admin_username
   ADMIN_PASSWORD: your_secure_admin_password
   ADMIN_EMAIL: admin@yourdomain.com
   MPESA_CONSUMER_KEY: your_mpesa_consumer_key
   MPESA_CONSUMER_SECRET: your_mpesa_consumer_secret
   MPESA_SHORTCODE: your_mpesa_shortcode
   MPESA_PASSKEY: your_mpesa_passkey
   MPESA_CALLBACK_URL: https://your-render-app.onrender.com/api/mpesa/callback
   MIKROTIK_ENABLED: true
   MIKROTIK_HOST: your_mikrotik_ip
   MIKROTIK_USER: your_mikrotik_username
   MIKROTIK_PASSWORD: your_mikrotik_password
   MIKROTIK_PORT: 8728
   ```

3. **Deploy:**
   - Render will automatically create PostgreSQL database
   - Deploy the web service
   - Update M-Pesa callback URL with your Render domain

#### Benefits:
- ✅ Free tier available
- ✅ Managed PostgreSQL
- ✅ Automatic SSL certificates
- ✅ Global CDN
- ✅ Automatic deployments on git push

### Option 2: PM2 (Self-hosted)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
npm run pm2:start

# Check status
npm run pm2:monit

# View logs
npm run pm2:logs
```

### Option 3: Docker Compose (Self-hosted)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

### Option 4: Direct Node.js (Development)

```bash
# Start
npm start

# Or with PM2
pm2 start index.js --name wifi-billing
```

## Database Setup

1. **Create PostgreSQL database:**
   ```sql
   CREATE DATABASE wifi_billing;
   CREATE USER wifi_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE wifi_billing TO wifi_user;
   ```

2. **Run migrations:**
   ```bash
   npx prisma db push
   ```

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong admin passwords
- [ ] Configure firewall (allow only ports 80, 443, 5000)
- [ ] Enable SSL/TLS with Let's Encrypt
- [ ] Set up log rotation
- [ ] Configure backup strategy
- [ ] Monitor system resources
- [ ] Set up fail2ban for SSH protection

## Monitoring

```bash
# PM2 monitoring
npm run pm2:monit

# Application health check
curl http://localhost:5000/welcome

# Database connection
npx prisma db execute --file check-db.sql
```

## Backup Strategy

```bash
# Database backup
pg_dump wifi_billing > backup_$(date +%Y%m%d_%H%M%S).sql

# Application logs
tar -czf logs_$(date +%Y%m%d).tar.gz logs/
```

## Troubleshooting

### Common Issues

1. **Database connection fails:**
   - Check DATABASE_URL format
   - Ensure PostgreSQL is running
   - Verify user permissions

2. **M-Pesa callbacks not working:**
   - Verify callback URL is accessible
   - Check M-Pesa credentials
   - Review firewall settings

3. **MikroTik connection issues:**
   - Verify IP address and credentials
   - Check network connectivity
   - Ensure API is enabled on MikroTik

### Logs Location

- Application logs: `logs/`
- PM2 logs: `~/.pm2/logs/`
- System logs: `/var/log/`

## Performance Tuning

- Set Node.js memory limit: `node --max-old-space-size=1024 index.js`
- Configure PostgreSQL connection pool
- Enable gzip compression
- Set up Redis for session storage (future enhancement)

## Support

For issues, check:
1. Application logs
2. PM2 status: `pm2 status`
3. Database connectivity
4. Network configuration

## Security Features

- JWT authentication with expiration
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Helmet.js security headers
- CORS configuration

## DDoS Protection & Rate Limiting

The system implements a multi-layered DDoS and traffic abuse defense tailored for
ISP / Wi-Fi Hotspot environments. All controls live in `services/ddosProtection.service.js`
with a shared instance at `services/ddosInstance.js`.

### Layer 1 — Sliding-window rate limiters

| Route group | Limit | Window | Purpose |
|-------------|-------|--------|---------|
| `/api/auth/*` | 5 req | 15 min | Brute-force login/register protection |
| `/pay`, `/api/mpesa/*` | 10 req | 1 min | STK Push spam prevention |
| General API | 100 req | 15 min | API scraping / flood mitigation |

Tune via `AUTH_RATE_LIMIT_MAX`, `PAYMENT_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`
and their `*_WINDOW_MS` counterparts in `.env`.

### Layer 2 — Auto-ban & escalation

IPs exceeding `BAN_THRESHOLD` suspicious hits within `BAN_WINDOW_MS` are
temporarily auto-banned (`BAN_TTL_MS`, escalating to `ESCALATE_BAN_TTL_MS` for
repeat offenders). Bans are logged to `logs/security.log`. Trusted IPs
(`TRUSTED_IPS`) bypass all limits.

### Layer 3 — M-Pesa callback hardening

- **Source IP whitelisting:** Only Safaricom Daraja callback IPs
  (`MPESA_TRUSTED_IPS`, CIDR notation) may POST to `/api/mpesa/callback`.
  Untrusted sources receive `403 Forbidden` and are logged.
- **Idempotency / replay protection:** Duplicate callback delivery for the same
  `CheckoutRequestID` within 5 minutes is acknowledged with `200` without
  re-granting WiFi time or double-crediting.

Set `MPESA_TRUSTED_IPS` to Safaricom's official ranges in production (default
allows `127.0.0.1` for development only).

### Layer 4 — Payload size protection

All routes parse bodies with `express.json({ limit: '10kb' })`. Oversized
payloads are rejected with `413 Payload Too Large` to prevent memory-exhaustion
attacks.

### Layer 5 — MikroTik circuit breaker

If the RB750UPr router is unreachable or slow, the circuit breaker opens and
returns `503` fast instead of blocking the Node event loop. It auto-recovers
after `MIKROTIK_CIRCUIT_RECOVERY_MS`. Failures and state changes are logged.

### Layer 6 — MAC/IP spoofing detection

The hotspot shield middleware tracks MAC↔IP associations per client port.
Rapid MAC cycling or IP↔MAC swapping triggers security-log events, and repeat
suspects are auto-banned.

### Security event logging

All security events (bans, rejected callbacks, circuit opens, spoofing
suspicions) are written to `logs/security.log` (JSON lines) and forwarded to
the Winston logger.

### Running the verification tests

```bash
node test_ddos_limits.js
```

This exercises rate-limit enforcement (429), payload rejection (413),
auto-ban, trusted-IP bypass, M-Pesa idempotency/replay, and IP whitelisting.

### Environment variables

Add these to `.env` (see `.env.example` for full list):

```env
TRUST_PROXY=true
TRUSTED_IPS=127.0.0.1
MPESA_TRUSTED_IPS=197.231.184.0/24,127.0.0.1/32
API_RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5
PAYMENT_RATE_LIMIT_MAX=10
BAN_THRESHOLD=100
MIKROTIK_CIRCUIT_FAILURE_THRESHOLD=5
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request


## Project Admin ⚡

<table align="center">
  <tr>
    <td align="center">
      <img src="https://res.cloudinary.com/dqv8dlj2s/image/upload/v1772276752/IMG_20251220_111730_cqlgfo.jpg" width="750" height="250" />
</a>
      <h4>mwakidenis</h4>
    </td>
  </tr>
</table>

## Contributors

I extend my heartfelt gratitude for any invaluable contribution to this project! Your efforts play a pivotal role in elevating the repo to greater heights.

## Support

For support, strictly create an issue in the GitHub repository. Am done up to the point of testing with real Mikrotik RB750UPr, Currently am working on DDOS management on the system.
Contact me only for paid consultations regarding Mpesa-Based_Wi-Fi-Hotspot_Billing_System repository.
