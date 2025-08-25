#!/bin/bash

echo "🚀 高尔夫内容智能处理系统"
echo "========================================"
echo ""

# 检查并启动Web服务器
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "🌐 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 2
    echo "✅ Web服务器已启动"
else
    echo "✅ Web服务器已在运行"
fi

echo ""
echo "📋 步骤1: 生成所有网站的URL..."
echo "========================================"
node auto_scrape_three_sites.js --all-sites

echo ""
echo "📋 步骤2: 检查URL文件..."
echo "========================================"
# 统计URL文件
total_urls=0
for file in deep_urls_*.txt; do
    if [ -f "$file" ]; then
        count=$(grep -c "^https://" "$file" 2>/dev/null || echo "0")
        echo "✓ $file: $count 个URL"
        total_urls=$((total_urls + count))
    fi
done
echo ""
echo "📊 总计: $total_urls 个URL待处理"

echo ""
echo "📋 步骤3: 启动智能并发处理..."
echo "========================================"
echo "🤖 智能并发控制器特性："
echo "  - 根据API响应时间自动调整并发数（1-2个）"
echo "  - API压力过大时自动降级到串行处理"
echo "  - 最大并发数限制为2，确保系统稳定"
echo ""

# 询问用户是否继续
read -p "是否开始处理? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 开始智能批处理..."
    node intelligent_concurrent_controller.js
else
    echo "❌ 已取消处理"
    exit 0
fi