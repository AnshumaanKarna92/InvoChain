# InvoChain - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication APIs

### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "businessName": "ABC Corporation",
  "gstin": "27ABCDE1234F1Z5",
  "email": "user@example.com",
  "password": "SecurePassword123",
  "phone": "+919876543210",
  "address": "123 Main Street, Mumbai"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "businessName": "ABC Corporation",
    "merchant_id": "merchant-uuid"
  },
  "message": "Registration successful"
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "seller",
    "merchant_id": "merchant-uuid",
    "gstin": "27ABCDE1234F1Z5",
    "businessName": "ABC Corporation"
  },
  "message": "Login successful"
}
```

---

## 📊 Invoice APIs

### Create Invoice
```http
POST /api/invoices
```

**Request Body (FormData):**
```json
{
  "invoice_number": "INV-2025-001",
  "seller_merchant_id": "merchant-uuid",
  "buyer_gstin": "29XYZAB1234C1Z5",
  "invoice_date": "2025-01-15",
  "due_date": "2025-02-15",
  "total_amount": 11800,
  "tax_amount": 1800,
  "items": "[{\"sku\":\"PROD-001\",\"description\":\"Product 1\",\"quantity\":10,\"unit_price\":100,\"gst_rate\":18}]"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "invoice": {
    "id": "invoice-uuid",
    "invoice_number": "INV-2025-001",
    "total_amount": 11800,
    "status": "ISSUED"
  },
  "message": "Invoice created successfully"
}
```

### Get All Invoices
```http
GET /api/invoices?merchant_id=merchant-uuid
```

**Response:** `200 OK`
```json
{
  "success": true,
  "invoices": [
    {
      "id": "invoice-uuid",
      "invoice_number": "INV-2025-001",
      "seller_merchant_id": "merchant-uuid",
      "buyer_gstin": "29XYZAB1234C1Z5",
      "total_amount": 11800,
      "status": "ISSUED",
      "invoice_date": "2025-01-15",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Get Invoice Details
```http
GET /api/invoices/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "invoice": {
    "id": "invoice-uuid",
    "invoice_number": "INV-2025-001",
    "total_amount": 11800,
    "status": "ISSUED",
    "items": [
      {
        "sku": "PROD-001",
        "description": "Product 1",
        "quantity": 10,
        "unit_price": 100,
        "gst_rate": 18
      }
    ]
  }
}
```

### Accept/Reject Invoice
```http
POST /api/invoices/:id/action
```

**Request Body:**
```json
{
  "action": "ACCEPT",  // or "REJECT"
  "reason": ""  // required for REJECT
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "invoice": {
    "id": "invoice-uuid",
    "status": "ACCEPTED"
  },
  "message": "Invoice accepted successfully"
}
```

---

## 📦 Inventory APIs

### Get Inventory
```http
GET /api/inventory/:merchantId
```

**Response:** `200 OK`
```json
{
  "success": true,
  "inventory": [
    {
      "id": "inventory-uuid",
      "sku": "PROD-001",
      "name": "Product 1",
      "quantity": 100,
      "reserved_quantity": 10,
      "available": 90,
      "unit_price": 100
    }
  ]
}
```

### Reserve Stock
```http
POST /api/inventory/reserve
```

**Request Body:**
```json
{
  "merchant_id": "merchant-uuid",
  "items": [
    {
      "sku": "PROD-001",
      "quantity": 10
    }
  ],
  "invoice_id": "invoice-uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Stock reserved successfully"
}
```

---

## 📈 GST Return APIs

### Generate GSTR-1
```http
POST /api/gst/generate/gstr1
```

**Request Body:**
```json
{
  "merchant_id": "merchant-uuid",
  "period": {
    "month": 1,
    "year": 2025
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "return": {
    "id": "return-uuid",
    "return_type": "GSTR1",
    "period_month": 1,
    "period_year": 2025,
    "gstin": "27ABCDE1234F1Z5",
    "data": {
      "sections": {
        "b2b": [...],
        "cdnr": [...]
      },
      "summary": {
        "total_invoices": 5,
        "total_taxable_value": 50000,
        "total_tax": 9000
      }
    },
    "status": "DRAFT"
  }
}
```

### Generate GSTR-3B
```http
POST /api/gst/generate/gstr3b
```

**Request Body:**
```json
{
  "merchant_id": "merchant-uuid",
  "period": {
    "month": 1,
    "year": 2025
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "return": {
    "id": "return-uuid",
    "return_type": "GSTR3B",
    "data": {
      "sections": {
        "outward_supplies": {...},
        "itc": {...},
        "tax_payable": {...}
      }
    }
  }
}
```

### Get All Returns
```http
GET /api/gst/returns?merchant_id=merchant-uuid&type=GSTR1
```

**Response:** `200 OK`
```json
{
  "success": true,
  "returns": [
    {
      "id": "return-uuid",
      "return_type": "GSTR1",
      "period_month": 1,
      "period_year": 2025,
      "status": "DRAFT",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Update Return Status
```http
PATCH /api/gst/returns/:id/status
```

**Request Body:**
```json
{
  "status": "FILED"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "return": {
    "id": "return-uuid",
    "status": "FILED",
    "filed_at": "2025-01-15T11:00:00Z"
  }
}
```

### Delete Return
```http
DELETE /api/gst/returns/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Return deleted successfully"
}
```

---

## 💰 Payment APIs

### Record Payment
```http
POST /api/payments
```

**Request Body:**
```json
{
  "invoice_id": "invoice-uuid",
  "amount": 11800,
  "method": "BANK_TRANSFER",
  "reference_id": "TXN123456",
  "notes": "Payment received for Invoice INV-2025-001"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "invoice_id": "invoice-uuid",
    "amount": 11800,
    "method": "BANK_TRANSFER"
  },
  "message": "Payment recorded successfully"
}
```

### Get Payments for Invoice
```http
GET /api/payments/invoice/:invoiceId
```

**Response:** `200 OK`
```json
{
  "payments": [
    {
      "id": "payment-uuid",
      "amount": 11800,
      "payment_date": "2025-01-15T12:00:00Z",
      "method": "BANK_TRANSFER",
      "reference_id": "TXN123456"
    }
  ]
}
```

### Get Payment Analytics
```http
GET /api/payments/analytics
```

**Response:** `200 OK`
```json
{
  "total_collected": 118000,
  "total_receivables": 200000,
  "outstanding": 82000,
  "transaction_count": 10
}
```

---

## 🔄 Reconciliation APIs

### Run Reconciliation
```http
POST /api/reconciliation/run
```

**Request Body:**
```json
{
  "period_start": "2025-01-01",
  "period_end": "2025-01-31"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "report": {
    "id": "report-uuid",
    "total_invoices": 50,
    "matched_invoices": 45,
    "discrepancies_count": 5
  }
}
```

### Get Discrepancies
```http
GET /api/reconciliation/discrepancies
```

**Response:** `200 OK`
```json
{
  "success": true,
  "discrepancies": [
    {
      "id": "disc-uuid",
      "invoice_number": "INV-2025-001",
      "type": "MISSING_BUYER",
      "details": "Buyer GSTIN missing",
      "status": "OPEN"
    }
  ]
}
```

### Resolve Discrepancy
```http
PATCH /api/reconciliation/discrepancy/:id/resolve
```

**Response:** `200 OK`
```json
{
  "success": true,
  "discrepancy": {
    "id": "disc-uuid",
    "status": "RESOLVED",
    "resolved_at": "2025-01-15T14:00:00Z"
  }
}
```

---

## 🏢 Merchant APIs

### Get Merchant Profile
```http
GET /api/merchants/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "merchant": {
    "id": "merchant-uuid",
    "gstin": "27ABCDE1234F1Z5",
    "legal_name": "ABC Corporation",
    "address": "123 Main Street, Mumbai",
    "phone": "+919876543210",
    "email": "contact@abc.com"
  }
}
```

---

## 🔍 Audit APIs

### Log Event
```http
POST /api/audit/log
```

**Request Body:**
```json
{
  "event_type": "INVOICE_CREATED",
  "actor": "user-uuid",
  "resource_type": "invoice",
  "resource_id": "invoice-uuid",
  "details": {
    "invoice_number": "INV-2025-001"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "log": {
    "id": "log-uuid",
    "hash": "sha256-hash"
  }
}
```

---

## 📋 Health Check APIs

All services expose a health check endpoint:

```http
GET /api/health
GET /auth/health
GET /invoices/health
GET /gst/health
```

**Response:** `200 OK`
```json
{
  "status": "UP",
  "service": "Service Name"
}
```

---

## ❌ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here",
  "message": "User-friendly message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## 📝 Request Examples (cURL)

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Corporation",
    "gstin": "27ABCDE1234F1Z5",
    "email": "user@abc.com",
    "password": "SecurePass123",
    "phone": "+919876543210",
    "address": "Mumbai"
  }'
```

### Create Invoice
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -F 'invoice_number=INV-2025-001' \
  -F 'seller_merchant_id=merchant-uuid' \
  -F 'buyer_gstin=29XYZAB1234C1Z5' \
  -F 'invoice_date=2025-01-15' \
  -F 'total_amount=11800' \
  -F 'items=[{"sku":"PROD-001","quantity":10,"unit_price":100}]'
```

### Generate GSTR-1
```bash
curl -X POST http://localhost:3000/api/gst/generate/gstr1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "merchant-uuid",
    "period": {"month": 1, "year": 2025}
  }'
```

---

**API Version**: 1.0.0  
**Last Updated**: November 2025
