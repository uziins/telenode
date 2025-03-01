module.exports = {
  apps: [
    {
      name: 'telenode',
      script: 'src/app.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      
      env_development: {
        NODE_ENV: 'development',
        APP_ENV: 'development',
        LOG_LEVEL: 'debug'
      },
      
      // Monitoring and restart configuration
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced PM2 features
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'plugins'],
      watch_options: {
        followSymlinks: false
      },
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Performance monitoring
      pmx: true,
      
      // Auto restart on file changes (for development only)
      // watch: process.env.NODE_ENV === 'development',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Source map support
      source_map_support: true,
      
      // Disable automatic restart on crash in development
      autorestart: process.env.NODE_ENV !== 'development',
      
      // Environment specific settings
      node_args: process.env.NODE_ENV === 'development' ? ['--inspect'] : []
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/telenode.git',
      path: '/var/www/telenode',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};

