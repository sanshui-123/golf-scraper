# 高尔夫内容工作流 - 当前可用版本指南

## 一、核心封装模块（禁止修改，只能调用）

### 1. article_rewriter_final.js
- **功能**：使用Claude将英文文章改写成中文
- **超时**：180秒
- **缓冲**：20MB

### 2. image_processor_final.js  
- **功能**：下载图片并替换文章中的占位符
- **重试**：3次
- **超时**：15秒/次

## 二、主要工作流程

### 1. 完整自动化工作流
```bash
# 运行每日工作流（扫描+处理）
node daily_golf_workflow_final.js
```

**执行步骤**：
1. 扫描新文章（golf_scanner_optimized.js）
2. 处理扫描结果（process_scan_results.js）
3. 批量处理文章（run_batch_processor.js）

### 2. 手动处理单个URL
```bash
# 创建URL文件
echo '["https://www.golfmonthly.com/your-article-url"]' > temp_urls.json

# 运行批处理
node run_batch_processor.js temp_urls.json
```

## 三、文件结构

```
golf_content/
├── 2025-07-10/                    # 按日期组织
│   ├── images/                    # 图片文件夹
│   │   ├── article_01_img_1.jpg
│   │   ├── article_01_img_2.jpg
│   │   └── ...
│   ├── wechat_ready/             # 改写后的Markdown文件
│   │   ├── wechat_article_01.md
│   │   └── wechat_article_02.md
│   ├── wechat_html/              # HTML版本
│   │   ├── wechat_article_01.html
│   │   └── wechat_article_02.html
│   └── article_urls.json         # URL映射
```

## 四、核心文件清单

### 工作流文件
- `daily_golf_workflow_final.js` - 主工作流程序
- `golf_scanner_optimized.js` - 文章扫描器（包含去重和验证）
- `process_scan_results.js` - 处理扫描结果
- `run_batch_processor.js` - 动态运行批处理器
- `batch_process_articles.js` - 批量处理文章

### 封装模块（只读）
- `article_rewriter_final.js` - 文章改写模块
- `image_processor_final.js` - 图片处理模块

### 配置文件
- `golf_rewrite_prompt_turbo.txt` - Claude改写提示词
- `package.json` - 项目依赖

### 辅助工具
- `start_content_manager.js` - 启动内容管理服务器
- `golf_content_manager_enhanced.js` - 增强版内容管理器

## 五、使用流程

### 1. 每日自动抓取
```bash
# 每天运行一次，自动扫描和处理新文章
node daily_golf_workflow_final.js
```

### 2. 手动处理特定文章
```bash
# 步骤1：创建URL列表文件
echo '["URL1", "URL2", "URL3"]' > my_urls.json

# 步骤2：运行批处理
node run_batch_processor.js my_urls.json
```

### 3. 查看结果
```bash
# 启动本地服务器
node start_content_manager.js

# 访问 http://localhost:8080 查看内容
```

## 六、注意事项

1. **时间设置**：扫描器设置为北京时间10:00到次日10:00
2. **去重机制**：自动检查已处理文章，避免重复
3. **验证机制**：检查文章是否包含中文，未正确改写的会重新处理
4. **图片限制**：每篇文章最多处理3张图片
5. **超时处理**：Claude改写超时180秒，会自动跳过
6. **重试机制**：图片下载失败会自动重试3次

## 七、常见问题

### 1. Claude改写超时
- 原因：文章太长或网络问题
- 解决：系统会自动跳过，可以单独重新处理

### 2. 图片下载失败  
- 原因：网络问题或图片URL失效
- 解决：系统会重试3次，仍失败则跳过

### 3. 文章未翻译成中文
- 原因：Claude处理异常
- 解决：扫描器会在下次运行时检测并重新处理

## 八、工作流优化特点

1. **并行处理**：同时抓取多篇文章和图片
2. **智能去重**：避免重复处理已有文章
3. **双重验证**：URL去重 + 中文内容验证
4. **自动重试**：图片下载和Claude调用都有重试机制
5. **错误恢复**：单篇失败不影响其他文章处理

---

最后更新：2025-01-10