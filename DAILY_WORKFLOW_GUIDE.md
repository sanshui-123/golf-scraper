# 每日高尔夫内容工作流使用指南

## 🌟 概述

本工作流提供了完整的高尔夫内容抓取、处理和发布解决方案，包含时间范围扫描、批量处理和错误恢复等功能。

## 📦 封装的工具清单

### 1. 时间范围扫描器
- **文件**: `golf_monthly_time_scanner_v2.js`
- **功能**: 扫描指定时间范围内的新文章（默认：北京时间昨日10点到今日10点）
- **特点**: 自动过滤已处理文章，支持时区转换

### 2. 安全文章处理器 V2
- **文件**: `article_processor_safe_wrapper_v2.js`
- **功能**: 处理单篇文章，包含抓取、Claude改写、图片下载等
- **特点**: 
  - 防止图片覆盖
  - 自动修复文件名bug
  - 智能编号分配
  - 保存原文链接

### 3. 每日工作流（新）
- **文件**: `daily_golf_workflow.js`
- **功能**: 完整的扫描和批量处理流程
- **特点**: 进度显示、错误处理、结果汇总

### 4. 批量URL处理器（新）
- **文件**: `batch_process_urls.js`
- **功能**: 处理指定的URL列表
- **特点**: 支持命令行参数和文件输入

### 5. 其他辅助工具
- `claude_safe_runner_quiet.js` - Claude进程管理
- `handle_stuck_claude_article.js` - 处理卡住的Claude
- `optimize_article_images.js` - 优化图片分布

## 🚀 推荐使用流程

### 方法一：全自动工作流（推荐）

```bash
# 扫描并自动处理所有新文章
node daily_golf_workflow.js --auto

# 扫描并手动确认是否处理
node daily_golf_workflow.js
```

### 方法二：分步操作

1. **扫描新文章**
```bash
node golf_monthly_time_scanner_v2.js
```

2. **批量处理扫描到的文章**
```bash
# 自动处理前10篇
node golf_monthly_time_scanner_v2.js --auto --limit 10

# 或手动处理指定文章
node article_processor_safe_wrapper_v2.js "https://www.golfmonthly.com/..."
```

### 方法三：处理特定URL列表

```bash
# 直接传入多个URL
node batch_process_urls.js "URL1" "URL2" "URL3"

# 从文件读取URL列表
node batch_process_urls.js --file urls.txt
```

## 📋 使用示例

### 每日例行操作
```bash
# 每天上午10点后运行
node daily_golf_workflow.js --auto
```

### 处理失败重试
```bash
# 单独重试失败的文章
node article_processor_safe_wrapper_v2.js "失败的URL"
```

### 批量补充处理
```bash
# 创建urls.txt文件，每行一个URL
echo "https://www.golfmonthly.com/article1" > urls.txt
echo "https://www.golfmonthly.com/article2" >> urls.txt

# 批量处理
node batch_process_urls.js --file urls.txt
```

## ⚠️ 注意事项

1. **时间范围**: 默认扫描北京时间昨日10点到今日10点的文章
2. **处理时间**: 每篇文章处理约需1-2分钟
3. **超时处理**: 单篇文章超过3分钟会自动跳过
4. **重复检测**: 系统会自动跳过已处理的文章

## 🔧 故障排除

### Claude卡住
```bash
node handle_stuck_claude_article.js temp_文件路径 文章编号
```

### 图片显示问题
```bash
node optimize_article_images.js 文章编号
```

### 查看处理结果
```bash
# 启动本地服务器
node simple_server.js

# 访问 http://localhost:8080
```

## 📊 输出说明

- **文章保存位置**: `golf_content/日期/wechat_ready/`
- **图片保存位置**: `golf_content/日期/images/`
- **URL映射文件**: `golf_content/日期/article_urls.json`
- **扫描结果**: `scan_results/日期/scan_result_*.json`

## 🎯 最佳实践

1. **定时执行**: 建议每天上午10:30运行工作流
2. **错误处理**: 失败的文章可以稍后单独重试
3. **批量限制**: 一次处理不超过10篇文章，避免超时
4. **备份数据**: 定期备份 `golf_content` 目录

## 📝 更新日志

- **v2.0** (2025-07-09)
  - 新增 `daily_golf_workflow.js` 完整工作流
  - 新增 `batch_process_urls.js` 批量URL处理
  - 优化超时处理和进度显示
  - 改进错误恢复机制

---

如有问题或需要帮助，请查看各工具的 `--help` 参数获取详细用法。