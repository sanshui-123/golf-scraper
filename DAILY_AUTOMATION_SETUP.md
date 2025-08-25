# 每日高尔夫文章自动抓取 - 定时任务设置指南

## 概述
本指南介绍如何设置 `daily_golf_scraper.js` 的每日自动执行，确保系统每天自动抓取高尔夫文章。

## 方案一：使用 Cron (推荐)

### 1. 编辑 crontab
```bash
crontab -e
```

### 2. 添加定时任务
```bash
# 每天早上6:00执行
0 6 * * * cd /Users/sanshui/Desktop/cursor && /usr/local/bin/node daily_golf_scraper.js >> daily_scraper_cron.log 2>&1

# 或者每天上午9:00执行（考虑网站更新时间）
0 9 * * * cd /Users/sanshui/Desktop/cursor && /usr/local/bin/node daily_golf_scraper.js >> daily_scraper_cron.log 2>&1
```

### 3. 验证 crontab
```bash
crontab -l
```

## 方案二：使用 launchd (macOS 专用)

### 1. 创建 plist 文件
创建文件 `~/Library/LaunchAgents/com.golf.daily.scraper.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.golf.daily.scraper</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/sanshui/Desktop/cursor/daily_golf_scraper.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Users/sanshui/Desktop/cursor</string>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/sanshui/Desktop/cursor/daily_scraper_launchd.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/sanshui/Desktop/cursor/daily_scraper_launchd_error.log</string>
    
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

### 2. 加载定时任务
```bash
launchctl load ~/Library/LaunchAgents/com.golf.daily.scraper.plist
```

### 3. 管理命令
```bash
# 启动任务
launchctl start com.golf.daily.scraper

# 停止任务
launchctl stop com.golf.daily.scraper

# 卸载任务
launchctl unload ~/Library/LaunchAgents/com.golf.daily.scraper.plist

# 查看任务状态
launchctl list | grep golf
```

## 方案三：使用 Node.js 调度器

### 1. 创建调度脚本
创建 `scheduler.js`:

```javascript
const schedule = require('node-schedule');
const DailyGolfScraper = require('./daily_golf_scraper');

// 每天早上6:00执行
const job = schedule.scheduleJob('0 6 * * *', async function() {
    console.log('开始每日高尔夫文章抓取...');
    const scraper = new DailyGolfScraper();
    const result = await scraper.run();
    console.log('抓取完成:', result);
});

console.log('调度器已启动，每天6:00执行抓取任务');
console.log('按 Ctrl+C 退出');

// 保持进程运行
process.stdin.resume();
```

### 2. 安装依赖
```bash
npm install node-schedule
```

### 3. 使用 PM2 保持运行
```bash
# 安装 PM2
npm install -g pm2

# 启动调度器
pm2 start scheduler.js --name golf-scheduler

# 保存 PM2 配置
pm2 save

# 设置开机启动
pm2 startup
```

## 测试和验证

### 1. 手动测试
```bash
node daily_golf_scraper.js
```

### 2. 查看日志
```bash
# 查看今日日志
tail -f daily_scraper_$(date +%Y-%m-%d).log

# 查看今日报告
cat daily_report_$(date +%Y-%m-%d).md
```

### 3. 验证定时任务
```bash
# 查看 cron 日志 (Linux/macOS)
grep CRON /var/log/syslog

# 查看 launchd 日志 (macOS)
tail -f /var/log/system.log | grep golf
```

## 监控和维护

### 1. 设置邮件通知（可选）
在 `daily_golf_scraper.js` 末尾添加邮件发送功能：

```javascript
// 需要先安装: npm install nodemailer
const nodemailer = require('nodemailer');

async function sendReport(report) {
    const transporter = nodemailer.createTransporter({
        // 配置邮件服务器
    });
    
    await transporter.sendMail({
        to: 'your-email@example.com',
        subject: `高尔夫文章抓取报告 - ${new Date().toLocaleDateString()}`,
        html: report
    });
}
```

### 2. 定期检查
- 每周检查一次日志文件大小
- 每月清理旧的日志和报告文件
- 定期验证抓取质量和成功率

### 3. 故障处理
如果定时任务未执行：
1. 检查系统时间设置
2. 验证 Node.js 路径是否正确
3. 确认工作目录权限
4. 查看错误日志

## 建议的执行时间

根据高尔夫网站的更新规律，建议的执行时间：
- **早上 6:00-7:00**: 捕获夜间更新的文章
- **上午 9:00-10:00**: 捕获早晨发布的文章
- **下午 15:00-16:00**: 捕获工作时间发布的文章

选择一个最适合你需求的时间点。

## 注意事项

1. **网络连接**: 确保执行时网络连接稳定
2. **VPN兼容**: 如使用VPN，确保定时任务执行时VPN已连接
3. **资源占用**: 避免在系统繁忙时执行
4. **错误处理**: 定期检查错误日志，及时处理问题
5. **更新维护**: 定期更新脚本和依赖包

---

*最后更新: 2025-08-09*