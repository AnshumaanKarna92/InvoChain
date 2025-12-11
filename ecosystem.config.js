module.exports = {
    apps: [
        {
            name: 'api-gateway',
            script: './services/api-gateway/index.js',
            instances: 2,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            error_file: './logs/api-gateway-error.log',
            out_file: './logs/api-gateway-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'auth-service',
            script: './services/auth-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3011
            },
            error_file: './logs/auth-error.log',
            out_file: './logs/auth-out.log'
        },
        {
            name: 'invoice-service',
            script: './services/invoice-service/index.js',
            instances: 2,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3002
            },
            error_file: './logs/invoice-error.log',
            out_file: './logs/invoice-out.log'
        },
        {
            name: 'merchant-registry',
            script: './services/merchant-registry-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3012
            },
            error_file: './logs/merchant-error.log',
            out_file: './logs/merchant-out.log'
        },
        {
            name: 'inventory-service',
            script: './services/inventory-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3013
            },
            error_file: './logs/inventory-error.log',
            out_file: './logs/inventory-out.log'
        },
        {
            name: 'audit-service',
            script: './services/audit-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3014
            },
            error_file: './logs/audit-error.log',
            out_file: './logs/audit-out.log'
        },
        {
            name: 'payment-service',
            script: './services/payment-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3010
            },
            error_file: './logs/payment-error.log',
            out_file: './logs/payment-out.log'
        },
        {
            name: 'reconciliation-service',
            script: './services/reconciliation-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3006
            },
            error_file: './logs/reconciliation-error.log',
            out_file: './logs/reconciliation-out.log'
        },
        {
            name: 'gst-return-service',
            script: './services/gst-return-service/index.js',
            instances: 1,
            env: {
                NODE_ENV: 'production',
                PORT: 3008
            },
            error_file: './logs/gst-return-error.log',
            out_file: './logs/gst-return-out.log'
        }
    ]
};
