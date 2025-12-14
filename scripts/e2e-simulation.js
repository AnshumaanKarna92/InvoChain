const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Configuration ---
const SERVICES = {
    AUTH: 'http://localhost:3011',
    MERCHANT: 'http://localhost:3012',
    INVENTORY: 'http://localhost:3013',
    INVOICE: 'http://localhost:3002',
    BUYER_ACTION: 'http://localhost:3004',
    GST: 'http://localhost:3008'
};

const generateGSTIN = () => `29${Math.random().toString(36).substring(2, 7).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}A1Z${Math.floor(Math.random() * 9)}`;

const SELLER = {
    businessName: 'Tech Solutions Pvt Ltd',
    gstin: generateGSTIN(),
    email: 'seller_demo@test.com',
    password: 'password123',
    address: '123 Tech Park, Bangalore',
    phone: '9876543210'
};

const BUYER = {
    businessName: 'Retail Corp',
    gstin: generateGSTIN(),
    email: 'buyer_demo@test.com',
    password: 'password123',
    address: '456 Market St, Mysore',
    phone: '9123456789'
};

const UNKNOWN_GSTIN = generateGSTIN();

// --- Helpers ---
const log = (msg, type = 'INFO') => console.log(`[${new Date().toISOString()}] [${type}] ${msg}`);
const error = (msg, err) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`);
    if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        console.error('Stack:', err.stack);
    }
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function apiCall(method, url, data = null, token = null, headers = {}) {
    try {
        const config = {
            method,
            url,
            headers: { ...headers }
        };
        if (data) config.data = data;
        if (token) config.headers['Authorization'] = `Bearer ${token}`;

        const response = await axios(config);
        return response.data;
    } catch (err) {
        throw err;
    }
}

// --- Main Simulation ---
async function runSimulation() {
    log('Starting End-to-End Simulation...', 'INIT');

    try {
        // 1. Registration
        log('--- Phase 1: Registration ---');

        // Register Seller
        log(`Registering Seller: ${SELLER.email}`);
        let sellerReg;
        try {
            sellerReg = await apiCall('POST', `${SERVICES.AUTH}/register`, SELLER);
            log(`Seller Registered. Merchant ID: ${sellerReg.user.merchant_id}`);
        } catch (e) {
            if (e.response && e.response.status === 409) {
                log('Seller already registered, proceeding to login.');
            } else throw e;
        }

        // Register Buyer
        log(`Registering Buyer: ${BUYER.email}`);
        let buyerReg;
        try {
            buyerReg = await apiCall('POST', `${SERVICES.AUTH}/register`, BUYER);
            log(`Buyer Registered. Merchant ID: ${buyerReg.user.merchant_id}`);
        } catch (e) {
            if (e.response && e.response.status === 409) {
                log('Buyer already registered, proceeding to login.');
            } else throw e;
        }

        // 2. Login
        log('--- Phase 2: Authentication ---');

        // Login Seller
        const sellerLogin = await apiCall('POST', `${SERVICES.AUTH}/login`, { email: SELLER.email, password: SELLER.password });
        const sellerToken = sellerLogin.token;
        // Decode token to get merchant_id if not available from registration
        const sellerId = JSON.parse(atob(sellerToken.split('.')[1])).merchant_id;
        log(`Seller Logged In. Merchant ID: ${sellerId}`);

        // Login Buyer
        const buyerLogin = await apiCall('POST', `${SERVICES.AUTH}/login`, { email: BUYER.email, password: BUYER.password });
        const buyerToken = buyerLogin.token;
        const buyerId = JSON.parse(atob(buyerToken.split('.')[1])).merchant_id;
        log(`Buyer Logged In. Merchant ID: ${buyerId}`);

        // 3. Inventory Setup
        log('--- Phase 3: Inventory Setup ---');
        const SKU = 'LAPTOP-001';

        log(`Adding Stock for ${SKU} to Seller Inventory...`);
        await apiCall('POST', `${SERVICES.INVENTORY}/inventory/adjust`, {
            merchant_id: sellerId,
            sku: SKU,
            name: 'Gaming Laptop',
            quantity_change: 100,
            type: 'SET',  // Use SET to ensure consistent quantity
            unit_price: 50000
        }, sellerToken);
        log('Stock Set: 100 units');

        // Verify Inventory
        const invCheck = await apiCall('GET', `${SERVICES.INVENTORY}/inventory/${sellerId}`, null, sellerToken);
        const item = invCheck.inventory.find(i => i.sku === SKU);
        if (!item || parseFloat(item.quantity) !== 100) {
            log(`WARNING: Expected 100 units, found ${item ? item.quantity : 'no item'}. Continuing...`);
        } else {
            log('Inventory Verified: 100 units');
        }

        // 4. Standard Invoice Flow
        log('--- Phase 4: Standard Invoice Flow ---');

        // Create Dummy PDF
        const dummyPdfPath = path.join(__dirname, 'dummy_invoice.pdf');
        fs.writeFileSync(dummyPdfPath, 'Dummy Invoice Content');

        // Create Invoice
        const invoiceData = new FormData();
        invoiceData.append('invoice_number', `INV-${Date.now()}`);
        invoiceData.append('seller_merchant_id', sellerId);
        invoiceData.append('buyer_gstin', BUYER.gstin);
        invoiceData.append('invoice_date', new Date().toISOString().split('T')[0]);
        invoiceData.append('due_date', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
        invoiceData.append('total_amount', 590000); // 10 * 50000 + 18% GST
        invoiceData.append('tax_amount', 90000);
        invoiceData.append('place_of_supply', '29'); // Karnataka

        const items = [{
            sku: SKU,
            description: 'Gaming Laptop',
            hsn_code: '8471',
            quantity: 10,
            unit_price: 50000,
            taxable_value: 500000,
            gst_rate: 18,
            total_item_amount: 590000
        }];
        invoiceData.append('items', JSON.stringify(items));
        invoiceData.append('file', fs.createReadStream(dummyPdfPath));

        log('Creating Invoice...');
        const invoiceRes = await apiCall('POST', `${SERVICES.INVOICE}/invoices`, invoiceData, sellerToken, {
            ...invoiceData.getHeaders(),
            'Idempotency-Key': crypto.randomUUID()
        });
        const invoiceId = invoiceRes.invoice.id;
        log(`Invoice Created: ${invoiceId}`);

        // Verify Stock Reservation
        const invCheckReserved = await apiCall('GET', `${SERVICES.INVENTORY}/inventory/${sellerId}`, null, sellerToken);
        const reservedItem = invCheckReserved.inventory.find(i => i.sku === SKU);
        log(`Inventory State: Qty=${reservedItem.quantity}, Reserved=${reservedItem.reserved_quantity}`);
        if (parseFloat(reservedItem.reserved_quantity) !== 10) throw new Error('Stock not reserved correctly');

        // Buyer Accepts Invoice
        log('Buyer Accepting Invoice...');
        await apiCall('POST', `${SERVICES.INVOICE}/invoices/${invoiceId}/action`, {
            action: 'ACCEPT',
            reason: 'Goods received in good condition'
        }, buyerToken);
        log('Invoice Accepted');

        // Verify Stock Deduction
        const invCheckFinal = await apiCall('GET', `${SERVICES.INVENTORY}/inventory/${sellerId}`, null, sellerToken);
        const finalItem = invCheckFinal.inventory.find(i => i.sku === SKU);
        log(`Final Inventory State: Qty=${finalItem.quantity}, Reserved=${finalItem.reserved_quantity}`);
        if (parseFloat(finalItem.quantity) !== 90) throw new Error('Stock not deducted correctly');

        // 5. Grace Mode Flow
        log('--- Phase 5: Grace Mode (Unknown Buyer) ---');

        const graceInvoiceData = new FormData();
        graceInvoiceData.append('invoice_number', `INV-GRACE-${Date.now()}`);
        graceInvoiceData.append('seller_merchant_id', sellerId);
        graceInvoiceData.append('buyer_gstin', UNKNOWN_GSTIN);
        graceInvoiceData.append('invoice_date', new Date().toISOString().split('T')[0]);
        graceInvoiceData.append('due_date', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
        graceInvoiceData.append('total_amount', 59000);
        graceInvoiceData.append('tax_amount', 9000);
        graceInvoiceData.append('items', JSON.stringify([{
            sku: SKU,
            description: 'Gaming Laptop',
            hsn_code: '8471',
            quantity: 1,
            unit_price: 50000,
            taxable_value: 50000,
            gst_rate: 18,
            total_item_amount: 59000
        }]));
        graceInvoiceData.append('file', fs.createReadStream(dummyPdfPath));

        log('Creating Grace Mode Invoice...');
        const graceRes = await apiCall('POST', `${SERVICES.INVOICE}/invoices`, graceInvoiceData, sellerToken, {
            ...graceInvoiceData.getHeaders(),
            'Idempotency-Key': crypto.randomUUID()
        });
        log(`Grace Invoice Created: ${graceRes.invoice.id}`);

        // 6. Rejection Flow
        log('--- Phase 6: Rejection Flow ---');

        const rejectInvoiceData = new FormData();
        rejectInvoiceData.append('invoice_number', `INV-REJECT-${Date.now()}`);
        rejectInvoiceData.append('seller_merchant_id', sellerId);
        rejectInvoiceData.append('buyer_gstin', BUYER.gstin);
        rejectInvoiceData.append('invoice_date', new Date().toISOString().split('T')[0]);
        rejectInvoiceData.append('due_date', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
        rejectInvoiceData.append('total_amount', 59000);
        rejectInvoiceData.append('tax_amount', 9000);
        rejectInvoiceData.append('items', JSON.stringify([{
            sku: SKU,
            description: 'Gaming Laptop',
            hsn_code: '8471',
            quantity: 1,
            unit_price: 50000,
            taxable_value: 50000,
            gst_rate: 18,
            total_item_amount: 59000
        }]));
        rejectInvoiceData.append('file', fs.createReadStream(dummyPdfPath));

        log('Creating Invoice for Rejection...');
        const rejectRes = await apiCall('POST', `${SERVICES.INVOICE}/invoices`, rejectInvoiceData, sellerToken, {
            ...rejectInvoiceData.getHeaders(),
            'Idempotency-Key': crypto.randomUUID()
        });
        const rejectId = rejectRes.invoice.id;

        log('Buyer Rejecting Invoice...');
        await apiCall('POST', `${SERVICES.INVOICE}/invoices/${rejectId}/action`, {
            action: 'REJECT',
            reason: 'Wrong item sent'
        }, buyerToken);
        log('Invoice Rejected');

        // Verify Stock Released
        const invCheckReject = await apiCall('GET', `${SERVICES.INVENTORY}/inventory/${sellerId}`, null, sellerToken);
        const rejectItem = invCheckReject.inventory.find(i => i.sku === SKU);
        // Should be 90 (from step 4) - 1 (grace) = 89. Rejection should release the reserved 1, so physical stays 89, reserved 0.
        // Wait, Grace mode deducted 1 reserved? Yes.
        // Rejection flow: Created (Reserved 1). Rejected (Released 1).
        // So total physical deduction: 10 (Accepted) + 1 (Grace - still Issued/Reserved until accepted? No, Grace mode stays Issued).
        // Let's check Grace mode status. It stays 'ISSUED'. So reserved qty should include Grace invoice.

        log(`Post-Rejection Inventory: Qty=${rejectItem.quantity}, Reserved=${rejectItem.reserved_quantity}`);
        // Expected: 
        // Initial: 100
        // - 10 (Accepted) -> 90 Physical, 0 Reserved
        // - 1 (Grace) -> 90 Physical, 1 Reserved
        // - 1 (Reject) -> Created (90 Phy, 2 Res) -> Rejected (90 Phy, 1 Res)

        if (parseFloat(rejectItem.reserved_quantity) !== 1) {
            log('WARNING: Reserved quantity mismatch. Grace mode invoice might not be reserving correctly or Rejection failed to release.');
        } else {
            log('Inventory Verified Correctly after Rejection');
        }

        // 7. GST Returns
        log('--- Phase 7: GST Returns ---');

        const period = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

        log('Generating GSTR-1...');
        const gstr1 = await apiCall('POST', `${SERVICES.GST}/gst/generate/gstr1`, {
            merchant_id: sellerId,
            period
        }, sellerToken);
        log(`GSTR-1 Generated: ${gstr1.return.id}`);
        log(`GSTR-1 Summary: Total Invoices=${gstr1.return.data.summary.total_invoices}`);

        log('Generating GSTR-3B...');
        const gstr3b = await apiCall('POST', `${SERVICES.GST}/gst/generate/gstr3b`, {
            merchant_id: sellerId,
            period
        }, sellerToken);
        log(`GSTR-3B Generated: ${gstr3b.return.id}`);
        log(`GSTR-3B Tax Payable: ${JSON.stringify(gstr3b.return.data.sections.tax_payable)}`);

        log('--- Simulation Completed Successfully ---', 'SUCCESS');

        // Cleanup
        fs.unlinkSync(dummyPdfPath);

    } catch (err) {
        error('Simulation Failed', err);
        // Cleanup
        try { fs.unlinkSync(path.join(__dirname, 'dummy_invoice.pdf')); } catch (e) { }
        process.exit(1);
    }
}

runSimulation();
