# 🚀 高尔夫文章处理系统 - 持续运行指南

本指南提供多种方案让系统持续稳定运行，您可以根据需求选择合适的方案。

## 📋 快速选择指南

| 方案 | 适用场景 | 复杂度 | 稳定性 |
|------|---------|--------|--------|
| **PM2（推荐）** | 生产环境、需要监控 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **系统守护进程** | 服务器、开机自启 | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Crontab定时** | 简单定时任务 | ⭐ | ⭐⭐⭐ |
| **Screen/tmux** | 临时运行、调试 | ⭐ | ⭐⭐ |

---

## 方案1：PM2进程管理器（🌟 推荐）

### 安装PM2
```bash
npm install -g pm2
```

### 快速启动
```bash
# 使用配置文件启动所有服务
pm2 start ecosystem.config.js

# 或使用管理脚本（推荐）
chmod +x pm2_manager.sh
./pm2_manager.sh
```

### PM2常用命令
```bash
# 查看所有进程
pm2 list

# 查看详细状态
pm2 show golf-controller

# 查看日志
pm2 logs
pm2 logs golf-controller --lines 100

# 监控资源使用
pm2 monit

# 重启服务
pm2 restart golf-controller
pm2 restart all

# 停止服务
pm2 stop all

# 保存配置（重启后恢复）
pm2 save

# 设置开机自启
pm2 startup
# 复制输出的命令并执行
```

### PM2 Web界面（可选）
```bash
# 安装PM2 Web监控
pm2 install pm2-web

# 访问 http://localhost:9615 查看Web界面
```

---

## 方案2：macOS系统守护进程

### 安装守护进程
```bash
# 1. 复制plist文件到系统目录
sudo cp com.golf.scraper.plist ~/Library/LaunchAgents/

# 2. 加载守护进程
launchctl load ~/Library/LaunchAgents/com.golf.scraper.plist

# 3. 启动服务
launchctl start com.golf.scraper
```

### 管理守护进程
```bash
# 查看状态
launchctl list | grep golf

# 停止服务
launchctl stop com.golf.scraper

# 卸载服务
launchctl unload ~/Library/LaunchAgents/com.golf.scraper.plist

# 重新加载配置
launchctl unload ~/Library/LaunchAgents/com.golf.scraper.plist
launchctl load ~/Library/LaunchAgents/com.golf.scraper.plist
```

---

## 方案3：Crontab定时任务

### 设置定时任务
```bash
# 编辑crontab
crontab -e

# 添加以下内容：
# 每天6点、12点、18点运行URL生成
0 6,12,18 * * * cd /Users/sanshui/Desktop/cursor && /usr/local/bin/node auto_scrape_three_sites.js --all-sites >> logs/cron.log 2>&1

# 每天凌晨3点清理日志
0 3 * * * cd /Users/sanshui/Desktop/cursor && /usr/local/bin/node log_cleaner.js >> logs/cleanup.log 2>&1

# 每小时检查系统状态
0 * * * * cd /Users/sanshui/Desktop/cursor && ./check_status.sh >> logs/status.log 2>&1

# 系统启动时运行（@reboot可能在macOS上不可用）
@reboot cd /Users/sanshui/Desktop/cursor && ./smart_restart.sh
```

### 查看crontab
```bash
# 列出当前用户的定时任务
crontab -l

# 删除所有定时任务
crontab -r
```

---

## 方案4：Screen/tmux（临时方案）

### 使用Screen
```bash
# 创建新会话
screen -S golf-scraper

# 在会话中运行程序
./smart_restart.sh

# 分离会话（Ctrl+A, D）

# 重新连接
screen -r golf-scraper

# 列出所有会话
screen -ls

# 结束会话
screen -X -S golf-scraper quit
```

### 使用tmux
```bash
# 创建新会话
tmux new -s golf

# 运行程序
./smart_restart.sh

# 分离会话（Ctrl+B, D）

# 重新连接
tmux attach -t golf

# 列出会话
tmux ls

# 结束会话
tmux kill-session -t golf
```

---

## 🔧 故障恢复和监控

### 1. 自动恢复脚本
创建 `auto_recovery.sh`：
```bash
#!/bin/bash
# 每5分钟检查一次，自动恢复崩溃的服务

while true; do
    # 检查Web服务器
    if ! curl -s http://localhost:8080 > /dev/null; then
        echo "$(date): Web服务器未响应，重启中..."
        nohup node web_server.js > web_server.log 2>&1 &
    fi
    
    # 检查控制器
    if ! ps aux | grep -v grep | grep intelligent_concurrent_controller > /dev/null; then
        echo "$(date): 控制器未运行，重启中..."
        nohup node intelligent_concurrent_controller.js > controller.log 2>&1 &
    fi
    
    sleep 300  # 5分钟
done
```

### 2. 系统监控
```bash
# 查看实时状态
./realtime_monitor.sh

# 系统诊断
./system_diagnosis.sh

# 性能监控
./performance_monitor.sh
```

### 3. 日志管理
```bash
# 手动清理日志
node log_cleaner.js

# 查看日志大小
du -sh logs/*

# 压缩旧日志
find logs -name "*.log" -mtime +7 -exec gzip {} \;
```

---

## 📊 监控面板

访问以下地址查看系统状态：
- **Web监控面板**: http://localhost:8080/monitor
- **文章列表**: http://localhost:8080
- **API状态**: http://localhost:8080/api/status

---

## 🚨 常见问题

### 1. 进程占用过多内存
```bash
# 使用PM2设置内存限制
pm2 start ecosystem.config.js --max-memory-restart 1G
```

### 2. 日志文件过大
```bash
# 运行日志清理
node log_cleaner.js

# PM2日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

### 3. API响应变慢
```bash
# 检查并发数
cat intelligent_concurrent_controller.js | grep maxConcurrency

# 确保只运行一个控制器
./safe_single_controller.sh
```

### 4. 系统重启后服务未启动
```bash
# 重新设置PM2开机自启
pm2 startup
pm2 save

# 或使用系统守护进程
launchctl load ~/Library/LaunchAgents/com.golf.scraper.plist
```

---

## 💡 最佳实践

1. **使用PM2管理**：最简单可靠的方案
2. **定期检查日志**：避免磁盘空间耗尽
3. **监控API响应时间**：及时发现性能问题
4. **备份重要数据**：定期备份 `master_history_database.json`
5. **限制并发数**：严格遵守2个并发的限制

---

## 📞 快速命令参考

```bash
# 一键启动（PM2）
pm2 start ecosystem.config.js

# 一键重启
pm2 restart all

# 查看状态
pm2 list

# 查看日志
pm2 logs --lines 50

# 停止所有
pm2 stop all

# 监控资源
pm2 monit

# 清理日志
pm2 flush
```

---

## 🎯 推荐配置

对于生产环境，推荐使用以下组合：
1. **PM2** 作为进程管理器
2. **定时任务** 进行日志清理
3. **监控面板** 实时查看状态
4. **自动恢复脚本** 作为备份方案

这样可以确保系统24/7稳定运行，自动处理文章，无需人工干预。