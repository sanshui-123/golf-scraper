#!/bin/bash

echo "🏌️ Golf.com改进版测试脚本"
echo "=============================="
echo ""

# 选择测试类型
echo "请选择测试类型："
echo "1. 快速测试 - 抓取一篇文章"
echo "2. 增强测试 - 测试图片处理器"
echo "3. 完整测试 - 抓取多篇文章"
echo ""
read -p "请输入选项 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 运行快速测试..."
        node test_golf_quick.js
        ;;
    2)
        echo ""
        echo "🚀 运行增强测试..."
        node test_golf_com_enhanced.js
        ;;
    3)
        echo ""
        echo "🚀 运行完整测试..."
        # 创建测试URL列表
        cat > test_golf_urls.txt << EOF
https://golf.com/instruction/driving/easy-way-straighter-drives-according-hall-fame-teacher/
https://golf.com/news/tours/pga-tour/sony-open-2025-leaderboard-live-coverage-golf-scores-today-round-1-highlights/
https://golf.com/gear/drivers/cobra-darkspeed-max-driver-review/
EOF
        
        echo "测试URL列表："
        cat test_golf_urls.txt
        echo ""
        
        # 运行批处理
        node process_article_list.js test_golf_urls.txt
        
        # 清理
        rm -f test_golf_urls.txt
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac

echo ""
echo "✅ 测试完成！"
echo ""
echo "查看结果："
echo "- 快速测试结果: test_golf_result.json"
echo "- 图片文件夹: golf_content/images/"
echo "- 文章文件夹: golf_content/articles/"