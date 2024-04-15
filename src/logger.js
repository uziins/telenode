import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

function Logger(loggerName, config, level = '') {
    level = level || config.LOG_LEVEL || 'info';

    if (loggerName in winston.loggers)
        return winston.loggers.get(loggerName);

    const logger = winston.loggers.add(loggerName, {
        console: {
            level,
            colorize: true,
            label: loggerName
        }
    });

    if (config.LOG_CHANNEL === 'daily') {
        logger.add(new DailyRotateFile({
            filename: `logs/${loggerName}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: level
        }));
    } else if (config.LOG_CHANNEL === 'stack') {
        logger.add(new winston.transports.File({ filename: `logs/${loggerName}.log`, level: level }));
    }

    if (config.APP_ENV !== 'production' || config.LOG_CHANNEL === 'console') {
        logger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
            level: config.LOG_CHANNEL === 'console' ? level : 'debug'
        }));
    }
    return logger;
}

export default Logger;