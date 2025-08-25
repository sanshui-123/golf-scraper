#!/bin/bash

# 智能继续处理脚本 - 不重新生成URL，直接处理现有URL

echo "▶️ 继续处理现有URL..."

# 1. 检查是否有URL文件
URL_COUNT=$(ls deep_urls_*.txt 2>/dev/null | wc -l)
if [ $URL_COUNT -eq 0 ]; then
    echo "❌ 错误：没有找到URL文件"
    echo "💡 提示：请先运行 ./smart_restart.sh 生成URL"
    exit 1
fi

# 2. 计算总URL数
TOTAL_URLS=0
for file in deep_urls_*.txt; do
    if [ -f "$file" ]; then
        COUNT=$(grep "^https://" "$file" | wc -l)
        TOTAL_URLS=$((TOTAL_URLS + COUNT))
    fi
done

echo "📊 找到 $URL_COUNT 个网站的URL文件，共 $TOTAL_URLS 个URL"

# 3. 检查Web服务器
echo "🌐 检查Web服务器..."
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "  ✅ 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 3
else
    echo "  ✅ Web服务器已在运行"
fi

# 4. 检查是否已有处理进程在运行
if ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep > /dev/null; then
    echo "⚠️ 检测到处理进程已在运行"
    echo "💡 如需重新开始，请先运行: ./stop_processors.sh"
    exit 1
fi

# 5. 启动智能并发控制器（不重新生成URL）
echo "🚀 启动智能并发控制器处理现有URL..."
nohup node intelligent_concurrent_controller.js > intelligent_controller.log 2>&1 &

# 6. 显示状态
sleep 2
echo -e "\n✅ 已开始处理！"
echo "📝 查看进度: tail -f intelligent_controller.log"
echo "📊 查看文章: ls -la golf_content/$(date +%Y-%m-%d)/wechat_ready/"
echo "🌐 访问Web: http://localhost:8080"
echo "🛑 停止处理: ./stop_processors.sh"