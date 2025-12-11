const axios = require('axios');
const crypto = require('crypto');

const GATEWAY_URL = 'http://localhost:3000';

async function testDashboard() {
    try {
        console.log('Testing Auth Service (Login)...');
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        // Register first to ensure user exists
        try {
            await axios.post(`${GATEWAY_URL}/api/auth/register`, {
                businessName: 'Test Biz',
                gstin: `29ABCDE${Date.now().toString().slice(-4)}F1Z5`,
                email,
                password,
                address: '123 Test St',
                phone: '9876543210'
            });
        } catch (e) {
            // Ignore if already exists
        }

        const loginRes = await axios.post(`${GATEWAY_URL}/api/auth/login`, {
            email,
            password
        });
        const token = loginRes.data.token;
        const merchantId = loginRes.data.user.merchant_id;
        console.log('Login Successful. Merchant ID:', merchantId);

        console.log('\nTesting Dashboard Endpoints...');

        // 1. Get Invoices
        console.log('1. Fetching Invoices...');
        try {
            const invoicesRes = await axios.get(`${GATEWAY_URL}/api/invoices`, {
                params: { merchant_id: merchantId },
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('   Invoices Success:', invoicesRes.data.success, 'Count:', invoicesRes.data.invoices?.length);
        } catch (e) {
            console.error('   Invoices Failed:', e.message);
        }

        // 2. Get Discrepancies
        console.log('2. Fetching Discrepancies...');
        try {
            const discrepanciesRes = await axios.get(`${GATEWAY_URL}/api/reconciliation/discrepancies`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('   Discrepancies Success:', discrepanciesRes.data.success);
        } catch (e) {
            console.error('   Discrepancies Failed:', e.message);
            if (e.response?.status === 404) console.log('   (404 is expected if route not implemented or empty)');
        }

        // 3. Get Payment Analytics
        console.log('3. Fetching Payment Analytics...');
        try {
            const analyticsRes = await axios.get(`${GATEWAY_URL}/api/payments/analytics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('   Payment Analytics Success:', analyticsRes.data.success);
        } catch (e) {
            console.error('   Payment Analytics Failed:', e.message);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testDashboard();
