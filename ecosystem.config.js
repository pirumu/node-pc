module.exports = {
  apps: [
    // {
    //   name: 'inventory-api',
    //   script: 'dist/apps/inventory/main.js',
    //   watch: false,
    //   autorestart: true,
    //   max_memory_restart: '1G',
    //   env: {
    //     DOTENV_CONFIG_PATH: 'env/inventory/.env',
    //   },
    // },
    {
      name: 'hardware-bridge-process',
      script: 'dist/apps/hardware-bridge/main.js',
      watch: false,
      autorestart: true,
      max_memory_restart: '2G',
      env: {
        DOTENV_CONFIG_PATH: 'env/hardware-bridge/.env',
      },
    },
    // {
    //   name: 'worker-process',
    //   script: 'dist/apps/worker/main.js',
    //   watch: false,
    //   autorestart: true,
    //   max_memory_restart: '1G',
    //   env: {
    //     DOTENV_CONFIG_PATH: 'env/worker/.env',
    //   },
    // },
  ],
};
