require('dotenv').config();

// check if .env file exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    console.error('No .env file found. Please create one and try again.');
    process.exit(1);
}

// check if all required env variables are set
const requiredEnvVars = ['BOT_TOKEN'];
if (process.env.UPDATE_MODE === 'webhook') requiredEnvVars.push('APP_URL', 'APP_PORT');
const unsetEnvVars = requiredEnvVars.filter(envVar => !(typeof process.env[envVar] !== 'undefined') || process.env[envVar] === '');
if (unsetEnvVars.length > 0) {
    console.error(`Required environment variables are missing: [${unsetEnvVars.join(', ')}]`);
    process.exit(1);
}

module.exports = {
    updateMode: process.env.UPDATE_MODE || 'polling',
    server: {
        url: process.env.APP_URL || 'https://public-url-for-your-app.com',
        port: process.env.APP_PORT || 8001,
    },
    bot: {
        token: process.env.BOT_TOKEN,
        name: process.env.BOT_NAME || 'TeleNode'
    },
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'telenode'
    }
}