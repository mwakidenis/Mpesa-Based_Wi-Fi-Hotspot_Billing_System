#!/bin/bash

# WiFi Billing System Production Deployment Script
# This script sets up the application for production use

set -e

echo "🚀 Starting WiFi Billing System Production Deployment"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please create one with production values."
    exit 1
fi

# Check if required environment variables are set
required_vars=("JWT_SECRET" "DATABASE_URL" "ADMIN_USERNAME" "ADMIN_PASSWORD")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo "❌ Error: ${var} not found in .env file"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗃️ Running database migrations..."
npx prisma db push

# Create logs directory
mkdir -p logs

# Create backups directory
mkdir -p backups

echo "✅ Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set your production environment variables in .env"
echo "2. Run 'npm start' to start the application"
echo "3. Or use PM2: 'pm2 start ecosystem.config.js'"
echo "4. Or use Docker: 'docker-compose up -d'"
echo ""
echo "🔒 Security reminders:"
echo "- Ensure JWT_SECRET is a strong, random string"
echo "- Use secure passwords for database and admin accounts"
echo "- Configure firewall rules"
echo "- Enable SSL/TLS in production"
echo ""
echo "🎉 Deployment ready!"