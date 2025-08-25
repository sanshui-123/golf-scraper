#!/bin/bash

echo "📊 AI检测结果查看工具"
echo "===================="
echo ""

# 统计有AI检测的文章
TODAY=$(date +%Y-%m-%d)
TOTAL=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)
WITH_AI=$(grep -l "AI检测:" golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)

echo "📅 日期: $TODAY"
echo "📄 总文章数: $TOTAL"
echo "✅ 已检测: $WITH_AI"
echo "❌ 未检测: $((TOTAL - WITH_AI))"
echo ""

# 显示AI检测结果分布
echo "🎯 AI检测结果分布:"
echo "-----------------"

HIGH=0
MEDIUM=0
LOW=0

for file in golf_content/$TODAY/wechat_ready/*.md; do
    if grep -q "AI检测:" "$file"; then
        AI_RATE=$(grep "AI检测:" "$file" | sed -E 's/.*AI检测: ([0-9]+)%.*/\1/')
        FILENAME=$(basename "$file")
        
        # 根据AI率分类
        if [ "$AI_RATE" -ge 80 ]; then
            echo "🔴 高风险 (${AI_RATE}%): $FILENAME"
            ((HIGH++))
        elif [ "$AI_RATE" -ge 50 ]; then
            echo "🟡 中风险 (${AI_RATE}%): $FILENAME"
            ((MEDIUM++))
        else
            echo "🟢 低风险 (${AI_RATE}%): $FILENAME"
            ((LOW++))
        fi
    fi
done

echo ""
echo "📊 统计汇总:"
echo "- 高风险 (≥80%): $HIGH 篇"
echo "- 中风险 (50-79%): $MEDIUM 篇"  
echo "- 低风险 (<50%): $LOW 篇"
echo ""
echo "🌐 查看详情: http://localhost:8080"