import Config from "./config.js";
import Logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";
import PluginManager from "./pluginManager.js";


const log = Logger(Config.APP_NAME, Config);
let bot;

log.info(`${process.env.npm_package_name} version ${process.env.npm_package_version} | Environment: ${Config.APP_ENV} | Log level: ${Config.LOG_LEVEL}`);

(async () => {
    log.verbose('Starting the bot...')
    if (Config.UPDATE_MODE === 'webhook') {
        const express = require('express');
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
        bot = new TelegramBot(Config.BOT_TOKEN, {polling: true});

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

    // loadPlugins();
})();

const pluginMan = new PluginManager(bot, Config);
pluginMan.loadPlugins();
// bot.on('message', (msg) => {
//     console.log(msg)
//     const chatId = msg.chat.id;
//     // send keyboard
//     bot.sendMessage(chatId, 'Received your message', {
//         // reply_markup: {
//         //     keyboard: [['Sample text', 'Second sample'], ['Keyboard'], ['I\'m robot']],
//         //     resize_keyboard: true,
//         // }
//     });
// });

// load plugins. Plugins are located in the plugins directory (ex: plugins/hello/index.js) index.js is the entry point for the plugin

// function loadPlugins() {
//     const pluginsDir = 'plugins';
//     fs.readdir(pluginsDir, (err, plugins) => {
//         if (err) {
//             console.error('Error reading plugins directory', err);
//             return;
//         }
//
//         // load each plugin, index.js is the entry point for the plugin
//         plugins.forEach(plugin => {
//             const pluginPath = path.join(__dirname, '..', pluginsDir, plugin, 'index.js');
//             if (fs.existsSync(pluginPath)) {
//                 const Plugin = require(pluginPath);
//                 const pluginInstance = new Plugin();
//                 if (pluginInstance instanceof require('./plugin')) {
//                     console.log(`Plugin ${plugin} loaded`);``
//                 } else {
//                     console.error(`Plugin ${plugin} does not extend the Plugin class`);
//                 }
//             } else {
//                 console.error(`Plugin ${plugin} does not have an index.js file`);
//             }
//         });
//     });
// }

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