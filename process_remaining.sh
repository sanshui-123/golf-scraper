#!/bin/bash

# 剩余需要处理的文章列表
urls=(
    "https://www.golfmonthly.com/tips/left-hand-low-putting-grip-explained"
    "https://www.golfmonthly.com/buying-advice/best-beginner-golf-clubs-for-ladies"
    "https://www.golfmonthly.com/buying-advice/best-womens-golf-clubs-year"
    "https://www.golfmonthly.com/features/our-heated-office-debate-about-the-world-handicap-system-unearthed-a-worrying-divide-between-low-and-high-handicappers"
    "https://www.golfmonthly.com/buying-advice/dont-tell-amazon-but-these-prime-day-golf-deals-are-still-live"
    "https://www.golfmonthly.com/buying-advice/i-cant-believe-this-new-putter-is-already-discounted-by-34-percent-on-amazons-final-prime-day"
    "https://www.golfmonthly.com/buying-advice/amazon-prime-day-ends-tonight-this-is-your-last-chance-to-pick-up-these-golf-balls-training-aids-and-accessories-under-usd50"
    "https://www.golfmonthly.com/buying-advice/this-excellent-golfbuddy-rangefinder-is-only-usd120-on-amazon-prime-day-but-this-discount-will-expire-very-soon"
    "https://www.golfmonthly.com/buying-advice/act-fast-on-the-final-day-of-amazon-prime-my-favorite-spiked-shoe-of-2024-now-has-up-to-55-percent-off"
    "https://www.golfmonthly.com/buying-advice/amazon-prime-day-ends-tonight-here-are-25-deals-id-buy-before-its-too-late"
)

echo "🚀 开始批量处理剩余的 ${#urls[@]} 篇文章..."
echo "================================================"

# 逐个处理每个URL
for i in "${!urls[@]}"; do
    echo ""
    echo "📄 处理第 $((i+1))/${#urls[@]} 篇文章"
    echo "🔗 ${urls[$i]}"
    echo "------------------------------------------------"
    
    # 调用处理程序
    node process_articles_now.js "${urls[$i]}"
    
    # 检查处理结果
    if [ $? -eq 0 ]; then
        echo "✅ 第 $((i+1)) 篇处理成功"
    else
        echo "❌ 第 $((i+1)) 篇处理失败"
    fi
    
    # 等待3秒再处理下一篇，避免API压力
    if [ $((i+1)) -lt ${#urls[@]} ]; then
        echo "⏳ 等待3秒后继续..."
        sleep 3
    fi
done

echo ""
echo "================================================"
echo "✨ 批量处理完成!"
echo "📊 共处理 ${#urls[@]} 篇文章"
echo "📱 访问 http://localhost:8080 查看结果"