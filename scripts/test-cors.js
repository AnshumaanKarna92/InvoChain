const axios = require('axios');

async function testCors() {
    try {
        console.log('Testing CORS...');
        const response = await axios.post('http://localhost:3000/api/auth/register', {
            businessName: 'Test Biz Cors',
            gstin: `29ABCDE${Date.now().toString().slice(-4)}F1Z5`,
            email: `cors-test-${Date.now()}@example.com`,
            password: 'password123',
            address: '123 Test St',
            phone: '9876543210'
        }, {
            headers: {
                'Origin': 'http://localhost:5173'
            }
        });

        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Access-Control-Allow-Origin:', response.headers['access-control-allow-origin']);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Headers:', error.response.headers);
        }
    }
}

testCors();
