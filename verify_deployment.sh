#!/bin/bash

# Vercel部署验证脚本
echo "🔍 Vercel部署验证工具"
echo "========================"
echo ""

# 检查是否提供了域名
if [ -z "$1" ]; then
    echo "使用方法: ./verify_deployment.sh <你的vercel域名>"
    echo "例如: ./verify_deployment.sh golf-scraper-abc123.vercel.app"
    exit 1
fi

DOMAIN="$1"
BASE_URL="https://$DOMAIN"

echo "🌐 测试域名: $BASE_URL"
echo ""

# 测试主页
echo "📋 测试主页..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$STATUS" = "200" ]; then
    echo "✅ 主页正常 (状态码: $STATUS)"
else
    echo "❌ 主页异常 (状态码: $STATUS)"
fi

# 测试API
echo ""
echo "🔌 测试API..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/system-status")
if [ "$STATUS" = "200" ]; then
    echo "✅ API正常 (状态码: $STATUS)"
    echo "   响应内容:"
    curl -s "$BASE_URL/api/system-status" | python3 -m json.tool 2>/dev/null || echo "   (无法解析JSON)"
else
    echo "❌ API异常 (状态码: $STATUS)"
fi

# 测试监控页面
echo ""
echo "📊 测试监控页面..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/monitor")
if [ "$STATUS" = "200" ]; then
    echo "✅ 监控页面正常 (状态码: $STATUS)"
else
    echo "❌ 监控页面异常 (状态码: $STATUS)"
fi

# 测试文章页面
echo ""
echo "📖 测试文章页面..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/articles/example")
if [ "$STATUS" = "200" ]; then
    echo "✅ 文章页面正常 (状态码: $STATUS)"
else
    echo "❌ 文章页面异常 (状态码: $STATUS)"
fi

echo ""
echo "========================"
echo "🏁 测试完成！"
echo ""
echo "📱 在浏览器中访问:"
echo "   $BASE_URL"