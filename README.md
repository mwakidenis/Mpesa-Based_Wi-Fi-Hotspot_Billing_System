# M-Pesa Based WiFi Billing System

A comprehensive WiFi billing system that enables users to purchase internet access via M-Pesa STK Push payments. Designed for cybercafés, small businesses, and public WiFi hotspots, this system integrates with MikroTik routers for secure MAC address-based access control.

## Features

- **M-Pesa Integration**: Secure STK Push payments directly from users' phones
- **Time-Based Access**: Flexible internet access packages based on payment amounts
- **Admin Dashboard**: Comprehensive management interface for payments, users, and system settings
- **MAC Address Whitelisting**: Automatic router integration for secure WiFi access
- **Real-Time Monitoring**: Track user sessions, payments, and system status
- **Responsive Frontend**: Modern React-based user interface with dark/light themes
- **Database Management**: Prisma ORM with MySQL for reliable data storage

## Tech Stack

- **Backend**: Node.js, Express.js, Prisma ORM
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Database**: MySQL
- **Router Integration**: MikroTik API
- **Payment Gateway**: M-Pesa Daraja API
- **Authentication**: JWT with bcrypt password hashing

## Prerequisites

Before running this application, ensure you have the following installed on your system:

### Required Software
- **Node.js** (version 16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MySQL Server** (version 8.0 or higher) - [Download](https://dev.mysql.com/downloads/mysql/)
- **Python** (version 3.x, for hotspot server) - [Download](https://www.python.org/downloads/)

### M-Pesa Setup
1. Register for a M-Pesa Daraja account at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an app and obtain:
   - Consumer Key
   - Consumer Secret
   - Passkey
   - Shortcode (Business PayBill number)

### MikroTik Router (Optional)
- MikroTik router with API access enabled
- RouterOS version 6.x or higher
- API credentials (username/password)

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Nigiddy/Mpesa_Based-WiFi-Billing-System.git
cd Mpesa_Based-WiFi-Billing-System
```

### 2. Install Backend Dependencies
```bash
npm install
```

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 4. Database Setup
1. Create a MySQL database named `wifi_billing`
2. Update the `.env` file with your database credentials (see Environment Configuration below)

### 5. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_mpesa_consumer_key_here
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret_here
MPESA_PASSKEY=your_mpesa_passkey_here
MPESA_SHORTCODE=your_mpesa_shortcode_here
MPESA_CALLBACK_URL=http://localhost:5000/api/mpesa/callback

# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/wifi_billing"

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password_here

# Server Port
PORT=5000

# MikroTik Configuration (Optional)
MIKROTIK_HOST=your_router_ip
MIKROTIK_USERNAME=your_router_username
MIKROTIK_PASSWORD=your_router_password
```

**Security Note**: Never commit the `.env` file to version control. Add it to `.gitignore`.

### 6. Database Migration
Run Prisma migrations to set up the database schema:
```bash
npx prisma migrate dev --name init
```

Generate the Prisma client:
```bash
npx prisma generate
```

### 7. Create Admin User
Run the admin creation script:
```bash
node scripts/addAdmin.js
```

## Running the Application

### Start the Backend Server
```bash
npm start
```
The backend will run on `http://localhost:5000`

### Start the Frontend
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:3000`

### Start the Hotspot Login Server
```bash
python -m http.server 8080 --directory hotspot
```
The hotspot login page will be available at `http://localhost:8080/login.html`

## Usage

### For Users
1. Connect to the WiFi network
2. Open a browser - you'll be redirected to the login page
3. Select a package and enter your phone number
4. Complete the M-Pesa STK Push payment
5. Access will be granted automatically

### For Admins
1. Navigate to `http://localhost:3000/admin/login`
2. Login with admin credentials
3. Access the dashboard to:
   - View payment history
   - Manage users
   - Monitor system status
   - Configure settings

## API Endpoints

### Payment Endpoints
- `POST /api/pay` - Initiate M-Pesa payment
- `POST /api/mpesa/callback` - M-Pesa payment callback

### Admin Endpoints
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/payments` - Get payment records
- `GET /api/admin/users` - Get user records

### User Endpoints
- `GET /api/packages` - Get available packages
- `GET /api/user/status` - Get user access status

## Configuration

### MikroTik Integration
To enable automatic MAC address whitelisting:

1. Enable API access on your MikroTik router:
   ```
   /ip service set api disabled=no
   /user set admin password=your_password
   ```

2. Update the `.env` file with router credentials

3. The system will automatically add/remove MAC addresses based on payment status

### Package Configuration
Packages are defined in the frontend code. To modify packages, edit `frontend/lib/constants.ts`

## Troubleshooting

### Common Issues

**Database Connection Error**
- Ensure MySQL is running
- Verify DATABASE_URL in .env file
- Check database credentials

**M-Pesa Payment Failures**
- Verify M-Pesa credentials in .env
- Ensure callback URL is accessible (use ngrok for testing)
- Check M-Pesa account balance and limits

**Frontend Build Errors**
- Clear Next.js cache: `cd frontend && rm -rf .next`
- Reinstall dependencies: `cd frontend && rm -rf node_modules && npm install`

**Hotspot Login Not Working**
- Ensure Python HTTP server is running on port 8080
- Check firewall settings
- Verify hotspot/login.html exists

### Logs
- Backend logs are displayed in the terminal
- Check browser console for frontend errors
- Database logs can be found in MySQL error logs

## Development

### Project Structure
```
wifi_billing/
├── api/                    # API route handlers
├── config/                 # Configuration files
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   └── lib/               # Utilities and constants
├── hotspot/               # Hotspot login page
├── middleware/            # Express middleware
├── models/                # Database models
├── prisma/                # Database schema
├── routes/                # API routes
├── scripts/               # Utility scripts
└── index.js               # Main server file
```

### Available Scripts
- `npm run dev` - Start backend in development mode
- `npm start` - Start backend in production mode
- `cd frontend && npm run dev` - Start frontend in development mode
- `cd frontend && npm run build` - Build frontend for production
- `cd frontend && npm run lint` - Run ESLint

## Security Considerations

- Change default admin credentials immediately
- Use HTTPS in production
- Regularly update dependencies
- Monitor API usage and implement rate limiting
- Secure database access with proper user permissions
- Validate all user inputs
- Use environment variables for sensitive data

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

<<<<<<< HEAD
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
=======
This project is licensed under the GNU License - see the [LICENSE](LICENSE) file for details.
>>>>>>> f6c8c035e5e1bd5e8c040c3469e52a4ef2b08bdf

## Support

For support and inquiries:
- Email: mwakidenice@gmail.com
- WhatsApp: https://wa.me/254798750585
  ##
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%B5-yellow)](https://wa.me/254798750585)

**Note**: Professional consultation services are available for custom implementations and support.
