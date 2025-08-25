#!/bin/bash

# 处理非装备类文章（排除装备类）

echo "🚀 开始处理非装备类文章..."
echo "⏭️  装备类文章将自动跳过"
echo ""

# 非装备类文章URL列表
urls=(
"https://www.golfmonthly.com/news/open-championship-2025-form-guide-scheffler-mcilroy-schauffele-and-co"
"https://www.golfmonthly.com/news/open-practice-tee-times"
"https://www.golfmonthly.com/news/open-championship-2025-full-field-how-qualified"
"https://www.golfmonthly.com/news/royal-portrush-facts-open-championship-host-course"
"https://www.golfmonthly.com/news/live/genesis-scottish-open-2025-leaderboard-live-updates"
)

# 批量处理所有URL
echo "📊 总共 ${#urls[@]} 篇非装备类文章待处理"
echo ""

# 使用start.js处理所有文章
node start.js "${urls[@]}"

echo ""
echo "✅ 批量处理完成！"