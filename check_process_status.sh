#!/bin/bash

echo "🔍 系统进程状态检查"
echo "===================="
echo ""

# 1. 检查运行中的Node进程
echo "📊 运行中的Node进程："
ps aux | grep -E "node.*(batch|intelligent|scrape)" | grep -v grep || echo "  没有找到相关进程"
echo ""

# 2. 检查今日处理的文章数
TODAY=$(date +%Y-%m-%d)
ARTICLE_COUNT=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l || echo 0)
echo "📰 今日已处理文章数: $ARTICLE_COUNT 篇"
echo ""

# 3. 检查最新的日志
echo "📝 智能控制器最新日志（最后10行）："
if [ -f intelligent_controller.log ]; then
    tail -10 intelligent_controller.log | grep -E "(完成|成功|失败|错误|启动|停止)" || echo "  没有相关日志"
else
    echo "  日志文件不存在"
fi
echo ""

# 4. 检查是否还有待处理的URL
echo "🔗 待处理URL统计："
for f in deep_urls_*.txt; do
    if [ -f "$f" ]; then
        COUNT=$(wc -l < "$f")
        echo "  $f: $COUNT 个URL"
    fi
done
echo ""

# 5. 检查批处理日志中的完成状态
echo "✅ 最近的批处理完成状态："
if ls batch_*.log 1> /dev/null 2>&1; then
    for log in $(ls -t batch_*.log | head -3); do
        echo "  📄 $log:"
        tail -5 "$log" | grep -E "(完成|成功率|总计|耗时)" | sed 's/^/    /' || echo "    没有找到完成信息"
    done
else
    echo "  没有找到批处理日志"
fi
echo ""

# 6. 检查是否有错误或失败
echo "❌ 最近的错误信息："
grep -E "(错误|失败|Error|Failed)" intelligent_controller.log 2>/dev/null | tail -5 || echo "  没有发现错误"
echo ""

# 7. 判断状态
echo "🎯 状态判断："
if [ "$ARTICLE_COUNT" -gt 0 ]; then
    echo "  ✅ 系统运行正常 - 今日已成功处理 $ARTICLE_COUNT 篇文章"
    
    # 检查是否所有URL都已处理
    REMAINING_URLS=0
    for f in deep_urls_*.txt; do
        if [ -f "$f" ]; then
            URLS=$(wc -l < "$f")
            REMAINING_URLS=$((REMAINING_URLS + URLS))
        fi
    done
    
    if [ "$REMAINING_URLS" -eq 0 ]; then
        echo "  ✅ 所有URL已处理完成，批处理器正常退出"
    else
        echo "  ⚠️  还有 $REMAINING_URLS 个URL待处理"
        echo "  💡 建议：运行 'node intelligent_concurrent_controller.js' 继续处理"
    fi
else
    echo "  ⚠️  今日还没有处理任何文章"
    echo "  💡 建议：运行以下命令开始处理："
    echo "     1. node auto_scrape_three_sites.js --all-sites  # 生成URL"
    echo "     2. node intelligent_concurrent_controller.js     # 处理文章"
fi