import { performanceMonitor } from "../../helpers/performance.js";

export default class HealthHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.log = masterPlugin.log;
    }

    async handleHealthCheck({message}) {
        const health = performanceMonitor.getHealthStatus();
        const memStats = performanceMonitor.getMemoryStats();

        let text = `🏥 *Health Check Report*\n\n`;

        const statusEmoji = {
            'healthy': '🟢',
            'warning': '🟡',
            'unhealthy': '🔴'
        };

        text += `${statusEmoji[health.status]} Overall Status: ${health.status.toUpperCase()}\n\n`;

        text += `🧠 *Memory Trend:* ${memStats.trend}\n`;
        text += `⚡ *Response Time (P95):* ${health.checks.responseTime}ms\n`;
        text += `❌ *Error Rate:* ${health.checks.errorRate}\n\n`;

        if (health.issues.length > 0) {
            text += `⚠️ *Issues Detected:*\n`;
            health.issues.forEach(issue => {
                text += `• ${issue}\n`;
            });
        } else {
            text += `✅ No issues detected`;
        }

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }
}
