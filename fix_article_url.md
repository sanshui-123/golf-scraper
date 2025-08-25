# 文章原文链接修复指南

## 问题描述
部分文章在处理后显示"原文URL未提供"，但实际上article_urls.json中有正确的URL记录。

## 问题根源分析
1. 文章抓取时，某些情况下article.url可能是undefined或"原文URL未提供"
2. 但URL映射文件(article_urls.json)中保存了正确的URL
3. 这导致生成的markdown和HTML文件中原文链接错误

## 解决方案

### 1. 立即修复（已实现）
使用`fix_article_url.js`脚本修复现有文章：

```bash
# 修复所有有问题的文章
node fix_article_url.js

# 修复指定文章
node fix_article_url.js 10003
```

### 2. 预防措施（建议）
在`batch_process_articles.js`中添加URL验证：

```javascript
// 在保存文章前验证URL
if (\!article.url || article.url === 'undefined' || article.url === '原文URL未提供') {
    // 从URL映射中获取正确的URL
    const urlMapping = this.getUrlMapping();
    if (urlMapping[articleNum] && urlMapping[articleNum].url) {
        article.url = urlMapping[articleNum].url;
        console.log(`✅ 从URL映射中恢复了文章${articleNum}的URL`);
    } else {
        console.error(`❌ 文章${articleNum}缺少URL信息`);
    }
}
```

## 使用场景
- 当Web界面显示"暂无原文链接"时
- 当markdown/HTML文件中包含"原文URL未提供"时
- 批量检查和修复所有文章的URL问题

## 核心设计哲学
"每一个步骤，只留一个最优方案" - 使用统一的修复脚本解决所有URL问题。
EOF < /dev/null