const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';

async function testAuthError() {
    try {
        console.log('Testing Duplicate GSTIN Registration...');

        const gstin = `29ABCDE${Date.now().toString().slice(-4)}F1Z5`;
        const email1 = `user1-${Date.now()}@example.com`;
        const email2 = `user2-${Date.now()}@example.com`;

        // 1. Register User 1 (Should Succeed)
        console.log(`1. Registering User 1 with GSTIN: ${gstin}`);
        try {
            await axios.post(`${GATEWAY_URL}/api/auth/register`, {
                businessName: 'User 1 Biz',
                gstin: gstin,
                email: email1,
                password: 'password123',
                address: '123 Test St',
                phone: '9876543210'
            });
            console.log('   User 1 Registration: SUCCESS');
        } catch (e) {
            console.error('   User 1 Registration FAILED:', e.response?.data || e.message);
            return;
        }

        // 2. Register User 2 with SAME GSTIN (Should Fail with 409)
        console.log(`2. Registering User 2 with SAME GSTIN: ${gstin}`);
        try {
            await axios.post(`${GATEWAY_URL}/api/auth/register`, {
                businessName: 'User 2 Biz',
                gstin: gstin,
                email: email2,
                password: 'password123',
                address: '456 Test Ave',
                phone: '9876543211'
            });
            console.error('   User 2 Registration: UNEXPECTED SUCCESS (Should have failed)');
        } catch (e) {
            if (e.response?.status === 409) {
                console.log('   User 2 Registration: FAILED as expected (409)');
                console.log('   Error Message:', e.response.data.message);
            } else {
                console.error('   User 2 Registration: FAILED with unexpected status:', e.response?.status);
                console.error('   Response:', e.response?.data);
            }
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testAuthError();
