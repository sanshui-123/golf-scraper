#!/bin/bash
# 生成所有网站的URL文件脚本

echo "=== 开始生成所有网站的URL文件 ==="
echo ""

# Golf.com
echo "1. Golf.com..."
node discover_golf_com_24h.js --urls-only > deep_urls_golf_com.txt 2>&1
echo "✅ Golf.com: $(grep -c "^https://" deep_urls_golf_com.txt 2>/dev/null || echo 0) 个URL"

# Golf Monthly
echo "2. Golf Monthly..."
node discover_recent_articles.js https://www.golfmonthly.com 50 --urls-only > deep_urls_golfmonthly_com.txt 2>&1
echo "✅ Golf Monthly: $(grep -c "^https://" deep_urls_golfmonthly_com.txt 2>/dev/null || echo 0) 个URL"

# MyGolfSpy - 需要特殊处理
echo "3. MyGolfSpy..."
echo "https://mygolfspy.com/news/srixon-expands-soft-feel-family-with-soft-feel-brite/" > deep_urls_mygolfspy_com.txt
echo "https://mygolfspy.com/news/pxg-black-ops-driver-woods-hybrids/" >> deep_urls_mygolfspy_com.txt
echo "https://mygolfspy.com/news/jon-rahm-switches-to-mallet-putter/" >> deep_urls_mygolfspy_com.txt
echo "https://mygolfspy.com/news/tiger-woods-continues-to-recover/" >> deep_urls_mygolfspy_com.txt
echo "https://mygolfspy.com/news/cleveland-rtx-6-zipcore-wedges/" >> deep_urls_mygolfspy_com.txt
echo "✅ MyGolfSpy: 5 个URL（手动添加）"

# GolfWRX
echo "4. GolfWRX..."
node process_golfwrx.js process 50 --urls-only > deep_urls_www_golfwrx_com.txt 2>&1
echo "✅ GolfWRX: $(grep -c "^https://" deep_urls_www_golfwrx_com.txt 2>/dev/null || echo 0) 个URL"

# Golf Digest
echo "5. Golf Digest..."
node discover_golfdigest_articles.js 50 --urls-only > deep_urls_www_golfdigest_com.txt 2>&1
echo "✅ Golf Digest: $(grep -c "^https://" deep_urls_www_golfdigest_com.txt 2>/dev/null || echo 0) 个URL"

# Today's Golfer
echo "6. Today's Golfer..."
node discover_recent_articles.js https://www.todays-golfer.com/news/ 50 --urls-only > deep_urls_todays_golfer_com.txt 2>&1
echo "✅ Today's Golfer: $(grep -c "^https://" deep_urls_todays_golfer_com.txt 2>/dev/null || echo 0) 个URL"

echo ""
echo "=== 生成完成 ==="
echo "总URL数: $(cat deep_urls_*.txt 2>/dev/null | grep -c "^https://")"