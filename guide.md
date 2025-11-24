# 📘 InvoChain User Guide

Welcome to **InvoChain**, your automated B2B Invoice Reconciliation and GST Return Filing System. This guide will help you navigate the application and use its features effectively.

## 🚀 Getting Started

### 1. Access the Application
Open your web browser and navigate to: `http://localhost:5173`

### 2. Connect Wallet
- Click the **"Connect Wallet"** button in the top right corner.
- This simulates connecting your blockchain wallet (e.g., MetaMask) to anchor your invoices on the ledger.
- Once connected, you will see your wallet address (e.g., `Connected: 0x71C...9A21`).

---

## 📊 Dashboard
The **Dashboard** gives you a real-time overview of your financial operations.

- **Total Invoices**: Number of invoices generated.
- **Reconciled**: Invoices that match perfectly with your buyers/sellers.
- **Pending**: Invoices waiting for action or reconciliation.
- **Discrepancies**: Invoices with mismatched data (e.g., tax amount differences).
- **Collected**: Total payment amount received.
- **Recent Activity**: A log of the latest actions in the system.

---

## 🧾 Invoices Module
Manage your invoice lifecycle here.

### Create an Invoice
1. Click **"Create Invoice"**.
2. Fill in the details:
   - **Invoice Number**: Unique identifier (e.g., INV-001).
   - **Buyer GSTIN**: The GST number of the buyer.
   - **Amount**: Total invoice value.
   - **Tax Amount**: GST component.
   - **Due Date**: Payment deadline.
   - **File**: Upload a PDF or image of the invoice.
3. Click **"Create Invoice"**.
   - The invoice is saved.
   - It is automatically anchored to the blockchain.
   - An E-Invoice (IRN) is generated via the GST Adapter.

### View Invoices
- The list shows all your invoices with their status (PENDING, RECONCILIATED, etc.).

---

## 🔄 Reconciliation Module
Match your sales register with your purchase register.

### Run Reconciliation
1. Navigate to the **Reconciliation** tab.
2. Click **"Run Reconciliation"**.
3. The system compares your invoices against buyer actions and GST data.

### Resolve Discrepancies
- If mismatches are found, they appear in the **Discrepancies** list.
- You can view details and take action (e.g., issue a Credit Note or contact the buyer).

---

## 📋 GST Returns Module
File your tax returns seamlessly.

### GSTR-1 (Sales Return)
- Click **"Generate GSTR-1"**.
- The system compiles all your sales invoices into the GSTR-1 format.
- You can view the generated JSON payload ready for the GST portal.

### GSTR-3B (Summary Return)
- Click **"Generate GSTR-3B"**.
- Provides a summary of your output tax liability and input tax credit (ITC).

---

## ⚡ E-Invoice Module
Track your electronic invoices.

- View a list of all generated E-Invoices.
- Check the **IRN** (Invoice Reference Number) and **Status**.
- **Cancel E-Invoice**: If needed, you can cancel an e-invoice within 24 hours.

---

## 📝 Credit/Debit Notes
Manage adjustments to issued invoices.

- **Create Note**: Issue a Credit Note (for returns/overcharge) or Debit Note (for undercharge).
- Link the note to an original **Invoice ID**.
- Specify the **Reason** and **Amount**.

---

## 💰 Payments Module
Track payments received from buyers.

### Record a Payment
1. Click **"Record Payment"**.
2. Select the **Invoice** you received payment for.
3. Enter the **Amount** and **Payment Method** (Bank Transfer, UPI, etc.).
4. Add a **Reference ID** (Transaction ID).
5. Click **"Record Payment"**.

### Analytics
- View **Total Collected** vs. **Outstanding Receivables**.
- Track the number of transactions.

---

## 🆘 Support
If you encounter any issues, please contact the technical support team or check the system logs.
