const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Auth Service' });
});

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
