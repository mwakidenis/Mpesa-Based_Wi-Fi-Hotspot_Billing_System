# M-Pesa Based WiFi Billing System

[![Node.js](https://img.shields.io/badge/Node.js-16+-green)](https://nodejs.org/)  
[![MySQL](https://img.shields.io/badge/MySQL-8+-blue)](https://www.mysql.com/) 
[![Next.js](https://img.shields.io/badge/Next.js-13-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-brightgreen)](https://anotherone-production-dcdb.up.railway.app/)

A comprehensive WiFi billing system that allows users to purchase internet access via **M-Pesa STK Push payments**. Perfect for cybercafés, small businesses, and public WiFi hotspots, with MikroTik integration for secure MAC-based access control. 

---

## 🌟 Features

- **M-Pesa Integration**: STK Push payments directly from user phones  
- **Time-Based Access**: Flexible internet access packages  
- **Admin Dashboard**: Manage payments, users, and system settings  
- **MAC Address Whitelisting**: Automatic router integration  
- **Real-Time Monitoring**: Track sessions, payments, and system status  
- **Responsive Frontend**: React-based UI with dark/light themes  
- **Database Management**: Prisma ORM with MySQL  

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, Prisma ORM  
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS  
- **Database**: MySQL  
- **Router Integration**: MikroTik API  
- **Payment Gateway**: M-Pesa Daraja API  
- **Authentication**: JWT + bcrypt  

---

## 🚀 Live Demo

👉[ View Live Demo](https://anotherone-production-dcdb.up.railway.app/)

---

## 💻 Prerequisites

- Node.js (v16+)  
- npm  
- MySQL Server (v8+)  
- Python 3.x (for hotspot server)  

### M-Pesa Setup

1. Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)  
2. Obtain: Consumer Key, Consumer Secret, Passkey, Shortcode  

### MikroTik Router (Optional)

- RouterOS 6.x+ with API access enabled  
- Username/password credentials  

---

## ⚡ Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/Nigiddy/Mpesa_Based-WiFi-Billing-System.git
cd Mpesa_Based-WiFi-Billing-System
2. Install Dependencies
bash
Copy code
npm install
cd frontend
npm install
cd ..
3. Configure Database
Create MySQL database wifi_billing

Add .env file with credentials:

env
Copy code
# M-Pesa
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=your_shortcode
MPESA_CALLBACK_URL=http://localhost:5000/api/mpesa/callback

# Database
DATABASE_URL="mysql://username:password@localhost:3306/wifi_billing"

# JWT
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
4. Database Migration
bash
Copy code
npx prisma migrate dev --name init
npx prisma generate
5. Create Admin User
bash
Copy code
node scripts/addAdmin.js
🏃 Running the Application
Backend
bash
Copy code
npm start
Backend: http://localhost:5000

Frontend
bash
Copy code
cd frontend
npm run dev
Frontend: http://localhost:3000

Hotspot Login Server
bash
Copy code
python -m http.server 8080 --directory hotspot
Login page: http://localhost:8080/login.html

👥 Usage
Users
Connect to WiFi

Open browser → redirected to login

Select package & enter phone number

Complete M-Pesa STK Push

Access granted automatically

Admins
Login at http://localhost:3000/admin/login

Manage payments, users, and system status

🔗 API Endpoints
Payment

POST /api/pay - Initiate payment

POST /api/mpesa/callback - M-Pesa callback

Admin

POST /api/admin/login - Admin login

GET /api/admin/payments - List payments

GET /api/admin/users - List users

User

GET /api/packages - List packages

GET /api/user/status - Access status

🤝 Contributing
Fork the repo

Create branch: git checkout -b feature-name

Make changes & test

Commit: git commit -am 'Add feature'

Push: git push origin feature-name

Open Pull Request

⚖ License
MIT License – see LICENSE for details.

💌 Support
Email: mwakidenice@gmail.com

WhatsApp: [Chat on WhatsApp] +254798750585 



Made with ❤️ in Africa by Mwaki Denis ❤️ for the World 🌍

