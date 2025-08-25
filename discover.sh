#!/bin/bash

# 高尔夫文章自动发现脚本
# 使用方法：
# ./discover.sh                              # 扫描24小时内的文章
# ./discover.sh --ignore-time                # 扫描所有文章（忽略时间）
# ./discover.sh --fetch-detail-time          # 从详情页获取时间
# ./discover.sh "https://www.golfmonthly.com/" --ignore-time

# 默认主页
DEFAULT_URL="https://www.golfmonthly.com/"

# 分离URL参数和选项参数
HOMEPAGE_URL=""
OPTIONS=()

for arg in "$@"; do
    if [[ $arg == --* ]]; then
        OPTIONS+=("$arg")
    else
        HOMEPAGE_URL="$arg"
    fi
done

# 如果没有提供URL，使用默认值
if [ -z "$HOMEPAGE_URL" ]; then
    HOMEPAGE_URL="$DEFAULT_URL"
fi

echo "🔍 高尔夫文章自动发现工具"

# 根据选项显示不同的提示
if [[ " ${OPTIONS[@]} " =~ " --ignore-time " ]]; then
    echo "📅 扫描所有文章（忽略时间过滤）"
else
    echo "📅 扫描过去24小时的新文章"
fi

echo ""

# 调用 Node.js 脚本，传递所有参数
node discover_recent_articles.js "$HOMEPAGE_URL" "${OPTIONS[@]}"

echo ""
echo "💡 提示："
echo "  - 系统会自动扫描主页上的文章"
echo "  - 过滤出24小时内发布的文章"
echo "  - 对比已处理的文章，找出新文章"
echo "  - 可选择批量处理新文章"