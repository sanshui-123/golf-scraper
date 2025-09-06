#!/bin/bash

# 日常维护脚本 - 用于每天的例行操作
echo "🛠️ 日常维护任务"
echo "================================"

# 1. 清理临时文件
echo "🧹 清理临时文件..."
rm -f temp_rewrite_*.txt temp_retry_hint_*.txt 2>/dev/null
find . -name "*.log" -size +100M -exec rm {} \; 2>/dev/null
echo "   ✅ 清理完成"

# 2. 检查昨日成果
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
if [ -d "golf_content/$YESTERDAY/wechat_ready" ]; then
    YESTERDAY_COUNT=$(ls golf_content/$YESTERDAY/wechat_ready/*.md 2>/dev/null | wc -l)
    echo ""
    echo "📊 昨日处理统计："
    echo "   完成文章: $YESTERDAY_COUNT 篇"
fi

# 3. 检查今日任务
TODAY=$(date +%Y-%m-%d)
echo ""
echo "📅 今日任务状态："

# 检查URL文件
URL_COUNT=0
for f in deep_urls_*.txt; do
    if [ -f "$f" ]; then
        URL_COUNT=$((URL_COUNT + 1))
    fi
done
echo "   URL文件: $URL_COUNT 个"

# 检查今日文章
if [ -d "golf_content/$TODAY/wechat_ready" ]; then
    TODAY_COUNT=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)
    echo "   已完成: $TODAY_COUNT 篇"
else
    echo "   已完成: 0 篇"
fi

# 4. 系统健康快速检查
echo ""
echo "🏥 系统健康检查："
WEB_OK=$(curl -s http://localhost:8080 > /dev/null && echo "✅" || echo "❌")
echo "   Web服务器: $WEB_OK"

CTRL_COUNT=$(ps aux | grep "intelligent_concurrent" | grep -v grep | wc -l)
if [ $CTRL_COUNT -gt 0 ]; then
    echo "   控制器: ✅ ($CTRL_COUNT 个运行中)"
else
    echo "   控制器: ❌ (未运行)"
fi

# 5. 选择操作
echo ""
echo "请选择操作："
echo "1) 📥 生成今日URL"
echo "2) 🚀 启动处理系统"
echo "3) 🔍 查看系统状态"
echo "4) 🛑 停止所有进程"
echo "5) ❌ 退出"

read -p "选择 (1-5): " -n 1 -r
echo
echo

case $REPLY in
    1)
        echo "📥 生成今日URL..."
        node auto_scrape_three_sites.js --all-sites
        ;;
    2)
        ./run_daily_workflow.sh
        ;;
    3)
        ./system_diagnosis.sh
        ;;
    4)
        ./safe_shutdown.sh
        ;;
    5)
        echo "👋 退出"
        exit 0
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac