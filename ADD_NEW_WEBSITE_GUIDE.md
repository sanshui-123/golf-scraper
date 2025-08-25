# 🚀 新增网站标准化操作指南

## 📋 核心原则
遵循系统核心设计哲学："**只留一个最优方案，不需要其他的备选方案**"

### ✅ 可以优化的部分（根据网站特性）
- ✅ **URL抓取规则**：可以创建网站特定的抓取逻辑
- ✅ **文章内容抓取**：可以优化选择器和处理方式
- ✅ **特殊处理器**：可以在 `site_specific_scrapers.js` 添加专门逻辑

### ❌ 不能修改的核心部分
- ❌ **URL筛选逻辑**：保持 `unified_history_database.js` 不变
- ❌ **文章改写逻辑**：保持 `article_rewriter_enhanced.js` 不变
- ❌ **批处理流程**：保持 `batch_process_articles.js` 核心流程不变

## 🔧 标准添加流程（4个步骤 + 可选优化）

### 步骤1️⃣：更新网站配置文件 `website_configs.json`

添加新网站配置模板：
```json
"newsite.com": {
    "name": "网站名称",
    "homepage": "https://www.newsite.com/",
    "articleListSelectors": {
        "container": ".article-item, .post-item",  // 文章容器选择器
        "link": "a[href]",                         // 链接选择器
        "title": "h2, h3, .title",                 // 标题选择器
        "time": "time, .date",                     // 时间选择器
        "timeAttribute": "datetime"                // 时间属性
    },
    "articlePatterns": [                           // URL模式
        "/news/",
        "/articles/",
        "/posts/"
    ],
    "selectors": {
        "title": "h1.article-title, h1",           // 正文标题
        "article": "article, .article-content",     // 文章容器
        "content": ".article-body, .content",       // 内容区域
        "paragraphs": ".article-body p",           // 段落
        "images": ".article-body img"              // 图片
    },
    "removeSelectors": [                           // 需要移除的元素
        ".advertisement",
        ".social-share",
        ".related-posts",
        "script",
        "style"
    ],
    "waitForSelector": ".article-content",         // 等待加载的选择器
    "timeout": 30000                               // 超时时间
}
```

### 步骤2️⃣：更新URL数量限制 `intelligent_url_master.js`

在第35-41行的 `defaultLimits` 中添加：
```javascript
defaultLimits: {
    'golf.com': 40,
    'golfmonthly.com': 35,
    'mygolfspy.com': 25,
    'golfwrx.com': 20,
    'golfdigest.com': 35,
    'newsite.com': 20  // 新增网站，建议初始值15-25
}
```

### 步骤3️⃣：更新时间过滤配置 `optimized_time_filter.js`

在第200-226行的 `getWebsiteSpecificWindow` 方法中添加：
```javascript
'newsite.com': { 
    normal: 6,      // 正常时间窗口（小时）
    highFreq: 3,    // 高频时间窗口（小时）
    reason: '网站更新频率说明' 
}
```

### 步骤4️⃣：添加网站处理器 `website_handler_factory.js`

在第290-310行附近，创建新的处理器类并注册：

```javascript
// 新网站处理器
class NewSiteHandler extends BaseWebsiteHandler {
    constructor() {
        super('newsite.com', {
            script: 'discover_recent_articles.js',
            expectedUrls: 20
        });
    }

    async extractUrls(limit = 20) {
        try {
            const result = await this.executeScript(this.config.script, [
                'https://www.newsite.com/',
                String(limit),
                '--urls-only'
            ]);
            
            const urlFile = 'deep_urls_newsite_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                console.log(`✅ NewSite: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            }
            return [];
        } catch (error) {
            console.error(`❌ NewSite URL提取失败: ${error.message}`);
            return [];
        }
    }
}

