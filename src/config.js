import {config} from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('No .env file found. Please create one and try again.');
    process.exit(1);
}
config();

// Validation function for required environment variables
function validateEnvVar(name, value, type = 'string') {
    if (!value) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }

    if (type === 'number' && isNaN(Number(value))) {
        console.error(`Environment variable ${name} must be a number`);
        process.exit(1);
    }

    return value;
}

// Validate critical environment variables
validateEnvVar('BOT_TOKEN', process.env.BOT_TOKEN);
validateEnvVar('APP_PORT', process.env.APP_PORT, 'number');

export default {
    APP_NAME: process.env.APP_NAME || 'TeleNode',
    APP_ENV: process.env.APP_ENV || 'development',
    LOG_CHANNEL: process.env.LOG_CHANNEL || 'daily',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    UPDATE_MODE: process.env.UPDATE_MODE || 'polling',
    WEBHOOK_URL: process.env.WEBHOOK_URL || 'https://public-url-for-your-app.com',
    server: {
        port: parseInt(process.env.APP_PORT) || 8001,
        host: process.env.APP_HOST || 'localhost',
    },
    BOT_TOKEN: process.env.BOT_TOKEN,
    BOT_SUDOERS: process.env.BOT_SUDOERS ?
        process.env.BOT_SUDOERS.replace(/, +/g, ',').split(',').map(Number).filter(id => !isNaN(id)) : [],
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'telenode',
        // Connection pool settings
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
        timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
    },
    // Rate limiting configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 30, // 30 requests per minute
    },
    // Cache configuration
    cache: {
        ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
        maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    },
    // Marketplace Configuration
    MARKETPLACE_URL: process.env.MARKETPLACE_URL || 'http://localhost:3000/api',
}