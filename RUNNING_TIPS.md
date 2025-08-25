# 🚀 系统运行建议和最佳实践

## 为什么系统会不稳定？

1. **Claude API的特性**
   - Claude需要时间思考和生成内容（通常需要30-120秒）
   - 网络波动会影响响应时间
   - 同时调用太多会导致排队

2. **网站的反爬虫机制**
   - 某些网站（特别是MyGolfSpy）有严格的访问限制
   - 频繁访问可能触发临时封禁

3. **系统资源限制**
   - 内存和CPU使用可能影响处理速度
   - 并发处理可能导致资源竞争

## 🎯 最佳运行实践

### 1. 分批处理文章
```bash
# 推荐：每次处理5-10篇文章
node discover_recent_articles.js https://www.golfmonthly.com 5 --ignore-time --auto-process

# 而不是一次处理太多
# node discover_recent_articles.js https://www.golfmonthly.com 50 --ignore-time --auto-process
```

### 2. 错开处理时间
```bash
# 早上处理 Golf.com
node discover_recent_articles.js https://golf.com 10 --ignore-time --auto-process

# 下午处理 GolfMonthly
node discover_recent_articles.js https://www.golfmonthly.com 10 --ignore-time --auto-process

# 晚上处理 MyGolfSpy
node process_mygolfspy_rss.js process 10
```

### 3. 监控处理进度
- 观察日志中的超时信息
- 如果频繁出现"Claude返回空内容"，暂停一段时间
- 检查 `failed_articles.json` 了解失败原因

### 4. 处理失败的文章
```bash
# 查看失败文章统计
node count_all_articles.js

# 重试失败的文章
node process_failed_articles.js
```

## 🔧 调优建议

### 如果仍然不稳定，可以调整 `stability_config.json`：

1. **增加超时时间**
```json
"base": {
  "mygolfspy": 180000,  // 改为3分钟
  "golf.com": 150000    // 改为2.5分钟
}
```

2. **增加调用间隔**
```json
"minCallInterval": 5000,  // 改为5秒
```

3. **减少重试次数**（如果网络特别差）
```json
"maxRetries": 1,  // 减少到1次
```

## 📊 性能指标参考

正常情况下的处理时间：
- 简单文章（<3KB）：30-60秒
- 中等文章（3-8KB）：60-120秒  
- 复杂文章（>8KB）：120-240秒
- 装备类长文：可能需要3-5分钟

## 🚨 故障排除

### 1. "Claude返回空内容"
- 等待5-10分钟再试
- 检查网络连接
- 尝试 `claude --version` 确认Claude正常

### 2. "页面加载超时"
- 检查目标网站是否正常访问
- 尝试使用VPN
- 减少并发处理数量

### 3. "改写超时"
- 文章可能太长，考虑手动处理
- 检查 `stability_config.json` 中的超时设置
- 在网络较好的时段运行

## 💡 推荐工作流程

1. **每日定时运行**（例如使用cron）
```bash
# 每天早上8点运行
0 8 * * * cd /path/to/cursor && node auto_scrape_three_sites.js
```

2. **手动监督模式**
```bash
# 不使用 --auto-process，手动确认每批文章
node discover_recent_articles.js https://www.golfmonthly.com 5 --ignore-time
```

3. **失败重试策略**
- 第一次失败：等待1小时后重试
- 第二次失败：第二天再试
- 第三次失败：考虑手动处理

## 🎉 记住

- 稳定性比速度更重要
- 少量多次比大量一次更可靠
- 遇到问题时，休息一下再继续