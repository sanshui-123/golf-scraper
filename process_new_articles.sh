#!/bin/bash

# 处理新发现的文章

echo "🚀 开始处理新文章..."
echo ""

# 文章URL列表
urls=(
"https://www.golfmonthly.com/news/from-lack-of-sleep-to-the-surprise-of-2019-5-things-rory-mcilroy-said-ahead-of-the-2025-open"
"https://www.golfmonthly.com/news/why-havent-these-three-famous-open-venues-been-used-for-a-while-and-what-are-the-chances-of-a-return"
"https://www.golfmonthly.com/news/how-to-watch-the-open-2025"
"https://www.golfmonthly.com/news/5-modern-links-that-could-be-great-open-courses"
"https://www.golfmonthly.com/buying-advice/best-beginner-golf-clubs-for-ladies"
"https://www.golfmonthly.com/buying-advice/best-womens-golf-clubs-year"
"https://www.golfmonthly.com/features/shane-lowry-reflects-on-2019-open-championship-win-at-royal-portrush"
"https://www.golfmonthly.com/features/our-heated-office-debate-about-the-world-handicap-system-unearthed-a-worrying-divide-between-low-and-high-handicappers"
"https://www.golfmonthly.com/features/the-7-golf-products-wed-create-if-all-equipment-rules-were-removed"
"https://www.golfmonthly.com/news/the-historic-links-that-could-one-day-be-the-republic-of-irelands-first-ever-open-venue"
"https://www.golfmonthly.com/news/paul-waring-becomes-second-withdrawal-from-2025-open"
"https://www.golfmonthly.com/news/which-past-open-champions-are-not-playing-at-royal-portrush"
"https://www.golfmonthly.com/news/open-championship-2025-form-guide-scheffler-mcilroy-schauffele-and-co"
"https://www.golfmonthly.com/news/open-weather-forecast-portrush"
"https://www.golfmonthly.com/news/amateurs-open-championship-2025-field"
"https://www.golfmonthly.com/news/open-practice-tee-times"
"https://www.golfmonthly.com/buying-advice/dont-tell-amazon-but-these-prime-day-golf-deals-are-still-live"
"https://www.golfmonthly.com/buying-advice/i-cant-believe-this-new-putter-is-already-discounted-by-34-percent-on-amazons-final-prime-day"
"https://www.golfmonthly.com/buying-advice/amazon-prime-day-ends-tonight-this-is-your-last-chance-to-pick-up-these-golf-balls-training-aids-and-accessories-under-usd50"
"https://www.golfmonthly.com/buying-advice/this-excellent-golfbuddy-rangefinder-is-only-usd120-on-amazon-prime-day-but-this-discount-will-expire-very-soon"
"https://www.golfmonthly.com/buying-advice/act-fast-on-the-final-day-of-amazon-prime-my-favorite-spiked-shoe-of-2024-now-has-up-to-55-percent-off"
"https://www.golfmonthly.com/buying-advice/amazon-prime-day-ends-tonight-here-are-25-deals-id-buy-before-its-too-late"
)

# 批量处理所有URL
echo "📊 总共 ${#urls[@]} 篇文章待处理"
echo ""

# 使用start.js处理所有文章
node start.js "${urls[@]}"

echo ""
echo "✅ 批量处理完成！"