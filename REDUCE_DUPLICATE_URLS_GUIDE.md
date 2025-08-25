# 减少重复URL抓取改进方案

## 问题分析

### 当前情况
- 总共抓取70个URL
- 昨天已处理41篇，今天只新增1篇
- 重复率高达94%（66/70）

### 重复原因
1. **Golf Monthly和Golf Digest使用了`--ignore-time`参数**
   - 抓取所有文章而非最近24小时
   - 这两个网站贡献了33篇文章（47%）

2. **其他网站缺乏严格时间过滤**
   - MyGolfSpy、GolfWRX、Today's Golfer只限制数量，不限制时间
   - 可能包含前几天的文章

## 已实施的改进

### 1. 修改auto_scrape_three_sites.js配置
- **Golf Monthly**: 移除`--ignore-time`参数
- **Golf Digest**: 移除`--ignore-time`参数

### 2. 修改后的配置
```javascript
'golfmonthly.com': {
    name: 'Golf Monthly',
    script: 'discover_recent_articles.js',
    args: ['https://www.golfmonthly.com', '20', '--urls-only']  // 移除--ignore-time
},
'golfdigest.com': {
    name: 'Golf Digest',
    script: 'discover_golfdigest_articles.js',
    args: ['20', '--urls-only']  // 移除--ignore-time
}
```

## 预期效果
- Golf Monthly：从28篇降至5-10篇（只抓24小时内）
- Golf Digest：从5篇降至1-3篇（只抓最近文章）
- 总体重复率：从94%降至30-50%

## 进一步优化建议

### 1. 为其他网站添加时间过滤
- MyGolfSpy：添加24小时过滤逻辑
- GolfWRX：添加时间参数支持
- Today's Golfer：实现时间过滤功能

### 2. 统一时间过滤标准
- 所有网站默认只抓取24小时内文章
- 需要历史文章时才使用`--ignore-time`参数

### 3. 智能去重机制
- 在URL生成阶段就检查历史记录
- 避免生成已处理过的URL

## 使用说明
改进后的配置已经生效，下次运行程序时：
```bash
node auto_scrape_three_sites.js --all-sites
```
将会看到明显减少的重复URL。