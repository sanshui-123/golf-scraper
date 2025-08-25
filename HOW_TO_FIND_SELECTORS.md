# 🔍 如何快速找到网站选择器

## 🛠️ 使用Chrome开发者工具

### 1. 打开网站并右键检查
1. 访问目标网站首页
2. 右键点击文章标题 → 选择"检查"
3. 开发者工具会高亮显示对应HTML元素

### 2. 查找文章列表容器
```html
<!-- 常见的文章容器结构 -->
<div class="article-list">
  <article class="article-item">...</article>
  <article class="article-item">...</article>
</div>

<!-- 选择器应该是: .article-item -->
```

### 3. 查找关键元素

#### 🔗 链接选择器
```html
<article class="post-card">
  <a href="/news/golf-championship-2025">...</a>
</article>
<!-- 选择器: a[href] -->
```

#### 📝 标题选择器
```html
<h2 class="post-title">Golf Championship 2025</h2>
<!-- 选择器: h2.post-title 或 h2 -->
```

#### ⏰ 时间选择器
```html
<time datetime="2025-01-15">Jan 15, 2025</time>
<span class="publish-date">2 hours ago</span>
<!-- 选择器: time[datetime], .publish-date -->
```

## 📋 快速检查清单

### 首页文章列表
1. **找容器**: 包含多个文章的外层元素
2. **找链接**: 每篇文章的链接元素
3. **找标题**: 文章标题文本
4. **找时间**: 发布时间信息

### 文章详情页
1. **找标题**: 通常是 `<h1>` 标签
2. **找正文**: 包含所有段落的容器
3. **找图片**: 正文中的 `<img>` 标签
4. **找干扰**: 广告、推荐、评论等需要移除的元素

## 🎯 实用技巧

### 1. 使用控制台测试选择器
```javascript
// 在控制台测试选择器是否正确
document.querySelectorAll('.article-item').length  // 应该返回多个
document.querySelector('h1.article-title')          // 应该返回标题元素
```

### 2. 优先级规则
```
最优: .specific-class (类名)
次优: article[data-type="post"] (属性)
再次: div > h2 (层级关系)
避免: div:nth-child(3) (位置相关)
```

### 3. 常见选择器模式

#### 文章容器
- `.article-item`
- `.post-card`
- `.story-item`
- `article`
- `[data-testid="article"]`

#### 时间元素
- `time[datetime]`
- `.publish-date`
- `.timestamp`
- `.date`
- `[data-published]`

#### 图片元素
- `.article-content img`
- `figure img`
- `.wp-block-image img`
- `picture img`

## ⚠️ 注意事项

1. **动态加载**: 有些网站内容是JavaScript渲染的，需要等待加载
2. **响应式设计**: 移动端和桌面端可能使用不同的HTML结构
3. **A/B测试**: 网站可能对不同用户显示不同的页面结构
4. **更新频繁**: 大网站可能经常更新页面结构，选择器需要定期维护

## 🔧 调试命令

### 测试URL抓取
```bash
# 只抓取URL，快速测试选择器
node discover_recent_articles.js https://www.example.com 10 --urls-only
```

### 测试文章处理
```bash
# 处理单篇文章，查看内容抓取效果
node simple_process_article.js https://www.example.com/article-url
```

### 查看抓取结果
```bash
# 检查生成的文件
cat deep_urls_example_com.txt
cat golf_content/$(date +%Y-%m-%d)/wechat_ready/wechat_article_01.md
```

## 💡 快速模板

复制以下代码到控制台，快速获取网站结构：

```javascript
// 快速分析网站结构
console.log('=== 网站结构分析 ===');
console.log('文章容器:', document.querySelector('article, .article, .post')?.className);
console.log('标题元素:', document.querySelector('h1')?.className);
console.log('时间元素:', document.querySelector('time, .date, .publish')?.className);
console.log('图片数量:', document.querySelectorAll('article img, .content img').length);
console.log('需要移除:', Array.from(document.querySelectorAll('.ad, .social, .related')).map(e => e.className));
```

---

**提示**: 熟练使用Chrome开发者工具是快速配置新网站的关键！