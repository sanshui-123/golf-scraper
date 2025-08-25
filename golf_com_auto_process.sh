#!/bin/bash

echo "🏌️ Golf.com 自动内容处理系统"
echo "=============================="
echo ""

# 第一步：发现内容
echo "📡 第一步：发现Golf.com最新内容..."
node discover_golf_com_24h.js

# 检查是否有文章被发现
if [ -f "golf_com_all_recent.txt" ]; then
    ARTICLE_COUNT=$(wc -l < golf_com_all_recent.txt)
    echo ""
    echo "📊 发现 $ARTICLE_COUNT 篇文章"
    
    if [ $ARTICLE_COUNT -gt 0 ]; then
        echo ""
        echo "🔄 第二步：开始处理文章..."
        echo ""
        
        # 运行批处理
        node process_article_list.js golf_com_all_recent.txt
        
        echo ""
        echo "✅ 处理完成！"
        echo ""
        echo "📂 查看结果："
        echo "  - 文章内容: golf_content/$(date +%Y-%m-%d)/wechat_ready/"
        echo "  - 图片文件: golf_content/$(date +%Y-%m-%d)/images/"
        echo "  - 网页版本: http://localhost:8080"
    else
        echo "⚠️  未找到文章"
    fi
else
    echo "❌ 内容发现失败"
fi

echo ""
echo "🎯 Golf.com内容处理流程结束"