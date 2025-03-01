import Logger from "../logger.js";
import config from "../config.js";

const log = Logger(config.APP_NAME, 'performance', config.LOG_LEVEL);

export default class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
        this.eventCounts = new Map();
        this.errorCounts = new Map();
        this.responseTimesMs = [];
        this.maxResponseTimeEntries = 1000; // Keep last 1000 response times
        
        // System metrics
        this.systemMetrics = {
            memoryUsage: [],
            cpuUsage: [],
            maxEntries: 100 // Keep last 100 entries
        };
        
        // Start collecting system metrics
        this.startSystemMetricsCollection();
        
        log.debug('Performance monitor initialized');
    }

    startSystemMetricsCollection() {
        // Collect system metrics every 30 seconds
        this.systemMetricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);
    }

    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const timestamp = Date.now();
        
        // Add memory usage
        this.systemMetrics.memoryUsage.push({
            timestamp,
            rss: memUsage.rss,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
        });
        
        // Keep only last maxEntries
        if (this.systemMetrics.memoryUsage.length > this.systemMetrics.maxEntries) {
            this.systemMetrics.memoryUsage.shift();
        }
        
        // CPU usage would require additional modules, placeholder for now
        this.systemMetrics.cpuUsage.push({
            timestamp,
            usage: process.cpuUsage()
        });
        
        if (this.systemMetrics.cpuUsage.length > this.systemMetrics.maxEntries) {
            this.systemMetrics.cpuUsage.shift();
        }
    }

    // Timer for measuring execution time
    startTimer(name) {
        this.metrics.set(name, {
            startTime: process.hrtime.bigint(),
            timestamp: Date.now()
        });
    }

    endTimer(name) {
        const metric = this.metrics.get(name);
        if (!metric) {
            log.warn(`Timer ${name} not found`);
            return null;
        }
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - metric.startTime) / 1000000; // Convert to milliseconds
        
        this.metrics.delete(name);
        
        // Store response time
        this.responseTimesMs.push(duration);
        if (this.responseTimesMs.length > this.maxResponseTimeEntries) {
            this.responseTimesMs.shift();
        }
        
        return duration;
    }

    // Measure function execution time
    async measureAsync(name, fn) {
        this.startTimer(name);
        try {
            const result = await fn();
            const duration = this.endTimer(name);
            log.debug(`${name} completed in ${duration?.toFixed(2)}ms`);
            return result;
        } catch (error) {
            this.endTimer(name);
            this.recordError(name, error);
            throw error;
        }
    }

    measure(name, fn) {
        this.startTimer(name);
        try {
            const result = fn();
            const duration = this.endTimer(name);
            log.debug(`${name} completed in ${duration?.toFixed(2)}ms`);
            return result;
        } catch (error) {
            this.endTimer(name);
            this.recordError(name, error);
            throw error;
        }
    }

    // Event counting
    incrementEvent(eventName) {
        const count = this.eventCounts.get(eventName) || 0;
        this.eventCounts.set(eventName, count + 1);
    }

    // Error tracking
    recordError(operation, error) {
        const errorKey = `${operation}:${error.name || 'Unknown'}`;
        const count = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, count + 1);
        
        log.error(`Error in ${operation}:`, error.message);
    }

    // Performance statistics
    getResponseTimeStats() {
        if (this.responseTimesMs.length === 0) {
            return {
                count: 0,
                min: 0,
                max: 0,
                avg: 0,
                p50: 0,
                p95: 0,
                p99: 0
            };
        }
        
        const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
        const count = sorted.length;
        
        return {
            count,
            min: sorted[0],
            max: sorted[count - 1],
            avg: sorted.reduce((a, b) => a + b, 0) / count,
            p50: this.percentile(sorted, 50),
            p95: this.percentile(sorted, 95),
            p99: this.percentile(sorted, 99)
        };
    }

    percentile(sortedArray, p) {
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    getMemoryStats() {
        const current = process.memoryUsage();
        const history = this.systemMetrics.memoryUsage;
        
        if (history.length === 0) {
            return {
                current: this.formatMemory(current),
                trend: 'no-data'
            };
        }
        
        const recent = history.slice(-10); // Last 10 entries
        const avgHeapUsed = recent.reduce((sum, entry) => sum + entry.heapUsed, 0) / recent.length;
        const trend = current.heapUsed > avgHeapUsed * 1.1 ? 'increasing' : 
                     current.heapUsed < avgHeapUsed * 0.9 ? 'decreasing' : 'stable';
        
        return {
            current: this.formatMemory(current),
            trend,
            history: recent.map(entry => ({
                timestamp: entry.timestamp,
                heapUsed: this.formatBytes(entry.heapUsed),
                rss: this.formatBytes(entry.rss)
            }))
        };
    }

    formatMemory(memUsage) {
        return {
            rss: this.formatBytes(memUsage.rss),
            heapUsed: this.formatBytes(memUsage.heapUsed),
            heapTotal: this.formatBytes(memUsage.heapTotal),
            external: this.formatBytes(memUsage.external)
        };
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    // Comprehensive performance report
    getPerformanceReport() {
        const uptime = Date.now() - this.startTime;
        
        return {
            uptime: this.formatDuration(uptime),
            timestamp: new Date().toISOString(),
            memory: this.getMemoryStats(),
            responseTime: this.getResponseTimeStats(),
            events: {
                total: Array.from(this.eventCounts.values()).reduce((sum, count) => sum + count, 0),
                breakdown: Object.fromEntries(this.eventCounts)
            },
            errors: {
                total: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
                breakdown: Object.fromEntries(this.errorCounts)
            },
            activeTimers: this.metrics.size
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // Health check
    getHealthStatus() {
        const memStats = this.getMemoryStats();
        const responseStats = this.getResponseTimeStats();
        const errorRate = this.getErrorRate();
        
        let status = 'healthy';
        const issues = [];
        
        // Check memory usage
        const heapUsed = process.memoryUsage().heapUsed;
        if (heapUsed > 500 * 1024 * 1024) { // 500MB threshold
            status = 'warning';
            issues.push('High memory usage');
        }
        
        // Check response times
        if (responseStats.p95 > 5000) { // 5 second threshold
            status = 'warning';
            issues.push('High response times');
        }
        
        // Check error rate
        if (errorRate > 5) { // 5% error rate threshold
            status = 'unhealthy';
            issues.push('High error rate');
        }
        
        return {
            status,
            issues,
            checks: {
                memory: memStats.trend,
                responseTime: responseStats.p95,
                errorRate: `${errorRate.toFixed(2)}%`
            }
        };
    }

    getErrorRate() {
        const totalEvents = Array.from(this.eventCounts.values()).reduce((sum, count) => sum + count, 0);
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        
        return totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0;
    }

    // Reset statistics
    reset() {
        this.metrics.clear();
        this.eventCounts.clear();
        this.errorCounts.clear();
        this.responseTimesMs = [];
        this.systemMetrics.memoryUsage = [];
        this.systemMetrics.cpuUsage = [];
        this.startTime = Date.now();
        
        log.info('Performance metrics reset');
    }

    // Cleanup
    destroy() {
        if (this.systemMetricsInterval) {
            clearInterval(this.systemMetricsInterval);
        }
        this.reset();
        log.debug('Performance monitor destroyed');
    }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
