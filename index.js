const express = require('express');
const db = require('./src/db');
const routes = require('./src/routes');
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    try {
        await db.query('SELECT 1');
        console.log(`Server running on port ${PORT}`);
        console.log('Database connected successfully');
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
});
