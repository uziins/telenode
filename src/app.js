import Config from "./config.js";
import Logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";
import PluginManager from "./pluginManager.js";
import express from "express";

const log = Logger(Config.APP_NAME, 'main', Config.LOG_LEVEL);
let bot;
let server;
let pluginMan;

log.info(`${process.env.npm_package_name} version ${process.env.npm_package_version} | Environment: ${Config.APP_ENV} | Log level: ${Config.LOG_LEVEL}`);

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    log.warn(`Received ${signal}. Starting graceful shutdown...`);

    try {
        // Stop accepting new connections
        if (server) {
            server.close(() => {
                log.info('HTTP server closed');
            });
        }

        // Stop bot polling
        if (bot && Config.UPDATE_MODE === 'polling') {
            await bot.stopPolling();
            log.info('Bot polling stopped');
        }

        // Stop all plugins
        if (pluginMan) {
            await pluginMan.stopPlugins();
            log.info('All plugins stopped');
        }

        log.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        log.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Enhanced error handling
process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

(async () => {
    try {
        log.verbose('Starting the bot...');

        if (Config.UPDATE_MODE === 'webhook') {
            bot = new TelegramBot(Config.BOT_TOKEN);

            // Check and set webhook
            const webhookInfo = await bot.getWebHookInfo();
            const webhookUrl = `${Config.WEBHOOK_URL}/bot${Config.BOT_TOKEN}`;

            if (webhookInfo.url !== webhookUrl) {
                await bot.setWebHook(webhookUrl);
                log.info(`Webhook is set to ${webhookUrl}`);
            } else {
                log.info(`Webhook already set to ${webhookUrl}`);
            }

            // Setup Express server
            const app = express();

            // Health check endpoint
            app.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage()
                });
            });

            // Middleware
            app.use(express.json({ limit: '10mb' }));

            // Rate limiting middleware (simple implementation)
            const requestCounts = new Map();
            app.use((req, res, next) => {
                const clientIp = req.ip || req.connection.remoteAddress;
                const now = Date.now();
                const windowStart = now - Config.rateLimit.windowMs;

                if (!requestCounts.has(clientIp)) {
                    requestCounts.set(clientIp, []);
                }

                const requests = requestCounts.get(clientIp);
                const recentRequests = requests.filter(time => time > windowStart);

                if (recentRequests.length >= Config.rateLimit.maxRequests) {
                    return res.status(429).json({ error: 'Too many requests' });
                }

                recentRequests.push(now);
                requestCounts.set(clientIp, recentRequests);
                next();
            });

            // Bot webhook endpoint
            app.post(`/bot${Config.BOT_TOKEN}`, (req, res) => {
                try {
                    bot.processUpdate(req.body);
                    res.sendStatus(200);
                } catch (error) {
                    log.error('Error processing webhook update:', error);
                    res.sendStatus(500);
                }
            });

            // Error handling middleware
            app.use((error, req, res, next) => {
                log.error('Express error:', error);
                res.status(500).json({ error: 'Internal server error' });
            });

            server = app.listen(Config.server.port, Config.server.host, () => {
                log.info(`Express server is listening on ${Config.server.host}:${Config.server.port}`);
            });

        } else if (Config.UPDATE_MODE === 'polling') {
            bot = new TelegramBot(Config.BOT_TOKEN, {
                polling: {
                    interval: 1000,
                    autoStart: false,
                    params: {
                        timeout: 30
                    }
                },
                request: {
                    agentOptions: {
                        keepAlive: true,
                        family: 4
                    }
                }
            });

            // Remove webhook if exists
            const webhookInfo = await bot.getWebHookInfo();
            if (webhookInfo.url !== '') {
                await bot.deleteWebHook();
                log.info('Webhook deleted');
            }

            // Start polling
            await bot.startPolling();
            log.info('Telegram bot is polling for updates...');

        } else {
            throw new Error('Invalid update mode. Valid values are "polling" and "webhook"');
        }

        // Initialize plugin manager
        pluginMan = new PluginManager(bot, Config);
        await pluginMan.loadPlugins();

        log.info('Bot started successfully');

    } catch (error) {
        log.error('Failed to start bot:', error);
        process.exit(1);
    }
})();
