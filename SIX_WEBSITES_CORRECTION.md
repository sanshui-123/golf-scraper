# 网站数量修正记录

## 修正内容
将系统中所有提到"5个网站"的地方修正为"6个网站"

## 支持的6个网站
1. **Golf.com** - 使用专用脚本 `discover_golf_com_24h.js`
2. **Golf Monthly** - 使用通用脚本 `discover_recent_articles.js` 
3. **MyGolfSpy** - 使用专用脚本 `mygolfspy_enhanced_scraper.js`
4. **GolfWRX** - 使用专用脚本 `process_golfwrx.js`
5. **Golf Digest** - 使用专用脚本 `discover_golfdigest_articles.js`
6. **Today's Golfer** - 使用通用脚本 `discover_recent_articles.js`

## 修改的文件
1. **auto_scrape_three_sites.js**
   - 添加了Today's Golfer配置
   - 更新了注释说明

2. **CLAUDE.md**
   - 所有"5个网站"改为"6个网站"
   - 添加了Today's Golfer的详细配置
   - 更新了URL文件命名规则
   - 更新了处理结果统计部分

3. **website_configs.json**
   - 添加了Today's Golfer的完整配置

## URL文件映射
```
golf.com -> deep_urls_golf_com.txt
golfmonthly.com -> deep_urls_golfmonthly_com.txt  
mygolfspy.com -> deep_urls_mygolfspy_com.txt
golfwrx.com -> deep_urls_www_golfwrx_com.txt
golfdigest.com -> deep_urls_www_golfdigest_com.txt
todays-golfer.com -> deep_urls_todays_golfer_com.txt
```

## 验证
运行以下命令可以验证6个网站都正常工作：
```bash
node auto_scrape_three_sites.js --all-sites
```

修正日期：2025-08-09