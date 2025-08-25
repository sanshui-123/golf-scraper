#!/bin/bash
# 日志清理脚本 - 2025-08-12

echo "🧹 开始清理日志文件..."

# 1. 处理超大日志文件
echo "📊 检查大文件..."
LARGE_FILES=$(find . -name "*.log" -size +100M -type f 2>/dev/null)

if [ -n "$LARGE_FILES" ]; then
    echo "发现以下大文件："
    echo "$LARGE_FILES" | while read file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "  - $file ($SIZE)"
    done
    
    echo ""
    echo "⚠️  web_server_clean.log 文件有 457MB，建议处理"
    
    # 压缩大文件
    echo "$LARGE_FILES" | while read file; do
        echo "压缩: $file"
        gzip "$file"
    done
else
    echo "✅ 没有发现超过100MB的日志文件"
fi

# 2. 删除7天前的压缩日志
echo ""
echo "🗑️  清理旧的压缩日志..."
OLD_LOGS=$(find . -name "*.log.gz" -mtime +7 -type f 2>/dev/null)

if [ -n "$OLD_LOGS" ]; then
    echo "删除以下旧日志："
    echo "$OLD_LOGS"
    echo "$OLD_LOGS" | xargs rm -f
else
    echo "✅ 没有7天前的压缩日志"
fi

# 3. 清理batch处理日志（保留最新5个）
echo ""
echo "📦 清理批处理日志..."
for pattern in "batch_deep_urls_*.log" "temp_batch_*.txt" "temp_rewrite_*.txt"; do
    COUNT=$(ls -1 $pattern 2>/dev/null | wc -l)
    if [ $COUNT -gt 5 ]; then
        echo "清理 $pattern (保留最新5个)"
        ls -1t $pattern | tail -n +6 | xargs rm -f
    fi
done

# 4. 显示清理结果
echo ""
echo "📊 清理完成，当前日志文件状态："
echo "日志文件总数: $(find . -name "*.log" -type f | wc -l)"
echo "压缩文件总数: $(find . -name "*.log.gz" -type f | wc -l)"
echo "总占用空间: $(du -sh *.log *.log.gz 2>/dev/null | awk '{sum+=$1} END {print sum"MB"}')"

echo ""
echo "✅ 日志清理完成！"