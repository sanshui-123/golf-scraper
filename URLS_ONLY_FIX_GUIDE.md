# --urls-only模式统一实现指南

## 问题背景
三个核心网站脚本（MyGolfSpy、GolfWRX、Golf Digest）缺少`--urls-only`参数支持，导致无法快速生成URL文件。

## 修复的脚本文件
1. **process_mygolfspy_rss.js** - RSS抓取脚本
2. **process_golfwrx.js** - GolfWRX处理脚本  
3. **discover_golfdigest_articles.js** - Golf Digest发现脚本

## 统一实现标准

### 核心代码模式
```javascript
// 命令行参数检测
const urlsOnly = args.includes('--urls-only');

if (urlsOnly) {
    // 生成URL文件并退出
    const filename = 'deep_urls_网站域名.txt';
    const urlContent = urls.join('\n') + '\n';
    
    fs.writeFileSync(filename, urlContent, 'utf8');
    console.log(`💾 已生成URL文件: ${filename}`);
    return;
}
```

### 具体实现位置

#### process_mygolfspy_rss.js
- **位置**: 第14-30行，在RSS处理逻辑之前
- **文件名**: `deep_urls_mygolfspy_com.txt`
- **特点**: 支持RSS和hybrid模式

#### process_golfwrx.js  
- **位置**: 第15行和第34-50行，在URL获取后
- **文件名**: `deep_urls_www_golfwrx_com.txt`
- **特点**: 处理Cloudflare保护的URL

#### discover_golfdigest_articles.js
- **位置**: 第463行和第488-504行，在文章发现后
- **文件名**: `deep_urls_www_golfdigest_com.txt`
- **特点**: 基于浏览器自动化抓取

## 验证结果
```bash
# 修复前：3个网站无法生成URL文件
# 修复后：所有网站正常工作
✅ Golf.com: 6 URLs
✅ Golf Monthly: 19 URLs  
✅ MyGolfSpy: 5 URLs (修复)
✅ GolfWRX: 5 URLs (修复)
✅ Golf Digest: 5 URLs (修复)
```

## Golf Digest特殊优化 (2025-08-01)

### 进程卡死问题
**问题**: Golf Digest在--urls-only模式下浏览器资源清理不完整，导致进程超时卡死

**解决方案**: 强制资源管理机制
```javascript
// 添加的关键功能
class GolfDigestArticleDiscoverer {
    constructor() {
        this.forceCleanupTimer = null;
        this.isUrlsOnlyMode = false;
    }
    
    async init() {
        // 模式感知的超时控制
        const timeoutDuration = this.isUrlsOnlyMode ? 3 * 60 * 1000 : 10 * 60 * 1000;
        this.forceCleanupTimer = setTimeout(async () => {
            await this.forceCleanup('timeout');
            process.exit(0);
        }, timeoutDuration);
    }
    
    async forceCleanup(reason = 'normal') {
        // 并行资源清理 + 超时保护
        await Promise.race([
            Promise.all(cleanupPromises),
            new Promise((_, reject) => setTimeout(() => reject(new Error('清理超时')), 10000))
        ]);
    }
}
```

### 修复效果
- **修复前**: 进程卡死，2分钟超时强制终止
- **修复后**: 正常完成，175秒内完成URL发现
- **资源管理**: 完整的浏览器清理机制
- **模式感知**: URLs-only和完整模式不同的超时策略

## 架构改进
- **统一接口**: 所有脚本支持相同命令行参数
- **模块化设计**: URL生成与文章处理分离
- **系统兼容性**: 与批处理系统无缝集成
- **维护性**: 标准化实现便于扩展
- **资源管理**: 统一的超时和强制清理机制