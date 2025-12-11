const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'invoice-service' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // In production, you might add a file transport or send to ELK/Datadog
        // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    ],
});

module.exports = logger;
