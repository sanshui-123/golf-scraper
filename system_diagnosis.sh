#!/bin/bash

echo "🔍 系统健康诊断"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. 检查进程状态
echo "1️⃣ 进程状态检查:"
WEB_COUNT=$(ps aux | grep "node web_server.js" | grep -v grep | wc -l)
CTRL_COUNT=$(ps aux | grep "intelligent_concurrent" | grep -v grep | wc -l)
HEALTH_COUNT=$(ps aux | grep "controller_health_monitor" | grep -v grep | wc -l)

echo "   Web服务器: $([ $WEB_COUNT -gt 0 ] && echo '✅ 运行中' || echo '❌ 未运行')"
echo "   控制器数量: $CTRL_COUNT 个"
echo "   健康监控: $([ $HEALTH_COUNT -gt 0 ] && echo '✅ 运行中' || echo '❌ 未运行')"
echo ""

# 2. 检查今日成果
echo "2️⃣ 今日处理成果:"
TODAY=$(date +%Y-%m-%d)
if [ -d "golf_content/$TODAY/wechat_ready" ]; then
    ARTICLE_COUNT=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)
    echo "   已完成文章: $ARTICLE_COUNT 篇"
else
    echo "   已完成文章: 0 篇"
fi

# 统计URL情况
TOTAL_URLS=0
NEW_URLS=0
for f in deep_urls_*.txt; do
    if [ -f "$f" ]; then
        COUNT=$(wc -l < "$f")
        TOTAL_URLS=$((TOTAL_URLS + COUNT))
    fi
done
echo "   待处理URL: $TOTAL_URLS 个"
echo ""

# 3. 检查错误情况
echo "3️⃣ 错误统计:"
if [ -f "failed_articles.json" ]; then
    FAILED_COUNT=$(grep -c '"url"' failed_articles.json 2>/dev/null || echo 0)
    echo "   失败文章: $FAILED_COUNT 个"
else
    echo "   失败文章: 0 个"
fi

# 检查最近错误
if [ -d "controller_logs" ]; then
    RECENT_ERRORS=$(find controller_logs -name "*.log" -mtime -1 -exec grep -l "错误\|失败\|超时" {} \; | wc -l)
    echo "   今日错误日志: $RECENT_ERRORS 个文件有错误"
fi
echo ""

# 4. 性能指标
echo "4️⃣ 性能指标:"
# API响应时间
if [ -f "api_response_times.json" ]; then
    AVG_TIME=$(cat api_response_times.json | jq -r '.stats.avgResponseTime' 2>/dev/null || echo "N/A")
    if [ "$AVG_TIME" != "N/A" ]; then
        echo "   平均API响应: $(echo "scale=1; $AVG_TIME/1000" | bc)秒"
    fi
fi

# CPU和内存
CPU_USAGE=$(top -l 1 | grep "CPU usage" | awk '{print $3}')
echo "   当前CPU使用: $CPU_USAGE"
echo ""

# 5. 建议
echo "5️⃣ 优化建议:"
if [ $CTRL_COUNT -eq 0 ]; then
    echo "   ⚠️ 没有控制器运行，建议运行: ./safe_startup.sh"
elif [ $CTRL_COUNT -lt 3 ]; then
    echo "   💡 控制器数量偏少，可以启动更多: ./run_multiple_controllers.sh"
elif [ $CTRL_COUNT -gt 5 ]; then
    echo "   ⚠️ 控制器过多，可能影响性能"
else
    echo "   ✅ 系统运行正常"
fi

if [ $HEALTH_COUNT -eq 0 ] && [ $CTRL_COUNT -gt 0 ]; then
    echo "   💡 建议启动健康监控: node controller_health_monitor.js"
fi
echo ""
echo "═══════════════════════════════════════════════════════════════"