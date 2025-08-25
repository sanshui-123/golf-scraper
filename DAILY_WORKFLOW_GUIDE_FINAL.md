# 高尔夫内容工作流使用指南（最终版）

## 工作流程概述

本工作流包含两个步骤：
1. **扫描新文章** - 使用优化版扫描器
2. **处理新文章** - 使用已封装的批处理器

## 时间范围

- **默认时间范围**：北京时间每天10:00到第二天10:00
- **自动判断**：如果当前时间在10点前，扫描前一天10点到今天10点

## 使用方法

### 方法一：运行完整工作流（推荐）
```bash
node daily_golf_workflow_final.js
```

### 方法二：分步运行

1. **先扫描**：
```bash
node golf_scanner_optimized.js
```

2. **再处理**：
```bash
node process_scan_results.js
```

## 文件说明

- `golf_scanner_optimized.js` - 优化版扫描器（已修复时间范围）
- `batch_process_articles.js` - 批处理器（保持原封装不变）
- `process_scan_results.js` - 连接脚本（读取扫描结果并调用批处理器）
- `daily_golf_workflow_final.js` - 完整工作流脚本

## 输出结果

处理完成后，文件保存在：
```
golf_content/
└── 2025-07-10/           # 当天日期
    ├── articles/         # 改写后的文章
    ├── images/          # 所有文章图片
    ├── wechat_ready/    # 微信格式
    ├── wechat_html/     # HTML版本
    └── article_urls.json # 已处理文章记录
```

## 注意事项

1. **不要修改已封装的程序**
2. **扫描器会自动避免重复处理**
3. **批处理器保持原有逻辑不变**
4. **图片下载不限数量**
5. **使用原有的Claude改写工具**

## 查看结果

处理完成后，运行内容管理服务器：
```bash
node start_enhanced_manager.js
```
然后访问 http://localhost:8080