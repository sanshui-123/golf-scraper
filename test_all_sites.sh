#!/bin/bash

# 测试所有配置的高尔夫网站

echo "🏌️ 测试所有高尔夫网站抓取功能"
echo "================================"
echo ""

# 测试单个网站函数
test_site() {
    local name=$1
    local url=$2
    
    echo "📍 测试 $name"
    echo "🔗 URL: $url"
    echo "⏰ 开始时间: $(date)"
    echo "------------------------"
    
    # 运行抓取，只获取最近的文章
    node discover_recent_articles.js "$url" --ignore-time | head -50
    
    echo ""
    echo "✅ $name 测试完成"
    echo "⏰ 结束时间: $(date)"
    echo "================================"
    echo ""
}

# 测试各个网站
test_site "Golf Monthly" "https://www.golfmonthly.com/"
test_site "Golf.com" "https://www.golf.com/"
test_site "Golf Digest" "https://www.golfdigest.com/"

echo "🎉 所有网站测试完成！"
echo ""
echo "💡 提示："
echo "  - 如果某个网站抓取失败，会自动使用网站特定抓取器"
echo "  - 查看 site_specific_scrapers.js 添加更多网站支持"
echo "  - 使用 --all-sites 参数可以一次处理所有网站"