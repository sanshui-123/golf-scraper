#!/bin/bash

# 高尔夫文章处理脚本
# 使用方法：
# ./process.sh "链接1" "链接2" ...
# 或者单个链接：
# ./process.sh "链接"

if [ $# -eq 0 ]; then
    echo "❌ 错误：请提供至少一个文章链接"
    echo "使用方法："
    echo "  ./process.sh \"https://example.com/article1\""
    echo "  ./process.sh \"https://example.com/article1\" \"https://example.com/article2\""
    exit 1
fi

echo "🚀 开始处理高尔夫文章..."
echo "📊 共 $# 个链接"

# 调用 Node.js 脚本处理文章
node process_articles_now.js "$@"

echo ""
echo "💡 提示：处理完成后，访问 http://localhost:8080 查看文章"