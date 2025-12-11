const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const GATEWAY_URL = 'http://localhost:3000';

async function testApi() {
    try {
        console.log('Testing API Gateway Health...');
        const health = await axios.get(`${GATEWAY_URL}/health`);
        console.log('Gateway Health:', health.data);

        console.log('\nTesting Auth Service (Login)...');
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        try {
            await axios.post(`${GATEWAY_URL}/api/auth/register`, {
                businessName: 'Test Biz',
                gstin: `29ABCDE${Date.now().toString().slice(-4)}F1Z5`,
                email,
                password,
                address: '123 Test St',
                phone: '9876543210'
            });
            console.log('Registration Successful');
        } catch (e) {
            console.log('Registration failed (might already exist):', e.message);
        }

        const loginRes = await axios.post(`${GATEWAY_URL}/api/auth/login`, {
            email,
            password
        });
        console.log('Login Successful, Token received');
        const token = loginRes.data.token;
        const merchantId = loginRes.data.user.merchant_id;

        console.log('\nTesting Invoice Analytics...');
        try {
            const analytics = await axios.get(`${GATEWAY_URL}/api/invoices/analytics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Analytics:', analytics.data);
        } catch (e) {
            console.error('Analytics Failed:', e.message, e.response?.data);
        }

        console.log('\nTesting Inventory List...');
        try {
            const inventory = await axios.get(`${GATEWAY_URL}/api/inventory/${merchantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Inventory List:', inventory.data);
        } catch (e) {
            console.error('Inventory List Failed:', e.message, e.response?.data);
        }

        console.log('\nTesting Invoice Creation...');
        try {
            // 1. Add Inventory
            const sku = `SKU-${Date.now()}`;
            await axios.post(`${GATEWAY_URL}/api/inventory/adjust`, {
                merchant_id: merchantId,
                sku,
                name: 'Test Item',
                quantity_change: 100,
                type: 'ADD',
                unit_price: 500
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('Inventory Added');

            // 2. Create Invoice
            const form = new FormData();
            form.append('invoice_number', `INV-${Date.now()}`);
            form.append('seller_merchant_id', merchantId);
            form.append('buyer_gstin', '29ABCDE1234F1Z5');
            form.append('invoice_date', new Date().toISOString());
            form.append('due_date', new Date().toISOString());
            form.append('total_amount', 5500);
            form.append('tax_amount', 500);

            const items = [{
                sku,
                description: 'Test Item',
                hsn_code: '1234',
                quantity: 10,
                unit_price: 500,
                taxable_value: 5000,
                gst_rate: 10,
                total_item_amount: 5500
            }];
            form.append('items', JSON.stringify(items));

            const invoiceRes = await axios.post(`${GATEWAY_URL}/api/invoices`, form, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'idempotency-key': crypto.randomUUID(),
                    ...form.getHeaders()
                }
            });
            console.log('Invoice Created:', invoiceRes.data);

        } catch (e) {
            console.error('Invoice Creation Failed:', e.message, e.response?.data);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

testApi();
