import Config from "./config.js";
import Logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";
import PluginManager from "./pluginManager.js";


import express from "express";

const log = Logger(Config.APP_NAME, Config);
let bot;

log.info(`${process.env.npm_package_name} version ${process.env.npm_package_version} | Environment: ${Config.APP_ENV} | Log level: ${Config.LOG_LEVEL}`);

(async () => {
    log.verbose('Starting the bot...')
    if (Config.UPDATE_MODE === 'webhook') {
        bot = new TelegramBot(Config.BOT_TOKEN);

        bot.getWebHookInfo().then(r => {
            const webhookUrl = `${Config.WEBHOOK_URL}/bot${Config.BOT_TOKEN}`;
            if (r.url !== webhookUrl) bot.setWebHook(webhookUrl).then(r => {
                console.log(`Webhook is set to ${webhookUrl}`)
            });
        });

        const app = express();
        app.use(express.json());
        app.post(`/bot${Config.BOT_TOKEN}`, (req, res) => {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });
        app.listen(Config.server.port, () => {
            log.info(`Express server is listening on ${Config.server.port}`);
        });

    } else if (Config.UPDATE_MODE === 'polling') {
        bot = new TelegramBot(Config.BOT_TOKEN, {
            polling: true, request: {
                agentOptions: {
                    keepAlive: true,
                    family: 4
                }
            }
        });

        await bot.getWebHookInfo().then(r => {
            if (r.url !== '') bot.deleteWebHook().then(r => {
                log.info('Webhook is deleted')
            });
        });

        log.info(`Telegram bot is polling for updates...`);
    } else {
        console.log('Invalid update mode');
        console.log('Specify the UPDATE_MODE environment variable. Valid values are "polling" and "webhook"');
        process.exit(1);
    }
})();

const pluginMan = new PluginManager(bot, Config);
pluginMan.loadPlugins();

// on CTRL+C, stop the bot safely
process.on('SIGINT', () => {
    log.warn('Shutting down...');
    bot.stopPolling().then(() => {
        log.info('Polling stopped');
    });
    pluginMan.stopPlugins().then(() => {
        log.info('All plugins stopped');
        process.exit();
    });
});