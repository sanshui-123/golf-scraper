# 高尔夫内容系统日常使用指南

## 每日工作流程

### 1. 运行每日抓取（推荐时间：每天上午10点后）
```bash
node run_daily_golf_extraction.js
```

这个命令会：
- ✅ 自动抓取北京时间昨天10点到今天10点的所有文章
- ✅ 下载文章中的所有图片（无数量限制）
- ✅ 使用Claude AI改写成适合中国读者的内容
- ✅ 保存每篇文章的原文链接
- ✅ 生成微信公众号格式

### 2. 查看和管理内容
```bash
# 启动内容管理系统（如果还没启动）
node golf_content_manager_enhanced.js

# 然后访问
http://localhost:3000
```

### 3. 发布到微信公众号

1. 在内容管理系统中找到今天的文章
2. 点击进入文章详情页
3. 点击图片即可复制（会有绿色提示"图片已复制到剪贴板"）
4. 复制文字内容
5. 粘贴到微信公众号编辑器

## 问题处理

### 如果遇到"内容提取失败"的文章
```bash
# 运行修复工具
node fix_all_content_issues.js fix-date 2025-07-08
```

### 如果图片显示有问题
```bash
# 检查图片目录
ls golf_content/2025-07-08/images/

# 运行图片修复
node fix_content_manager_images.js fix-date 2025-07-08
```

### 如果需要重新抓取某个URL
```bash
# 使用单篇文章处理工具
node process_single_article.js https://www.golfmonthly.com/news/xxx
```

## 文件说明

### 核心程序
- `run_daily_golf_extraction.js` - 每日抓取主程序
- `golf_content_manager_enhanced.js` - 内容管理系统
- `enhanced_golf_extractor_with_urls.js` - 增强版抓取器（带URL记录）

### 修复工具
- `fix_all_content_issues.js` - 综合问题修复工具
- `fix_content_manager_images.js` - 图片路径修复工具

### 生成的内容位置
```
golf_content/
└── 2025-07-08/                    # 日期目录
    ├── images/                     # 所有图片
    │   ├── article_1_img_1.jpg
    │   ├── article_1_img_2.jpg
    │   └── ...
    ├── wechat_ready/              # 微信格式文章
    │   ├── wechat_article_01.md
    │   ├── wechat_article_02.md
    │   └── ...
    └── article_urls.json          # 原文链接映射
```

## 注意事项

1. **Claude API限制**
   - 如果Claude改写失败，程序会使用原文继续
   - 注意API调用次数限制

2. **网络要求**
   - 需要稳定的网络连接
   - 如果抓取中断，可以重新运行

3. **时间范围**
   - 程序自动计算北京时间昨天10点到今天10点
   - 建议每天上午10点后运行，确保获取最新内容

4. **图片处理**
   - 所有图片自动下载到本地
   - 支持点击复制功能
   - 图片较多时注意硬盘空间

## 常见问题

**Q: 为什么有些文章没有原文链接？**
A: 早期抓取的文章可能没有保存URL，新版程序已经修复这个问题。

**Q: 图片复制功能不工作？**
A: 确保使用Chrome/Edge等现代浏览器，Safari可能有兼容性问题。

**Q: 如何只抓取特定网站的文章？**
A: 目前只支持Golf Monthly，未来会添加更多源。

**Q: 可以修改Claude的改写风格吗？**
A: 可以编辑 `claude_rewriter_optimized.js` 中的提示词。