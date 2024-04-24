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
    BOT_SUDOERS: process.env.BOT_SUDOERS ? process.env.BOT_SUDOERS.replace(/, +/g, ',').split(',').map(Number) : [],
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'telenode'
    }
}