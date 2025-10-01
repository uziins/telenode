import { performanceMonitor } from "../../helpers/performance.js";

export default class SystemHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.pm = masterPlugin.pm;
        this.log = masterPlugin.log;
    }

    async handleSystemMenu({message}) {
        // check if user is root
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to system management panel`);
            return;
        }

        // only process private messages
        if (message.chat.type !== 'private') {
            this.log.warn(`System management panel can only be accessed in private messages`);
            return;
        }

        return {
            type: "text",
            text: "🔧 System Management Panel",
            options: {
                reply_markup: {
                    inline_keyboard: await this.masterPlugin.keyboardManager.getMainKeyboard()
                }
            }
        };
    }

    async handleSystemStatus({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to system status`);
            return;
        }

        const report = performanceMonitor.getPerformanceReport();
        const health = performanceMonitor.getHealthStatus();

        let statusText = `📊 *System Status Report*\n\n`;
        statusText += `🟢 Status: ${health.status.toUpperCase()}\n`;
        statusText += `⏰ Uptime: ${report.uptime}\n`;
        statusText += `🧠 Memory: ${report.memory.current.heapUsed}\n`;
        statusText += `📈 Response Time (P95): ${report.responseTime.p95?.toFixed(2)}ms\n`;
        statusText += `📊 Total Events: ${report.events.total}\n`;
        statusText += `❌ Total Errors: ${report.errors.total}\n`;

        if (health.issues.length > 0) {
            statusText += `\n⚠️ *Issues:*\n`;
            health.issues.forEach(issue => {
                statusText += `• ${issue}\n`;
            });
        }

        return {
            type: "text",
            text: statusText,
            options: { parse_mode: "Markdown" }
        };
    }
}
