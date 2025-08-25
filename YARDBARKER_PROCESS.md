# Yardbarker Golf 处理流程文档

## 概述
Yardbarker Golf是第13个集成的高尔夫网站，提供综合性高尔夫内容（新闻、分析、教学）。

## 网站特性
- **内容类型**：新闻、分析文章、教学内容
- **JavaScript渲染**：需要等待页面完全加载
- **懒加载**：滚动加载更多内容
- **外部链接**：部分文章是外部网站链接（需过滤）
- **时间显示**：相对时间（如"38 sec"、"24 hours ago"）

## 技术方案

### URL发现策略
1. **主页面抓取**：https://www.yardbarker.com/golf
2. **滚动加载**：最多滚动8次或点击"Load More"
3. **链接过滤**：
   - 必须包含 `/golf/articles/`
   - 排除 `/quiz`、`/video/`、`/gallery/`
   - 排除标题包含"quiz"的文章

### 选择器配置
```javascript
{
    articleLinks: 'a[href*="/golf/articles/"]',
    timeInfo: '.trending_time',
    articleTitle: '.art_headline h1',
    articleBody: '.art_body',
    excludeElements: ['.ad-container', '.related-articles', '.video-player']
}
```

## 使用方法

### 单独运行
```bash
node discover_yardbarker_articles.js 50 --urls-only
```

### 批量处理（13个网站）
```bash
node auto_scrape_three_sites.js --all-sites
```

## 配置文件

### URL文件
- 输出文件：`deep_urls_yardbarker_com.txt`
- 文件格式：每行一个URL

## 特殊处理

### 外部链接识别
```javascript
// 检查是否有rel="nofollow"的外部链接
const isExternal = await page.$eval('a[rel="nofollow"]', 
    el => el && !el.href.includes('yardbarker.com')
);
```

### 内容长度验证
- 最小内容长度：500字符
- 过滤视频为主的文章

### 时间排序
- 按相对时间排序（sec < min < hour < day）
- 最新文章优先

## 常见问题

### 1. 外部链接文章
- **问题**：部分文章链接到外部网站
- **解决**：检查`rel="nofollow"`属性并验证域名

### 2. 视频文章
- **问题**：视频内容文字很少
- **解决**：设置最小内容长度阈值（500字符）

### 3. 测验文章
- **问题**：Quiz类型文章不是新闻
- **解决**：URL和标题过滤包含"quiz"的内容

## 性能优化

### 滚动策略
- 最多滚动8次
- 检测到足够文章时提前退出
- 监测页面高度变化

### 批量验证
- 仅在非`--urls-only`模式下验证
- 验证前5篇文章作为样本

## 监控建议

### 质量指标
- 外部链接比例应低于20%
- 有效文章率应高于80%
- 平均内容长度应大于1000字符

### 定期检查
- URL模式是否变化
- 选择器是否失效
- 时间信息格式是否更新

## 维护说明

### 更新选择器
如网站改版，需要更新：
1. 文章链接选择器
2. 时间信息选择器
3. 内容区域选择器

### 调整过滤规则
根据实际情况调整：
1. 最小内容长度
2. URL过滤模式
3. 标题过滤关键词

---
更新日期：2025-08-19
网站编号：第13个高尔夫网站