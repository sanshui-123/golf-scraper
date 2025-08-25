# URL生成统一指南

## 🎯 核心设计哲学
"每一个步骤，只留一个最优方案"

## 📋 统一URL生成流程

### 标准执行命令（推荐）
```bash
# 使用主流程脚本（被start_intelligent_processing.sh调用）
node auto_scrape_three_sites.js --all-sites
```

### 备用执行方案
```bash
# 并行增强版（效率更高，但可能不稳定）
./generate_all_urls_enhanced.sh

# 智能主控制器（有重试和备用URL，但与主流程不兼容）
node intelligent_url_master.js
```

## 🌐 各网站URL生成规则

### 1. **Golf.com**
- **脚本**: `discover_golf_com_24h.js --urls-only`
- **特点**: 扫描多个分类页面
- **备用方案**: 从 `golf_com_all_recent.txt` 读取

### 2. **Golf Monthly**
- **脚本**: `discover_recent_articles.js https://www.golfmonthly.com 100 --ignore-time --urls-only`
- **特点**: 通用脚本效果好，能获取20-50个URL
- **注意**: 不要改用专用脚本

### 3. **MyGolfSpy**
- **脚本**: `mygolfspy_url_generator.js --urls-only`
- **特点**: 增强版抓取器，绕过反爬虫
- **目标**: 80+个URL

### 4. **GolfWRX**
- **脚本**: `golfwrx_rss_url_generator.js 20 --urls-only`（RSS方案）
- **特点**: 使用RSS feed完全绕过Cloudflare保护，稳定可靠
- **技术**: 从多个RSS源获取文章（主feed、新闻、教学、装备）
- **备用URL**: 1个预设URL（RSS完全失败时使用，便于用户发现问题）

### 5. **Golf Digest**
- **脚本**: `golfdigest_fast_url_generator.js 20 --urls-only`（快速版）
- **特点**: 5秒内完成，只扫描主页获取/story/链接
- **优势**: 极简设计，10秒超时，避免了复杂版本的超时问题
- **备用URL**: 1个预设URL（完全失败时使用，便于用户发现问题）

### 6. **Today's Golfer**
- **脚本**: `discover_todays_golfer_articles.js 100 --urls-only`
- **特点**: 专门抓取器，使用Playwright
- **目标**: 10-30个URL

## 🛡️ 备用URL机制

当网站URL生成完全失败（0个URL）时，系统会自动使用备用URL：

```javascript
// 在 auto_scrape_three_sites.js 中配置
const fallbackUrls = {
    'golfwrx.com': [
        'https://www.golfwrx.com/news/spotted-tiger-woods-new-taylormade-prototype/'
    ],
    'golfdigest.com': [
        'https://www.golfdigest.com/story/tiger-woods-pga-tour-future-2025'
    ]
}
```

**设计理念**：只保留1个备用URL，这样当抓取失败时，用户能明显看出问题并及时解决。

## 📁 URL文件命名标准

```
golf.com         → deep_urls_golf_com.txt
golfmonthly.com  → deep_urls_golfmonthly_com.txt
mygolfspy.com    → deep_urls_mygolfspy_com.txt
golfwrx.com      → deep_urls_www_golfwrx_com.txt
golfdigest.com   → deep_urls_www_golfdigest_com.txt
todays-golfer.com → deep_urls_todays_golfer_com.txt
```

## 🔧 问题解决记录

### 1. Golf Digest超时问题
- **原因**: 复杂的discover_golfdigest_articles.js初始化慢，容易超时
- **解决方案**: 创建 `golfdigest_fast_url_generator.js` - 极简快速版
- **效果**: 5秒内完成，10秒超时保护
- **状态**: ✅ 已实施最优方案（2025-08-10）

### 2. GolfWRX Cloudflare问题
- **原因**: 网站有强力的Cloudflare保护，导致抓取超时
- **解决方案**: 创建 `golfwrx_rss_url_generator.js` - RSS方案完全绕过网页抓取
- **效果**: 稳定获取20个最新文章URL
- **状态**: ✅ 已实施最优方案（2025-08-10）

### 3. 备用URL机制
- **需求**: 确保系统不会因0个URL崩溃，同时让用户能发现问题
- **实现**: 在 `auto_scrape_three_sites.js` 中添加fallback机制（只有1个备用URL）
- **状态**: ✅ 已完成（2025-08-10更新为1个备用URL）

## 🚀 最佳实践

1. **优先使用主流程**: `auto_scrape_three_sites.js`
2. **保持向后兼容**: 支持stdout和文件两种URL读取方式
3. **最小保证原则**: 完全失败时使用1个备用URL（便于发现问题）
4. **错误隔离**: 单个网站失败不影响其他网站
5. **简化优先**: 避免过度工程化

## ⚠️ 注意事项

- Golf Digest和GolfWRX可能因为网站保护机制而超时
- 备用URL只有1个，便于用户发现问题并及时解决
- 如果看到某网站只有1个URL，说明该网站的抓取失败了
- 所有URL生成脚本都支持 `--urls-only` 参数
- 并发控制永远不超过2个进程