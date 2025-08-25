# 🔒 抓取规则稳定配置 - 请勿修改！

## ⚠️ 重要警告
**本文档记录的配置已经过反复调试和优化，请勿随意修改！**

## 📅 修复记录
**修复日期**: 2025-08-06
**修复内容**: Golf Monthly抓取和MyGolfSpy重复问题

---

## 🛠️ 关键配置文件

### 1. `optimized_time_filter.js` - 时间窗口配置 🔒
**备份文件**: `STABLE_optimized_time_filter.js`

#### 关键配置 (第206-226行) - 请勿修改
```javascript
const websiteConfig = {
    'golf.com': { 
        normal: 4, 
        highFreq: 2, 
        reason: 'Golf.com更新较频繁' 
    },
    'golfmonthly.com': { 
        normal: 18,          // 修复: 从8小时增加到18小时
        highFreq: 12,        // 修复: 从4小时增加到12小时
        reason: 'Golf Monthly更新很慢，需要更大窗口' 
    },
    'mygolfspy.com': { 
        normal: 6, 
        highFreq: 3, 
        reason: 'MyGolfSpy中等更新频率' 
    },
    'golfwrx.com': { 
        normal: 4, 
        highFreq: 2, 
        reason: 'GolfWRX论坛型网站更新频繁' 
    },
    'golfdigest.com': { 
        normal: 6, 
        highFreq: 3, 
        reason: 'Golf Digest专业媒体中等频率' 
    }
};
```

#### 关键算法修复 (第81-85行) - 请勿修改
```javascript
// 修复: 移除基于运行间隔的窗口缩短逻辑
windowHours = Math.max(
    this.options.minimumWindowHours,
    highFreqHours  // 直接使用网站特定高频配置
);
```

### 2. `discover_recent_articles.js` - 域名传递逻辑 🔒
**备份文件**: `STABLE_discover_recent_articles.js`

#### 关键修复 (第707-710行) - 请勿修改
```javascript
// 修复: 添加域名传递，确保网站特定配置生效
const urlObj = new URL(homepageUrl);
const websiteDomain = urlObj.hostname;
const timeFilter = new OptimizedTimeFilter({ websiteDomain });
```

---

## 🎯 修复效果验证

### Golf Monthly ✅
- **修复前**: 0个URL (时间窗口过小)
- **修复后**: 4个有效URL
- **测试命令**: `node discover_recent_articles.js https://www.golfmonthly.com 20 --urls-only`

### MyGolfSpy ℹ️
- **现状**: RSS限制返回10篇固定文章 (已知限制)
- **文档**: `MYGOLFSPY_RSS_LIMITATION.md`
- **解决方案**: 分时段运行或结合其他网站

---

## 🚨 系统稳定性保证

### 配置锁定机制
1. **备份文件**: 已创建 `STABLE_*` 版本
2. **文档记录**: 详细记录每个配置的原因
3. **测试验证**: 所有修改都经过实际测试

### 禁止修改的核心配置
- ✅ Golf Monthly: 18小时/12小时 (解决更新慢问题)
- ✅ 时间窗口算法: 直接使用网站配置 (避免过度缩短)
- ✅ 域名传递逻辑: 确保网站特定配置生效

---

## 🎯 修复优先级指导原则

### ⚠️ **重要：未来修复问题时的策略**

**第一优先级**: 保持现有抓取规则不变
- 每个网站的抓取规则已经过反复调试优化
- **不要**因为其他问题而修改URL抓取配置
- **不要**重复修改时间窗口和域名传递逻辑

**第二优先级**: 通过其他方式解决问题
- 优化文章处理逻辑
- 调整并发和超时设置
- 修改内容转换和重写逻辑
- 改进错误处理和重试机制

**避免浪费时间**: 
- 不要重复调试已经稳定的抓取规则
- 先检查是否是处理环节的问题
- 优先考虑非抓取相关的解决方案

---

## 📋 维护建议

### ✅ 允许的操作
- 添加新网站配置
- 调整处理并发数
- 优化网络超时设置
- 更新文章内容处理逻辑

### ❌ 禁止的操作
- 修改现有网站的时间窗口配置
- 更改时间窗口计算算法  
- 移除域名传递逻辑
- 调整高频模式判定逻辑

---

**🔐 请严格遵守以上配置锁定规则，确保系统长期稳定运行！**