// 在 WebsiteHandlerFactory 的 handlers 中注册
this.handlers = {
    'golf.com': new GolfComHandler(),
    'golfmonthly.com': new GolfMonthlyHandler(),
    'mygolfspy.com': new MyGolfSpyHandler(),
    'golfwrx.com': new GolfWRXHandler(),
    'golfdigest.com': new GolfDigestHandler(),
    'newsite.com': new NewSiteHandler()  // 新增
};
```

## ✅ 验证检查清单

### 1. 测试URL抓取
```bash
node discover_recent_articles.js https://www.newsite.com 20 --urls-only
```

### 2. 测试单篇文章处理
```bash
node simple_process_article.js https://www.newsite.com/article-url
```

### 3. 运行完整系统
```bash
node smart_startup.js
```

### 4. 检查Web界面
访问 http://localhost:8080 确认新网站显示正常

## ⚠️ 注意事项

### 图片处理规则
- ✅ **保留**：文章正文中的图片（通常在 content/article-body 区域内）
- ❌ **过滤**：缩略图、logo、广告图片、相关文章图片
- ❌ **过滤**：通过 `removeSelectors` 自动移除不需要的区域

### 内容抓取规则
- ✅ **保留**：正文段落、标题、作者信息、发布时间
- ❌ **过滤**：评论、广告、相关推荐、社交分享按钮
- ❌ **过滤**：导航栏、页脚、侧边栏

## 🎯 最佳实践

1. **选择器优先级**：
   - 优先使用class选择器（更稳定）
   - 其次使用标签+属性组合
   - 避免使用过于具体的选择器

2. **超时配置**：
   - 普通网站：30秒
   - 有CDN/Cloudflare：45-60秒
   - 内容较多：可适当增加

3. **URL数量**：
   - 初始建议：15-25个
   - 观察处理效果后调整
   - 避免一开始设置过高

4. **时间窗口**：
   - 更新频繁的网站：4-6小时
   - 更新较慢的网站：8-12小时
   - 根据实际情况调整

## 🆘 常见问题

### Q: 选择器找不到内容？
A: 使用Chrome开发者工具检查页面结构，更新选择器

### Q: 抓取超时？
A: 增加timeout配置，检查网站是否有反爬措施

### Q: 图片没有抓取到？
A: 检查images选择器，确保涵盖了正文图片

### Q: 重复内容太多？
A: 调整时间窗口配置，减少URL数量

## 📝 完整示例

假设要添加 "golfweek.com"：

1. **website_configs.json**:
```json
"golfweek.com": {
    "name": "Golf Week",
    "homepage": "https://www.golfweek.com/",
    "articleListSelectors": {
        "container": ".article-card, .story-item",
        "link": "a[href]",
        "title": "h2, h3, .headline",
        "time": "time[datetime], .publish-date",
        "timeAttribute": "datetime"
    },
    "articlePatterns": ["/story/", "/news/", "/tours/"],
    "selectors": {
        "title": "h1.article-headline, h1",
        "article": "article, .article-wrapper",
        "content": ".article-content, .story-body",
        "paragraphs": ".article-content p",
        "images": ".article-content img"
    },
    "removeSelectors": [".ad", ".newsletter", "aside"],
    "waitForSelector": ".article-content",
    "timeout": 30000
}
```

2. 更新其他3个文件的相应部分

3. 测试验证

4. 提交运行

---

## 🎯 可选优化步骤

### 步骤5️⃣（可选）：添加网站特定抓取器 `site_specific_scrapers.js`

当通用抓取无法满足需求时，可以添加特定抓取逻辑：

```javascript
// 在 scrapers 对象中添加
'newsite.com': this.scrapeNewSite.bind(this),

// 添加特定抓取方法
async scrapeNewSite(page) {
    const articles = await page.evaluate(() => {
        const articleData = [];
        
        // 网站特定的复杂抓取逻辑
        const containers = document.querySelectorAll('.custom-article-wrapper');
        
        containers.forEach(container => {
            // 自定义提取逻辑
            const url = container.querySelector('a.article-link')?.href;
            const title = container.querySelector('.article-title')?.textContent;
            const publishTime = container.getAttribute('data-publish-time');
            
            if (url && title) {
                articleData.push({ url, title, publishTime });
            }
        });
        
        return articleData;
    });
    
    return articles;
}
```

### 步骤6️⃣（可选）：创建专门的URL发现脚本

对于特别复杂的网站，可以创建独立的发现脚本：

```javascript
// discover_newsite_articles.js
// 专门处理特殊的抓取逻辑，比如需要登录、API调用等
```

---

**💡 提示**：
- 基础配置（步骤1-4）适用于90%的网站
- 只有在基础配置无法满足时才使用可选优化
- URL筛选和文章改写逻辑始终保持不变，确保系统稳定性