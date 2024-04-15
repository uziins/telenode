import {config} from "dotenv";

// check if .env file exists (es module style)
import fs from "fs";
import path from "path";
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('No .env file found. Please create one and try again.');
    process.exit(1);
}
config();

// check if all required env variables are set
const requiredEnvVars = ['BOT_TOKEN'];
if (process.env.UPDATE_MODE === 'webhook') requiredEnvVars.push('WEBHOOK_URL', 'APP_PORT');
const unsetEnvVars = requiredEnvVars.filter(envVar => !(typeof process.env[envVar] !== 'undefined') || process.env[envVar] === '');
if (unsetEnvVars.length > 0) {
    console.error(`Required environment variables are missing: [${unsetEnvVars.join(', ')}]`);
    process.exit(1);
}

export default {
    APP_NAME: process.env.APP_NAME || 'TeleNode',
    APP_ENV: process.env.APP_ENV || 'development',
    LOG_CHANNEL: process.env.LOG_CHANNEL || 'daily',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    UPDATE_MODE: process.env.UPDATE_MODE || 'polling',
    WEBHOOK_URL: process.env.WEBHOOK_URL || 'https://public-url-for-your-app.com',
    server: {
        port: process.env.APP_PORT || 8001,
    },
    BOT_TOKEN: process.env.BOT_TOKEN,
    BOT_ADMINS: process.env.BOT_ADMINS ? process.env.BOT_ADMINS.split(',') : [],
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'telenode'
    }
}