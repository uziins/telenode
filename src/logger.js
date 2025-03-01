import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import config from "./config.js";

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, label }) => {
        return `${timestamp} [${label ?? 'no-label'}] ${level}: ${message}`;
    })
);

function Logger(loggerName, label = '', level = '') {
    level = level || config.LOG_LEVEL || 'info';

    if (!loggerName) {
        loggerName = config.APP_NAME;
    }

    if (loggerName in winston.loggers)
        if (label)
            return winston.loggers.get(loggerName).child({label});
        else
            return winston.loggers.get(loggerName);

    const transports = [];

    if (config.LOG_CHANNEL === 'daily') {
        transports.push(new DailyRotateFile({
            format: logFormat,
            filename: `logs/${loggerName}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: level
        }));
    } else if (config.LOG_CHANNEL === 'stack') {
        transports.push(new winston.transports.File({
            format: logFormat,
            filename: `logs/${loggerName}.log`,
            level: level,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }));
    }

    if (config.APP_ENV !== 'production' || config.LOG_CHANNEL === 'console' || transports.length === 0) {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, label }) => `[${label}] ${level}: ${message}`)
            ),
            level: config.LOG_CHANNEL === 'console' ? level : 'debug'
        }));
    }

    const logger = winston.loggers.add(loggerName, {
        transports
    })

    if (label) {
        return logger.child({label});
    }

    return logger;
}

export default Logger;