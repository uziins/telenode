'use strict';

const path = require('path');

module.exports = {
    apps: [
        {
            name: 'telenode',
            script: 'src/app.js',
            // Pin the working directory to the project root for consistency and
            // to ensure other file operations that rely on process.cwd() behave correctly.
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
        },
    ],
};
