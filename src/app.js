const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');

const fs = require('fs');
const path = require('path');

let bot;

(async () => {
    if (config.updateMode === 'webhook') {
        const express = require('express');
        bot = new TelegramBot(config.bot.token);

        bot.getWebHookInfo().then(r => {
            const webhookUrl = `${config.server.url}/bot${config.bot.token}`;
            if (r.url !== webhookUrl) bot.setWebHook(webhookUrl).then(r => {console.log(`Webhook is set to ${webhookUrl}`)});
        });

        const app = express();
        app.use(express.json());
        app.post(`/bot${config.bot.token}`, (req, res) => {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });
        app.listen(config.server.port, () => {
            console.log(`Express server is listening on ${config.server.port}`);
        });

    } else if (config.updateMode === 'polling') {
        bot = new TelegramBot(config.bot.token, {polling: true});

        await bot.getWebHookInfo().then(r => {
            if (r.url !== '') bot.deleteWebHook().then(r => {console.log('Webhook is deleted')});
        });

        console.log(`Telegram bot is polling for updates...`);
    } else {
        console.error('Invalid update mode');
        console.log('Specify the UPDATE_MODE environment variable. Valid values are "polling" and "webhook"');
        process.exit(1);
    }

    loadPlugins();
})();

bot.on('message', (msg) => {
    console.log(msg)
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Received your message');
});

// bot.onText(/\/start/, (msg) => {
//     const chatId = msg.chat.id;
//     bot.sendMessage(chatId, 'Received your /start command');
// });

// load plugins. Plugins are located in the plugins directory (ex: plugins/hello/index.js) index.js is the entry point for the plugin

function loadPlugins() {
    const pluginsDir = 'plugins';
    fs.readdir(pluginsDir, (err, plugins) => {
        if (err) {
            console.error('Error reading plugins directory', err);
            return;
        }

        // load each plugin, index.js is the entry point for the plugin
        plugins.forEach(plugin => {
            const pluginPath = path.join(__dirname, '..', pluginsDir, plugin, 'index.js');
            if (fs.existsSync(pluginPath)) {
                const Plugin = require(pluginPath);
                const pluginInstance = new Plugin();
                if (pluginInstance instanceof require('./plugin')) {
                    console.log(`Plugin ${plugin} loaded`);``
                } else {
                    console.error(`Plugin ${plugin} does not extend the Plugin class`);
                }
            } else {
                console.error(`Plugin ${plugin} does not have an index.js file`);
            }
        });
    });
}
