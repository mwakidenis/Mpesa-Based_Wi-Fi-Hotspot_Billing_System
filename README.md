M-Pesa Based WiFi Billing System












A comprehensive WiFi billing system enabling users to purchase internet access via M-Pesa STK Push.
Ideal for cybercafés, small businesses, and public WiFi hotspots — with MikroTik router integration for secure MAC-based access control.

🌟 Features

✔ M-Pesa STK Push Integration

✔ Time-Based Internet Access Packages

✔ Admin Dashboard

✔ MAC Address Whitelisting (MikroTik)

✔ Real-Time Session + Payment Tracking

✔ Modern Next.js + Tailwind UI

✔ Prisma ORM + MySQL

🛠 Tech Stack

Backend: Node.js, Express.js, Prisma
Frontend: Next.js, React, TypeScript, Tailwind CSS
Database: MySQL
Router: MikroTik API
Payments: M-Pesa Daraja API
Auth: JWT + bcrypt

🚀 Live Demo

🔗 https://anotherone-production-dcdb.up.railway.app/

💻 Prerequisites

Node.js 16+

npm

MySQL 8+

Python 3.x (for hotspot server)

M-Pesa Requirements

Create an app in Safaricom Daraja

Get:

Consumer Key

Consumer Secret

Passkey

Shortcode

MikroTik (Optional)

RouterOS 6.x+

API service enabled

⚡ Installation & Setup
1. Fork & Clone the Repository

Fork this repo:
👉 https://github.com/mwakidenis/Mpesa-Based_WiFi_Billing_System

Clone it:

git clone https://github.com/mwakidenis/Mpesa-Based_WiFi_Billing_System.git
cd Mpesa-Based_WiFi_Billing_System

2. Install Dependencies
npm install

cd frontend
npm install
cd ..

3. Create MySQL Database

Create a database:

CREATE DATABASE wifi_billing;

4. Create .env File
# M-Pesa
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=your_shortcode
MPESA_CALLBACK_URL=http://localhost:5000/api/mpesa/callback

# Database
DATABASE_URL="mysql://username:password@localhost:3306/wifi_billing"

# Auth
JWT_SECRET=your_jwt_secret

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password

# Server
PORT=5000

# MikroTik (optional)
MIKROTIK_HOST=router_ip
MIKROTIK_USERNAME=username
MIKROTIK_PASSWORD=password

5. Run Database Migrations
npx prisma migrate dev --name init
npx prisma generate

6. Create Admin User
node scripts/addAdmin.js

🏃 Running the Application
Backend
npm start


Runs at: http://localhost:5000

Frontend
cd frontend
npm run dev


Runs at: http://localhost:3000

Hotspot Login Server
python -m http.server 8080 --directory hotspot


Login page: http://localhost:8080/login.html

👥 Usage
For Users

Connect to the WiFi network

Browser redirects to login page

Choose package

Enter phone number

Complete STK Push

Access granted automatically

For Admins

Visit: http://localhost:3000/admin/login

Manage:

Users

Payments

System settings

🔗 API Endpoints
Payment
POST /api/pay
POST /api/mpesa/callback

Admin
POST /api/admin/login
GET  /api/admin/payments
GET  /api/admin/users

User
GET /api/packages
GET /api/user/status

⚙️ Configuration
MikroTik

Enable API:

/ip service set api disabled=no


Add credentials in .env.

Packages

Modify in:

frontend/lib/constants.ts

🛠 Development
Project Structure
wifi_billing/
├── api/
├── config/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── hotspot/
├── middleware/
├── models/
├── prisma/
├── routes/
├── scripts/
└── index.js

Useful Commands
npm run dev
npm start
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint

🔒 Security

Change default admin credentials

Use HTTPS in production

Update dependencies

Enable rate limiting

Validate all inputs

Secure MySQL user privileges

🤝 Contributing

Fork the repo: https://github.com/mwakidenis/Mpesa-Based_WiFi_Billing_System

Create a branch:

git checkout -b feature-name


Commit:

git commit -am "Add feature"


Push:

git push origin feature-name


Open a Pull Request

⚖ License

MIT License — see LICENSE file.

💌 Support

Email: mwakidenice@gmail.com

WhatsApp: Chat on WhatsApp

Made with ❤️ in Africa for the World 🌍
