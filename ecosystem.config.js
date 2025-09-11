module.exports = {
  apps: [
    // {
    //   name: 'inventory-api',
    //   script: 'dist/apps/inventory/main.js',
    //   watch: false,
    //   autorestart: true,
    //   restart_delay: 3000,
    //   exp_backoff_restart_delay: 1000,
    //   max_memory_restart: '1G',
    //   env: {
    //     DOTENV_CONFIG_PATH: 'env/inventory/.env',
    //   },
    // },
    // {
    //   name: 'hardware-bridge-process',
    //   script: 'dist/apps/hardware-bridge/main.js',
    //   watch: false,
    //   autorestart: true,
    //   restart_delay: 3000,
    //   exp_backoff_restart_delay: 1000,
    //   max_memory_restart: '2G',
    //   env: {
    //     DOTENV_CONFIG_PATH: 'env/hardware-bridge/.env',
    //   },
    // },
    // {
    //   name: 'process-worker',
    //   script: 'dist/apps/process-worker/main.js',
    //   watch: false,
    //   autorestart: true,
    //   restart_delay: 3000,
    //   exp_backoff_restart_delay: 1000,
    //   max_memory_restart: '2G',
    //   env: {
    //     DOTENV_CONFIG_PATH: 'env/process-worker/.env',
    //   },
    // },
    {
      name: 'sync-worker',
      script: 'dist/apps/sync-worker/main.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '1G',
      node_args: '--no-warnings',
      env: {
        DOTENV_CONFIG_PATH: 'env/sync-worker/.env',
      },
    },
  ],
};
