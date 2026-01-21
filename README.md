# WiFi Billing System

A comprehensive WiFi billing system with M-Pesa integration, loan management, and MikroTik hotspot control.
 
## Screenshots

![connections and payments](screenshots/Screenshot%202026-01-09%20213840.png)
*Dashboard view showing user connections and payments.*

![Billing interface and loan options](screenshots/Screenshot%202026-01-09%20213922.png)
*Billing interface with M-Pesa integration and loan options.*


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

See `PRODUCTION_DEPLOYMENT.md` for detailed deployment guides.

## Security Features

- JWT authentication with expiration
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Helmet.js security headers
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details.

## Support

For support, please create an issue in the GitHub repository.
