// PM2 配置文件 - 管理高尔夫文章处理系统
module.exports = {
  apps: [
    // 1. Web服务器 - 始终保持运行
    {
      name: 'golf-web-server',
      script: './web_server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/web-server-error.log',
      out_file: './logs/web-server-out.log',
      time: true
    },
    
    // 2. 智能并发控制器 - 核心处理进程
    {
      name: 'golf-controller',
      script: './intelligent_concurrent_controller.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      restart_delay: 10000,  // 重启延迟10秒
      max_restarts: 10,      // 10分钟内最多重启10次
      min_uptime: '10m',     // 至少运行10分钟才算成功启动
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/controller-error.log',
      out_file: './logs/controller-out.log',
      time: true
    },
    
    // 3. URL生成任务 - 定时运行
    {
      name: 'golf-url-generator',
      script: './auto_scrape_three_sites.js',
      args: '--all-sites',
      instances: 1,
      autorestart: false,
      cron_restart: '0 6,12,18 * * *',  // 每天6点、12点、18点运行
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/url-generator-error.log',
      out_file: './logs/url-generator-out.log',
      time: true
    },
    
    // 4. 健康监控器 - 监控系统状态
    {
      name: 'golf-health-monitor',
      script: './controller_health_monitor.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        CHECK_INTERVAL: 300000  // 5分钟检查一次
      },
      error_file: './logs/health-monitor-error.log',
      out_file: './logs/health-monitor-out.log',
      time: true
    },
    
    // 5. 日志清理器 - 防止磁盘满
    {
      name: 'golf-log-cleaner',
      script: './log_cleaner.js',
      instances: 1,
      autorestart: false,
      cron_restart: '0 3 * * *',  // 每天凌晨3点运行
      watch: false,
      env: {
        NODE_ENV: 'production',
        RETENTION_DAYS: 7,  // 保留7天的日志
        MAX_LOG_SIZE: '1G'  // 单个日志最大1GB
      },
      error_file: './logs/log-cleaner-error.log',
      out_file: './logs/log-cleaner-out.log',
      time: true
    }
  ],
  
  // 部署配置（可选）
  deploy: {
    production: {
      user: 'sanshui',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/sanshui-123/golf-scraper.git',
      path: '/Users/sanshui/Desktop/cursor',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};