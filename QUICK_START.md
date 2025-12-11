# InvoChain - Quick Start Guide

## 🚀 5-Minute Setup

### Prerequisites
- Node.js v18+ installed
- PostgreSQL 14+ installed and running
- Git installed

### Step 1: Clone & Install (2 minutes)

```bash
# Clone repository
cd Invo_Chain

# Install all dependencies
npm run install:all
```

### Step 2: Database Setup (2 minutes)

```bash
# Ensure PostgreSQL is running on port 5433
# If using default port 5432, check docker-compose.yml

# Apply database schemas
node apply-schema.js
node apply-extensions.js
node apply-additional-tables.js
```

### Step 3: Start Application (1 minute)

```bash
# Start all services and frontend
npm run dev
```

Wait for all services to start (look for "ready" messages).

### Step 4: Access Application

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000

## 🎯 First-Time Usage

### 1. Register Your Account (1 minute)

1. Open http://localhost:5173/register
2. Fill in the form:
   - **Business Name**: Your Company Name
   - **GSTIN**: 27ABCDE1234F1Z5 (use this format)
   - **Email**: your@email.com
   - **Password**: Strong password
   - **Phone**: Your phone number
   - **Address**: Your business address
3. Click "Register"
4. You should see a success message

### 2. Login (30 seconds)

1. Go to http://localhost:5173/login
2. Enter your email and password
3. Click "Sign In"
4. You'll be redirected to the Dashboard

### 3. Create Your First Invoice (2 minutes)

1. Click "Invoices" in navigation
2. Click "Create Invoice" button
3. Notice "Seller Merchant ID" is auto-filled (your ID)
4. Fill in:
   - **Invoice Number**: INV-2025-001
   - **Buyer GSTIN**: 29XYZAB1234C1Z5
   - **Invoice Date**: Select today
   - **Due Date**: Select a future date

5. **Add Items**:
   - SKU: `PROD-001`
   - Description: `Test Product`
   - Quantity: `10`
   - Unit Price: `100`
   - GST Rate: `18%`
   - Click "Add" button

6. Add more items if needed
7. Click "Create Invoice"
8. Success! Your first invoice is created

### 4. View Invoice Details (30 seconds)

1. Click "View" on your newly created invoice
2. See all details including items
3. Notice the "Accept" and "Reject" buttons

### 5. Accept the Invoice (30 seconds)

1. Click "Accept" button
2. Confirm the action
3. Notice status changes to "ACCEPTED"
4. Inventory is automatically updated!

### 6. Generate GST Return (1 minute)

1. Click "GST Returns" in navigation
2. Click "Generate GSTR-1" button
3. Wait a few seconds
4. Click "View" on the generated return
5. See your invoice data formatted for GST filing
6. Close the modal
7. Click "File" to mark it as filed

### 7. Check Your Dashboard (30 seconds)

1. Click "Dashboard" in navigation
2. See your statistics:
   - Total Invoices: 1
   - Recent Activity shows your invoice

## 🎉 Congratulations!

You've successfully:
- ✅ Set up InvoChain
- ✅ Created a user account
- ✅ Created an invoice with items
- ✅ Accepted an invoice (inventory updated)
- ✅ Generated a GST return

## 📚 Next Steps

### Explore More Features

1. **Create Multiple Invoices**
   - Test different scenarios
   - Try rejecting an invoice
   - See inventory changes

2. **Run Reconciliation**
   - Go to "Reconciliation"
   - Click "Run Reconciliation"
   - See any discrepancies

3. **Check Inventory**
   - Open database viewer
   - Query: `SELECT * FROM inventory`
   - See auto-created items

4. **Generate GSTR-3B**
   - Go to GST Returns
   - Click "Generate GSTR-3B"
   - Compare with GSTR-1

### Database Queries to Try

```sql
-- See your user and merchant
SELECT u.email, m.gstin, m.legal_name 
FROM users u 
JOIN merchants m ON u.id = m.user_id;

-- See all invoices with items
SELECT 
  i.invoice_number,
  i.total_amount,
  i.status,
  COUNT(ii.id) as item_count
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id;

-- See inventory with available stock
SELECT 
  sku,
  name,
  quantity,
  reserved_quantity,
  (quantity - reserved_quantity) as available
FROM inventory;

-- See inventory events
SELECT 
  ie.event_type,
  ie.quantity_change,
  ie.created_at,
  i.sku
FROM inventory_events ie
JOIN inventory i ON ie.inventory_id = i.id
ORDER BY ie.created_at DESC;
```

## 🔧 Troubleshooting

### Services Won't Start

```bash
# Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# Kill processes if needed
taskkill /PID <PID> /F

# Restart
npm run dev
```

### Database Connection Error

```bash
# Check PostgreSQL is running
# Windows: Services → PostgreSQL
# Or restart Docker container if using Docker

# Verify connection in .env or service files
# Default: postgresql://admin:password@localhost:5433/invochain
```

### Frontend Not Loading

```bash
# Clear browser cache
# Or open in incognito mode
# Check console for errors (F12)
```

### Invoice Creation Fails

- Ensure you're logged in
- Check that Seller Merchant ID is filled
- Add at least one item
- Check browser console for errors

## 📖 Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Feature Testing Checklist](TESTING_CHECKLIST.md)
- [Technical Design](docs/TECHNICAL_DESIGN_ENHANCEMENTS.md)

## 🆘 Need Help?

1. Check the console/terminal for error messages
2. Review the testing checklist
3. Check database connectivity
4. Ensure all migrations ran successfully

## 🎯 Pro Tips

1. **Use Dark Mode**: Toggle in the top navigation for a better experience
2. **Auto-Fill Feature**: Seller Merchant ID auto-fills from your profile
3. **Inventory Auto-Seeding**: SKUs are created automatically when you create invoices
4. **Calculation**: Totals and taxes are calculated automatically
5. **Data Persistence**: Everything is saved to PostgreSQL, refresh safely!

---

**Time to Production Ready**: ~10 minutes  
**Time to First Invoice**: ~5 minutes  
**Time to First GST Return**: ~10 minutes total

Enjoy InvoChain! 🚀
