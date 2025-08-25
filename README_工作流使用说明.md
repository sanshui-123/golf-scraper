# 🏌️ 每日高尔夫内容提取工作流

## 📋 概述

这是一个自动化的每日高尔夫内容提取工作流，可以：
- 🌐 自动抓取 Golf Monthly 网站最新内容
- 📁 按日期自动组织文件夹结构  
- 📷 自动下载并保存相关图片
- 📝 生成结构化内容报告
- 🚀 一键同步到飞书文档

## 🛠️ 安装和设置

### 1. 环境要求
- Node.js 18+ 
- Playwright (已包含在依赖中)
- 稳定的网络连接

### 2. 安装依赖
```bash
npm install
```

### 3. 浏览器驱动安装  
```bash
npx playwright install
```

## 🚀 快速开始

### 方式一：使用 npm 脚本（推荐）
```bash
# 运行每日提取工作流
npm run extract

# 查看帮助信息
npm run help

# 清理所有数据
npm run clean
```

### 方式二：直接运行
```bash
# 运行完整工作流
node daily_golf_content_extraction.js

# 运行快速脚本
node run_daily_extraction.js

# 测试抓取功能
node golf_monthly_advanced.js
```

## 📁 输出目录结构

```
~/golf_content/
├── 2025-07-04/                    # 按日期组织
│   ├── articles/                   # 文章内容
│   │   ├── article_001.md         # 单篇文章（Markdown格式）
│   │   ├── article_002.md
│   │   └── ...
│   ├── images/                     # 图片素材
│   │   ├── img_001.jpg            # 自动下载的图片
│   │   ├── img_002.jpg
│   │   └── ...
│   ├── daily_summary.md           # 每日总结报告
│   ├── content_for_rewrite.json   # 用于改写的结构化数据
│   └── feishu_content.md          # 飞书文档内容备份
├── 2025-07-05/
└── ...
```

## 📝 文件说明

### `daily_summary.md`
- 📊 内容分类统计
- 📰 文章列表概览
- 🔄 后续处理建议

### `content_for_rewrite.json`
```json
{
  "extractionDate": "2025-07-04",
  "totalArticles": 9,
  "articles": [
    {
      "id": "article_001",
      "originalTitle": "Best Golf Drivers 2025",
      "suggestedTitle": "2025年最佳高尔夫球杆推荐",
      "category": "装备评测",
      "keywords": ["golf", "driver", "equipment"],
      "rewriteStatus": "pending"
    }
  ]
}
```

### `article_xxx.md` 
每篇文章包含：
- 📝 标题和发布时间
- 🔗 原文链接
- 📷 本地图片路径
- 📄 文章摘要
- 🔧 原始数据（JSON格式）

## 🚀 飞书文档同步

### 自动同步流程：
1. 🌐 自动打开飞书网页版
2. ⏳ 等待用户登录确认
3. 📄 自动创建新文档
4. 📝 填入结构化内容
5. 💾 自动保存文档

### 手动同步（备用）：
如果自动同步失败，会生成 `feishu_content.md` 文件，可手动复制到飞书。

## 🔧 自定义配置

### 修改抓取源
编辑 `daily_golf_content_extraction.js` 中的 `extractGolfMonthlyContent()` 方法：

```javascript
// 修改目标网站
await this.page.goto('https://your-target-site.com/');

// 修改文章筛选条件  
const articleLinks = Array.from(links).filter(link => {
    const href = link.href;
    return href && href.includes('/your-path/');
});
```

### 调整时间筛选
在 `filterRecentArticles()` 方法中修改：

```javascript
// 添加更多时间模式
const isRecent = 
    timeText.includes('today') ||
    timeText.includes('yesterday') ||
    timeText.includes('hours ago') ||
    // 添加自定义模式
    timeText.includes('刚刚') ||
    timeText.includes('分钟前');
```

## 🎯 使用场景

### 1. 内容创作者
- 📰 每日获取行业最新资讯
- 🔄 结构化数据便于改写
- 📷 自动下载图片素材

### 2. 自媒体运营
- 📅 按日期组织内容库
- 🚀 一键同步到协作平台
- 📊 自动生成内容分析

### 3. 研究分析
- 📈 跟踪行业趋势
- 🔍 关键词自动提取
- 📋 结构化数据导出

## ⚡ 高级功能

### 批量处理
```bash
# 连续运行多天
for i in {1..7}; do
  npm run extract
  sleep 3600  # 等待1小时
done
```

### 定时任务
使用 crontab 设置定时运行：
```bash
# 每天早上8点运行
0 8 * * * cd /path/to/project && npm run extract
```

### 数据清理
```bash
# 清理7天前的数据
npm run clean
```

## 🐛 故障排除

### 常见问题

1. **网络连接超时**
   ```
   解决：检查网络连接，可能需要配置代理
   ```

2. **浏览器启动失败**
   ```bash
   # 重新安装浏览器驱动
   npx playwright install --force
   ```

3. **飞书同步失败**
   ```
   解决：检查登录状态，手动复制 feishu_content.md 内容
   ```

4. **图片下载失败**
   ```
   解决：检查图片URL有效性，部分图片可能有防盗链
   ```

### 调试模式
```bash
# 显示浏览器界面进行调试
node daily_golf_content_extraction.js
```

## 📚 扩展开发

### 添加新的内容源
1. 继承 `DailyGolfContentExtractor` 类
2. 重写 `extractGolfMonthlyContent()` 方法
3. 调整筛选和处理逻辑

### 集成其他平台
1. 在 `syncToFeishu()` 基础上扩展
2. 添加微信、钉钉等平台支持
3. 实现多平台同步

## 🔮 更新日志

### v1.0.0 (2025-07-04)
- ✅ 初始版本发布
- ✅ Golf Monthly 内容抓取
- ✅ 飞书文档同步
- ✅ 结构化文件组织
- ✅ 图片自动下载

## 📞 技术支持

如遇问题，请检查：
1. 🌐 网络连接状态
2. 🔧 Node.js 版本 (需要 18+)
3. 🎭 Playwright 安装完整性
4. 📁 文件权限设置

---
*🤖 由 Playwright MCP 强力驱动，让内容提取变得简单高效！* 