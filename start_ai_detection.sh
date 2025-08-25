#!/bin/bash

echo "🚀 今日文章AI检测启动脚本"
echo "================================"
echo "日期: $(date +%Y-%m-%d)"
echo "================================"

# 检查今日文章目录
TODAY_DIR="golf_content/$(date +%Y-%m-%d)/wechat_ready"
if [ ! -d "$TODAY_DIR" ]; then
    echo "❌ 今日文章目录不存在: $TODAY_DIR"
    echo "💡 请先运行文章处理程序生成今日文章"
    exit 1
fi

# 统计文章数量
ARTICLE_COUNT=$(ls -1 "$TODAY_DIR"/*.md 2>/dev/null | wc -l)
if [ "$ARTICLE_COUNT" -eq 0 ]; then
    echo "❌ 今日没有找到任何文章"
    exit 1
fi

echo "📄 找到 $ARTICLE_COUNT 篇今日文章"
echo ""

# 运行AI检测
echo "🤖 开始AI检测..."
echo "================================"
node detect_today_articles.js

echo ""
echo "✅ AI检测任务已启动"
echo "💡 提示: 检测过程可能需要几分钟，请耐心等待"
echo "📊 可以访问 http://localhost:8080 查看检测结果"