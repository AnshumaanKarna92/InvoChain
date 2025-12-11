# InvoChain - Feature Testing Checklist

## 🎯 Testing Environment
- **Frontend URL**: http://localhost:5173
- **API Gateway**: http://localhost:3000
- **Database**: PostgreSQL on port 5433

## ✅ Feature Testing Checklist

### 1. Authentication & Authorization

#### User Registration
- [ ] Navigate to `/register`
- [ ] Fill in all required fields:
  - Business Name
  - GSTIN (format: 27ABCDE1234F1Z5)
  - Email
  - Password
  - Phone
  - Address
- [ ] Click "Register"
- [ ] Verify success message
- [ ] Check database:
  ```sql
  SELECT * FROM users ORDER BY created_at DESC LIMIT 1;
  SELECT * FROM merchants ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Verify `merchant_id` is created

#### User Login
- [ ] Navigate to `/login`
- [ ] Enter registered email and password
- [ ] Click "Sign In"
- [ ] Verify redirect to dashboard
- [ ] Check user data in localStorage
- [ ] Verify `merchant_id` is present in user object

### 2. Dashboard

- [ ] Check "Total Invoices" stat
- [ ] Check "Reconciled" count
- [ ] Check "Pending" count
- [ ] Check "Total Collected" amount
- [ ] Verify "Recent Activity" section shows latest invoices
- [ ] Test dark mode toggle

### 3. Invoice Management

#### Create Invoice
- [ ] Navigate to `/invoices`
- [ ] Click "Create Invoice"
- [ ] Verify "Seller Merchant ID" is auto-filled
- [ ] Fill in:
  - Invoice Number (e.g., INV-2025-001)
  - Buyer GSTIN (e.g., 29XYZAB1234C1Z5)
  - Invoice Date
  - Due Date
- [ ] Add Items:
  - Click "Add Item" section
  - Enter SKU (e.g., PROD-001)
  - Enter Description
  - Enter Quantity (e.g., 10)
  - Enter Unit Price (e.g., 100)
  - Select GST Rate (18%)
  - Click "Add" button
- [ ] Add multiple items if needed
- [ ] Verify total calculation is automatic
- [ ] Click "Create Invoice"
- [ ] Verify success message
- [ ] Check inventory auto-seeding in database:
  ```sql
  SELECT * FROM inventory ORDER BY created_at DESC;
  SELECT * FROM inventory_events ORDER BY created_at DESC;
  ```

#### View Invoice Details
- [ ] Click "View" on an invoice
- [ ] Verify all details are displayed
- [ ] Check item list
- [ ] Verify amounts

#### Accept/Reject Invoice
- [ ] Click "View" on an invoice with status "ISSUED"
- [ ] Click "Accept" button
- [ ] Verify status changes to "ACCEPTED"
- [ ] Check inventory commitment in database:
  ```sql
  SELECT * FROM inventory_events WHERE event_type = 'COMMIT';
  ```
- [ ] Create another invoice
- [ ] Click "Reject" button
- [ ] Verify status changes to "REJECTED"
- [ ] Check inventory release in database:
  ```sql
  SELECT * FROM inventory_events WHERE event_type = 'RELEASE';
  ```

### 4. Inventory Management

- [ ] Check inventory auto-creation when invoice is created
- [ ] Verify reserved_quantity increases on invoice creation
- [ ] Verify quantity decreases on invoice acceptance
- [ ] Verify reserved_quantity decreases on invoice rejection
- [ ] Database verification:
  ```sql
  SELECT 
    i.sku, 
    i.name, 
    i.quantity, 
    i.reserved_quantity,
    (i.quantity - i.reserved_quantity) as available
  FROM inventory i;
  ```

### 5. GST Returns

#### Generate GSTR-1
- [ ] Navigate to `/gst-returns`
- [ ] Click "Generate GSTR-1"
- [ ] Wait for generation (should be automatic)
- [ ] Verify success message
- [ ] Check return appears in list
- [ ] Verify period is current month/year
- [ ] Database check:
  ```sql
  SELECT * FROM gst_returns WHERE return_type = 'GSTR1' ORDER BY created_at DESC LIMIT 1;
  ```

#### Generate GSTR-3B
- [ ] Click "Generate GSTR-3B"
- [ ] Verify success message
- [ ] Check return appears in list
- [ ] Database check:
  ```sql
  SELECT * FROM gst_returns WHERE return_type = 'GSTR3B' ORDER BY created_at DESC LIMIT 1;
  ```

#### View Return Details  
- [ ] Click "View" on a GST return
- [ ] Verify GSTIN is shown
- [ ] Verify period is shown
- [ ] Check return data JSON structure
- [ ] Verify summary calculations:
  - Total invoices count
  - Total taxable value
  - CGST, SGST, IGST amounts
  - ITC calculations (for GSTR-3B)

#### File Return
- [ ] Click "File" on a DRAFT return
- [ ] Verify status changes to "FILED"
- [ ] Verify "File" button disappears
- [ ] Verify filed_at timestamp in database

#### Delete Return
- [ ] Click "Delete" on a return
- [ ] Confirm deletion
- [ ] Verify return is removed from list

### 6. Reconciliation

- [ ] Navigate to `/reconciliation`
- [ ] Click "Run Reconciliation"
- [ ] Wait for completion
- [ ] Check for discrepancies
- [ ] Verify report is generated
- [ ] Database check:
  ```sql
  SELECT * FROM reconciliation_reports ORDER BY created_at DESC LIMIT 1;
  SELECT * FROM discrepancies ORDER BY created_at DESC LIMIT 5;
  ```
- [ ] If discrepancies exist, click "Resolve"
- [ ] Verify discrepancy status changes

### 7. Payments

#### Record Payment
- [ ] Use API or Postman to record payment:
  ```bash
  curl -X POST http://localhost:3000/api/payments \
    -H "Content-Type: application/json" \
    -d '{
      "invoice_id": "YOUR_INVOICE_ID",
      "amount": 1000,
      "method": "BANK_TRANSFER",
      "reference_id": "REF123456",
      "notes": "Test payment"
    }'
  ```
- [ ] Verify payment is recorded
- [ ] Database check:
  ```sql
  SELECT * FROM payments ORDER BY payment_date DESC;
  ```

#### View Analytics
- [ ] Navigate to dashboard
- [ ] Check "Total Collected" updates
- [ ] Verify analytics calculations

### 8. UI/UX Testing

#### Responsiveness
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768px)
- [ ] Test on mobile (375px)
- [ ] Verify all components resize properly
- [ ] Check navigation menu on mobile

#### Dark Mode
- [ ] Toggle dark mode
- [ ] Verify all pages switch properly
- [ ] Check color contrast
- [ ] Verify readability

#### Animations
- [ ] Check hover effects on buttons
- [ ] Verify gradient backgrounds
- [ ] Check modal animations
- [ ] Verify smooth transitions

### 9. Data Persistence

- [ ] Create invoice
- [ ] Refresh page
- [ ] Verify invoice still exists
- [ ] Logout and login again
- [ ] Verify all data persists

### 10. Error Handling

- [ ] Try creating invoice without items
- [ ] Try invalid date formats
- [ ] Test with very large amounts
- [ ] Test special characters in text fields
- [ ] Verify error messages are user-friendly

## 🔍 Database Verification Queries

### Check All Data
```sql
-- Users and Merchants
SELECT u.id, u.email, m.gstin, m.legal_name 
FROM users u 
LEFT JOIN merchants m ON u.id = m.user_id;

