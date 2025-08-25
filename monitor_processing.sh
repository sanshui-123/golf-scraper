#!/bin/bash

# 📊 87个URL处理进度监控脚本
# 实时监控处理状态和进度

echo "📊 URL处理进度监控器"
echo "监控时间: $(date)"
echo "================================"

# 1. 检查Web服务器状态
echo "1️⃣ Web服务器状态:"
if curl --noproxy localhost -s http://localhost:8080 >/dev/null 2>&1; then
    echo "   ✅ Web界面可访问 (http://localhost:8080)"
else
    echo "   ❌ Web界面不可访问"
fi

# 2. 检查批处理进程
echo ""
echo "2️⃣ 批处理进程状态:"
BATCH_PROCESSES=$(ps aux | grep -E "(batch_process|auto_recovery)" | grep -v grep)
if [ -n "$BATCH_PROCESSES" ]; then
    echo "$BATCH_PROCESSES"
else
    echo "   ❌ 没有批处理进程在运行"
fi

# 3. 统计处理进度
echo ""
echo "3️⃣ 处理进度统计:"
TODAY=$(date +%Y-%m-%d)
PROCESSED_COUNT=0
if [ -d "golf_content/$TODAY/wechat_ready" ]; then
    PROCESSED_COUNT=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)
fi

echo "   📅 处理日期: $TODAY"
echo "   ✅ 已处理文章: $PROCESSED_COUNT 篇"
echo "   🎯 目标总数: 87 个URL"
echo "   📊 完成率: $(( $PROCESSED_COUNT * 100 / 87 ))%"
echo "   ⏳ 剩余待处理: $(( 87 - $PROCESSED_COUNT )) 个URL"

# 4. 各网站处理情况
echo ""
echo "4️⃣ 各网站处理情况:"
if [ -d "golf_content/$TODAY" ]; then
    echo "   Golf.com: $(find golf_content/$TODAY -name "wechat_article_6*.md" 2>/dev/null | wc -l) 篇"
    echo "   Golf Monthly: $(find golf_content/$TODAY -name "*golfmonthly*" 2>/dev/null | wc -l) 篇"
    echo "   MyGolfSpy: $(find golf_content/$TODAY -name "*mygolfspy*" 2>/dev/null | wc -l) 篇"
    echo "   Golf Digest: $(find golf_content/$TODAY -name "*golfdigest*" 2>/dev/null | wc -l) 篇"
    echo "   GolfWRX: $(find golf_content/$TODAY -name "*golfwrx*" 2>/dev/null | wc -l) 篇"
else
    echo "   ❌ 今日处理目录不存在"
fi

# 5. URL文件状态
echo ""
echo "5️⃣ URL文件状态:"
for file in deep_urls_*.txt; do
    if [ -f "$file" ]; then
        count=$(wc -l < "$file")
        echo "   $file: $count URLs"
    fi
done

# 6. 新URL标记状态
echo ""
echo "6️⃣ 新URL标记状态:"
if [ -f "fresh_urls_flag.json" ]; then
    echo "   ✅ 新URL标记文件存在"
    echo "   📅 生成时间: $(grep timestamp fresh_urls_flag.json | cut -d'"' -f4)"
else
    echo "   📋 新URL标记文件不存在"
fi

# 7. 最近的处理日志
echo ""
echo "7️⃣ 最近的处理活动:"
if [ -f "batch_processing.log" ]; then
    echo "   最新日志内容:"
    tail -5 batch_processing.log | sed 's/^/   /'
else
    echo "   ❌ 批处理日志文件不存在"
fi

echo ""
echo "================================"
echo "监控完成: $(date)"
echo ""
echo "💡 管理命令:"
echo "   重新监控: ./monitor_processing.sh"
echo "   查看Web界面: open http://localhost:8080"
echo "   查看处理日志: tail -f batch_processing.log"
echo "   修复8080端口: ./port_8080_fix.sh"