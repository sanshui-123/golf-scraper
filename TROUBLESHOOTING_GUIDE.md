# 🚨 故障排除快速指南

## 进程卡死问题 - 快速解决

### 症状识别
- ✅ 文章停止更新（时间戳不变）
- ✅ 进程存在但无响应  
- ✅ 日志显示"等待中"状态

### 5分钟快速修复

#### 1. 诊断当前状态
```bash
# 检查运行进程
ps aux | grep -E "(auto_scrape|discover_|batch_process)" | grep -v grep

# 检查最新文章
ls -lt golf_content/*/wechat_ready/ | head -5

# 检查URL发现结果  
wc -l deep_urls_*.txt
```

#### 2. 强制重启系统
```bash
# 终止所有相关进程
pkill -f auto_scrape
pkill -f discover_
pkill -f process_

# 重启Web服务器（如需要）
lsof -ti:8080 | xargs kill -9 2>/dev/null
node web_server.js &

# 继续处理已发现的URL
for file in deep_urls_*.txt; do
    if [ -s "$file" ]; then
        echo "处理 $file"
        node batch_process_articles.js "$file" &
    fi
done
```

#### 3. 使用增强版系统（推荐）
```bash
# 一键启动带超时保护的增强版
node auto_scrape_enhanced.js --all-sites
```

---

## 常见问题快速查询

### Web服务器无法访问
```bash
# 检查端口占用
lsof -i :8080

# 强制重启
kill -9 $(lsof -ti:8080) 2>/dev/null
node web_server.js
```

### 文章重复处理
```bash
# 检查重复
grep "本地已存在" *.log | wc -l

# 清理重复
node clean_duplicate_articles.js
```

### 进程僵死不退出
```bash
# 查找僵尸进程
ps aux | grep -E "(discover_|process_)" | grep -v grep

# 强制终止
pkill -9 -f "discover_"
pkill -9 -f "process_"
```

### URL发现失败
```bash
# 检查网络连接
curl -I https://golf.com
curl -I https://www.golfmonthly.com

# 手动重新发现
node discover_recent_articles.js golf.com 10 --urls-only
```

### Golf Monthly分页链接问题
```bash
# 症状：发现page/2, page/3等分页链接
# 检查URL文件内容
cat deep_urls_www_golfmonthly_com.txt | grep -E "(page/|archive)"

# 一键修复分页链接问题
node fix_golf_monthly_url_discovery.js

# 处理修复后的真实文章
node batch_process_articles.js golf_monthly_fixed_urls_*.txt
```

### 所有网站URL质量问题
```bash
# 检查所有网站URL质量
node check_all_websites_url_quality.js

# 修复特定网站URL问题
node fix_website_urls.js [网站名]

# 网站列表: golf.com, golfmonthly.com, mygolfspy.com, golfwrx.com, golfdigest.com

# MyGolfSpy特殊处理（推荐RSS方法）
node process_mygolfspy_rss.js process 20 --urls-only
```

---

## 系统健康检查

### 每日检查清单
- [ ] Web服务器正常响应: `curl -I http://localhost:8080`
- [ ] 最新文章时间合理: `ls -lt golf_content/*/wechat_ready/ | head -1`
- [ ] 无僵尸进程: `ps aux | grep node | grep -v grep`
- [ ] 磁盘空间充足: `df -h`
- [ ] 日志文件大小正常: `ls -lh *.log`

### 性能监控
```bash
# 检查文章处理速度
tail -f health_manager.log | grep "处理完成"

# 监控内存使用
ps aux | grep node | awk '{print $4, $11}' | sort -nr

# 检查网络延迟
ping -c 3 golf.com
ping -c 3 golfmonthly.com
```

---

## 紧急联系信息

### 关键文件位置
- 系统配置: `CLAUDE.md`
- 错误日志: `scraper.log`, `health_manager.log`
- 状态文件: `enhanced_scraper_state.json`
- URL映射: `golf_content/*/article_urls.json`

### 备份和恢复
```bash
# 创建系统快照
tar -czf system_backup_$(date +%Y%m%d).tar.gz \
    *.js *.json *.md *.log golf_content/

# 恢复到上个工作状态
# (需要具体恢复步骤，根据实际情况调整)
```

---

## 预防措施

### 系统优化建议
1. **定期重启**: 每周重启一次系统进程
2. **日志轮转**: 定期清理大日志文件
3. **磁盘清理**: 清理临时文件和旧备份
4. **监控告警**: 设置关键指标监控
5. **文档更新**: 记录新问题和解决方案

### 最佳实践
- 使用增强版抓取系统而非原版
- 设置合理的超时时间
- 定期检查系统健康状态
- 保持文档和代码同步更新

---

**📞 如需更多帮助，请查阅 `CLAUDE.md` 中的详细文档**