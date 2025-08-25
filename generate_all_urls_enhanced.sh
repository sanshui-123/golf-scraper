#!/bin/bash
# 增强版URL生成脚本 - 获取更多URL

echo "=== 🚀 增强版URL生成开始 ==="
echo "目标：每个网站获取尽可能多的URL"
echo ""

# 1. Golf.com - 增加抓取范围
echo "1. Golf.com (目标: 50+ URLs)..."
node discover_golf_com_24h.js --urls-only > deep_urls_golf_com.txt 2>&1
echo "✅ Golf.com: $(grep -c "^https://" deep_urls_golf_com.txt 2>/dev/null || echo 0) 个URL"

# 2. Golf Monthly - 忽略时间限制
echo ""
echo "2. Golf Monthly (目标: 50+ URLs)..."
node discover_recent_articles.js https://www.golfmonthly.com 100 --ignore-time --urls-only > deep_urls_golfmonthly_com.txt 2>&1
echo "✅ Golf Monthly: $(grep -c "^https://" deep_urls_golfmonthly_com.txt 2>/dev/null || echo 0) 个URL"

# 3. MyGolfSpy - 使用新的增强抓取器
echo ""
echo "3. MyGolfSpy (目标: 30+ URLs)..."
node mygolfspy_url_generator.js --urls-only > deep_urls_mygolfspy_com.txt 2>&1 &
MG_PID=$!

# 4. GolfWRX - 增加到100篇
echo ""
echo "4. GolfWRX (目标: 100 URLs)..."
node process_golfwrx.js process 100 --urls-only > deep_urls_www_golfwrx_com.txt 2>&1 &
GW_PID=$!

# 5. Golf Digest - 忽略时间限制
echo ""
echo "5. Golf Digest (目标: 50+ URLs)..."
node discover_golfdigest_articles.js 100 --ignore-time --urls-only > deep_urls_www_golfdigest_com.txt 2>&1 &
GD_PID=$!

# 6. Today's Golfer - 手动添加实际文章URL
echo ""
echo "6. Today's Golfer (手动添加实际文章)..."
cat > deep_urls_todays_golfer_com.txt << 'EOF'
https://www.todays-golfer.com/news/wentworth-bids-farewell-to-martin-slumbers/
https://www.todays-golfer.com/news/2025-us-womens-amateur-leaderboard/
https://www.todays-golfer.com/news/liv-golf-chicago-prize-money-payout-2025/
https://www.todays-golfer.com/news/fedex-st-jude-championship-prize-money-2025/
https://www.todays-golfer.com/news/cam-smith-withdraws-fedex-st-jude-championship/
https://www.todays-golfer.com/news/rory-mcilroy-new-3-wood-fedex-playoffs/
https://www.todays-golfer.com/news/scottie-scheffler-caddie-ted-scott-surgery/
https://www.todays-golfer.com/news/justin-rose-new-putter-fedex-playoffs/
https://www.todays-golfer.com/news/tommy-fleetwood-caddie-ian-finnis-injury/
https://www.todays-golfer.com/news/tiger-woods-pga-tour-policy-board-meeting/
EOF

# 等待并行任务完成（最多60秒）
echo ""
echo "⏳ 等待并行任务完成..."
COUNTER=0
while [ $COUNTER -lt 60 ]; do
    if ! kill -0 $MG_PID 2>/dev/null && ! kill -0 $GW_PID 2>/dev/null && ! kill -0 $GD_PID 2>/dev/null; then
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

# 强制终止还在运行的进程
kill $MG_PID 2>/dev/null
kill $GW_PID 2>/dev/null
kill $GD_PID 2>/dev/null

echo ""
echo "=== 📊 最终统计 ==="
echo "Golf.com: $(grep -c "^https://" deep_urls_golf_com.txt 2>/dev/null || echo 0) 个URL"
echo "Golf Monthly: $(grep -c "^https://" deep_urls_golfmonthly_com.txt 2>/dev/null || echo 0) 个URL"
echo "MyGolfSpy: $(grep -c "^https://" deep_urls_mygolfspy_com.txt 2>/dev/null || echo 0) 个URL"
echo "GolfWRX: $(grep -c "^https://" deep_urls_www_golfwrx_com.txt 2>/dev/null || echo 0) 个URL"
echo "Golf Digest: $(grep -c "^https://" deep_urls_www_golfdigest_com.txt 2>/dev/null || echo 0) 个URL"
echo "Today's Golfer: $(grep -c "^https://" deep_urls_todays_golfer_com.txt 2>/dev/null || echo 0) 个URL"
echo ""
echo "总URL数: $(cat deep_urls_*.txt 2>/dev/null | grep -c "^https://")"
echo ""
echo "✅ URL生成完成！"