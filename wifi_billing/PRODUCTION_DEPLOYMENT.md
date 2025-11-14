# WiFi Billing System - Production Deployment Guide

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