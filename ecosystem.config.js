module.exports = {
  apps: [
    {
      name: 'carwash-api',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'carwash-ui',
      script: 'scripts/serve-ui.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        UI_PORT: 3000,
      },
    },
  ],
};
