module.exports = {
  apps: [
    {
      name: 'inventory-api-service',
      script: 'dist/apps/inventory/main.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '1G',
      env: {
        DOTENV_CONFIG_PATH: 'env/inventory/.env',
      },
    },
    {
      name: 'hardware-bridge-service',
      script: 'dist/apps/hardware-bridge/main.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '2G',
      env: {
        DOTENV_CONFIG_PATH: 'env/hardware-bridge/.env',
      },
    },
    {
      name: 'process-worker-service',
      script: 'dist/apps/process-worker/main.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '2G',
      env: {
        DOTENV_CONFIG_PATH: 'env/process-worker/.env',
      },
    },
    {
      name: 'sync-worker-service',
      script: 'dist/apps/sync-worker/main.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '1G',
      env: {
        DOTENV_CONFIG_PATH: 'env/sync-worker/.env',
      },
    },
  ],
};
