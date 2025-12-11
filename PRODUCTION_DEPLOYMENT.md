# InvoChain - Production Deployment Guide

## 🚀 Overview
InvoChain is a production-ready GST-compliant invoice management system with blockchain integration, automated reconciliation, and comprehensive tax reporting capabilities.

## 📋 System Requirements

### Production Environment
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher
- **Memory**: Minimum 4GB RAM
- **Storage**: Minimum 20GB SSD
- **OS**: Linux (Ubuntu 20.04+), Windows Server 2019+, or macOS

### Optional (Recommended for Production)
- **Redis**: For caching and session management
- **Nginx**: As reverse proxy
- **Docker**: For containerized deployment
- **PM2**: For process management

## 🔧 Environment Configuration

### 1. Database Setup

#### Create PostgreSQL Database
```bash
psql -U postgres
CREATE DATABASE invochain;
CREATE USER invochain_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE invochain TO invochain_user;
```

#### Apply Database Schema
```bash
# Run schema migrations in order
node apply-schema.js
node apply-extensions.js
node apply-additional-tables.js
```

### 2. Environment Variables

Create `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://invochain_user:your_secure_password@localhost:5432/invochain

# Services Ports
PORT=3000
AUTH_SERVICE_PORT=3011
INVOICE_SERVICE_PORT=3002
MERCHANT_SERVICE_PORT=3012
INVENTORY_SERVICE_PORT=3013
AUDIT_SERVICE_PORT=3014
PAYMENT_SERVICE_PORT=3010
RECONCILIATION_SERVICE_PORT=3006
GST_RETURN_SERVICE_PORT=3008
GST_ADAPTER_SERVICE_PORT=3009

# Frontend
VITE_API_URL=http://localhost:3000/api

# Security (Generate strong secrets in production)
JWT_SECRET=your_jwt_secret_here_min_32_chars
SESSION_SECRET=your_session_secret_here_min_32_chars

# Blockchain (Sepolia Testnet for production testing)
ETHEREUM_NETWORK=sepolia
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_ethereum_private_key

# GST API (For production GST portal integration)
GST_API_BASE_URL=https://api.gstsystem.com
GST_API_USERNAME=your_gst_username
GST_API_PASSWORD=your_gst_password

# Email (For notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password

# Storage
UPLOAD_DIR=./storage
MAX_FILE_SIZE=10485760  # 10MB

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

## 📦 Installation

### Development Mode
```bash
# Install all dependencies
npm run install:all

# Start all services
npm run dev
```

### Production Mode

#### Option 1: Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Build frontend
cd apps/web && npm run build

# Start services with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Option 2: Using Docker
```bash
# Build Docker images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option 3: Using Systemd (Linux)
```bash
# Create systemd service files for each service
sudo nano /etc/systemd/system/invochain-api.service
sudo nano /etc/systemd/system/invochain-auth.service
# ... (repeat for all services)

# Enable and start services
sudo systemctl enable invochain-api
sudo systemctl start invochain-api
```

## 🔒 Security Hardening

### 1. Database Security
- Use strong passwords (minimum 32 characters)
- Enable SSL connections
- Restrict database access to application servers only
- Regular backups (automated daily backups recommended)

### 2. API Security
- Enable HTTPS only (use Let's Encrypt for SSL certificates)
- Implement rate limiting
- Use JWT tokens with short expiration times
- Enable CORS only for trusted domains
- Sanitize all user inputs

### 3. Environment Security
- Never commit `.env` files to version control
- Use environment variable management tools (AWS Secrets Manager, HashiCorp Vault)
- Implement proper logging and monitoring
- Regular security audits

## 🌐 Nginx Configuration

Create `/etc/nginx/sites-available/invochain`:

```nginx
upstream api_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/invochain/apps/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 📊 Monitoring & Logging

### Setup PM2 Monitoring
```bash
# Install PM2 Plus for advanced monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Health Checks
Each service exposes a `/health` endpoint:
- API Gateway: http://localhost:3000/health
- Auth Service: http://localhost:3011/health
- Invoice Service: http://localhost:3002/health
- (etc.)

## 🔄 Backup Strategy

### Database Backups
```bash
# Daily automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump invochain > /backups/invochain_$DATE.sql
# Keep only last 30 days
find /backups -name "invochain_*.sql" -mtime +30 -delete
```

### File Storage Backups
```bash
# Backup uploaded files
tar -czf /backups/storage_$DATE.tar.gz ./storage
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 📈 Performance Optimization

### 1. Database Optimization
- Create indexes on frequently queried columns
- Enable connection pooling
- Use prepared statements
- Regular VACUUM and ANALYZE

### 2. Caching
- Implement Redis caching for frequently accessed data
- Cache GST return calculations
- Cache invoice listings

### 3. Load Balancing
- Use multiple instances behind a load balancer
- Implement sticky sessions for stateful operations

## 🚨 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux
lsof -ti:3000 | xargs kill -9
```

**Database Connection Issues**
- Check PostgreSQL is running
- Verify connection string in .env
- Ensure database user has proper permissions
- Check firewall rules

**Service Not Starting**
- Check logs: `pm2 logs service-name`
- Verify all dependencies installed
- Check environment variables
- Ensure correct Node.js version

## 📱 Features Status

### ✅ Fully Functional
- ✅ User Authentication & Authorization
- ✅ Merchant Registration & Management
- ✅ Invoice Creation (Itemized with GST)
- ✅ Invoice Status Management (Accept/Reject)
- ✅ Inventory Management (Auto-seeding)
- ✅ Inventory Reservation & Commitment
- ✅ GST Return Generation (GSTR-1 & GSTR-3B)
- ✅ Reconciliation Reports
- ✅ Payment Tracking & Analytics
- ✅ Dashboard with Live Stats
- ✅ Audit Logging
- ✅ Dark Mode UI
- ✅ Responsive Design

### 🔄 Partially Implemented
- 🔄 E-Invoice Generation (IRN)
- 🔄 Blockchain Integration
- 🔄 Credit/Debit Notes
- 🔄 Email Notifications

### 🔮 Planned Features
- GST Portal API Integration
- Advanced Analytics & Reporting
- Multi-currency Support
- Mobile Applications
- WhatsApp Notifications

## 🆘 Support

For issues or questions:
- GitHub Issues: [Repository URL]
- Documentation: [Docs URL]
- Email: support@invochain.com

## 📄 License

[Your License Here]

---

**Version**: 1.0.0  
**Last Updated**: November 2025
