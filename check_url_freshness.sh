#!/bin/bash

# 检查URL文件新鲜度脚本

echo "🔍 检查URL文件新鲜度..."
echo "================================="

# 获取当前时间戳
CURRENT_TIME=$(date +%s)

# 设置阈值（6小时 = 21600秒）
THRESHOLD=21600

# 标记是否有过期文件
HAS_OLD_FILES=0

# 检查每个URL文件
for file in deep_urls_*.txt; do
    if [ -f "$file" ]; then
        # 获取文件修改时间
        FILE_TIME=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
        
        # 计算时间差
        TIME_DIFF=$((CURRENT_TIME - FILE_TIME))
        
        # 转换为小时和分钟
        HOURS=$((TIME_DIFF / 3600))
        MINUTES=$(((TIME_DIFF % 3600) / 60))
        
        # 获取文件名（去掉路径）
        FILENAME=$(basename "$file")
        
        # 获取URL数量
        URL_COUNT=$(grep "^https://" "$file" | wc -l)
        
        # 判断是否过期
        if [ $TIME_DIFF -gt $THRESHOLD ]; then
            echo "⚠️  $FILENAME: ${HOURS}小时${MINUTES}分钟前 (${URL_COUNT}个URL) - 已过期"
            HAS_OLD_FILES=1
        else
            echo "✅ $FILENAME: ${HOURS}小时${MINUTES}分钟前 (${URL_COUNT}个URL)"
        fi
    fi
done

echo "================================="

# 给出建议
if [ $HAS_OLD_FILES -eq 1 ]; then
    echo "💡 建议：有URL文件超过6小时，建议重新生成以获取最新文章"
    echo "   运行: ./smart_restart.sh"
else
    echo "✅ 所有URL文件都很新鲜，可以继续处理"
    echo "   运行: ./smart_continue.sh"
fi