-- Invoices with Status
SELECT 
  i.invoice_number,
  i.total_amount,
  i.status,
  COUNT(ii.id) as item_count
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id;

-- Inventory Status
SELECT 
  i.sku,
  i.quantity,
  i.reserved_quantity,
  (i.quantity - i.reserved_quantity) as available,
  COUNT(ie.id) as event_count
FROM inventory i
LEFT JOIN inventory_events ie ON i.id = ie.inventory_id
GROUP BY i.id;

-- GST Returns Summary
SELECT 
  return_type,
  period_month,
  period_year,
  status,
  COUNT(*) as count
FROM gst_returns
GROUP BY return_type, period_month, period_year, status;

-- Payment Summary
SELECT 
  DATE(payment_date) as date,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM payments
GROUP BY DATE(payment_date);
```

## 📝 Test Scenarios

### Scenario 1: Complete Invoice Lifecycle
1. Register new user
2. Login
3. Create invoice with 3 items
4. Verify inventory reservation
5. Accept invoice
6. Verify inventory commitment
7. Generate GSTR-1
8. Verify invoice appears in return
9. File the return

### Scenario 2: Rejection Flow
1. Create invoice
2. Verify inventory reserved
3. Reject invoice
4. Verify inventory released
5. Check discrepancy in reconciliation

### Scenario 3: Multi-User Testing
1. Register User A
2. Register User B
3. User A creates invoice
4. User B creates invoice
5. Verify data isolation (User A can't see User B's data)

## ✅ Production Readiness Checklist

- [ ] All database tables created
- [ ] All services start without errors
- [ ] Frontend builds successfully
- [ ] All API endpoints respond correctly
- [ ] Database connections are pooled
- [ ] Error logging is implemented
- [ ] Environment variables are configured
- [ ] Security headers are set
- [ ] CORS is properly configured
- [ ] Data validation is in place
- [ ] Input sanitization is implemented
- [ ] SQL injection prevention is verified
- [ ] XSS protection is enabled
- [ ] CSRF protection (if applicable)
- [ ] Rate limiting (optional, recommended)

## 📊 Performance Benchmarks

- [ ] Invoice creation < 500ms
- [ ] Invoice list load < 200ms
- [ ] GST return generation < 2s
- [ ] Dashboard load < 300ms
- [ ] Database queries < 100ms average

## 🐛 Known Limitations

1. **Blockchain Integration**: Not fully implemented in current version
2. **E-Invoice IRN**: Mock implementation, requires GST portal integration
3. **Email Notifications**: Not implemented
4. **File Upload**: Implemented but not used in invoices currently
5. **Multi-tenancy**: Basic implementation with merchant_id filtering

## 📞 Support

If any test fails:
1. Check service logs
2. Check database connectivity
3. Verify environment variables
4. Check browser console for errors
5. Review API Gateway logs

---

**Testing Completed By**: _____________  
**Date**: _____________  
**Environment**: _____________  
**All Tests Passed**: ☐ Yes ☐ No

