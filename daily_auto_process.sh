#!/bin/bash

# 每日自动处理脚本
# 建议通过crontab设置定时任务，每天运行一次
# 
# 设置crontab示例（每天早上8点运行）：
# crontab -e
# 0 8 * * * cd /Users/sanshui/Desktop/cursor && ./daily_auto_process.sh >> daily_process.log 2>&1

echo "========================================="
echo "📅 开始每日自动处理 - $(date)"
echo "========================================="

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 检查服务器是否运行
SERVER_PID=$(lsof -ti:8080)
if [ -z "$SERVER_PID" ]; then
    echo "⚠️  服务器未运行，正在启动..."
    node server.js > /dev/null 2>&1 &
    sleep 5
fi

echo ""
echo "🔍 第一步：发现所有新文章..."
echo "========================================="

# 使用忽略时间模式，获取所有文章并自动处理
node discover_auto.js --ignore-time

echo ""
echo "✅ 每日处理完成！"
echo "📊 查看结果：http://localhost:8080"
echo ""

# 统计今日处理情况
TODAY_DIR="golf_content/$(date +%Y-%m-%d)"
if [ -d "$TODAY_DIR" ]; then
    ARTICLE_COUNT=$(ls -1 "$TODAY_DIR/wechat_html/" 2>/dev/null | wc -l | tr -d ' ')
    echo "📈 今日处理文章数: $ARTICLE_COUNT"
fi

echo "========================================="
echo "⏰ 处理结束时间: $(date)"
echo "========================================="