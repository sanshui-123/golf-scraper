#!/bin/bash

# 修复损坏的文章
echo "🔧 修复损坏的文章..."
echo ""

# 创建临时URL文件
cat > fix_corrupted_articles.txt << EOF
https://sports.yahoo.com/article/chinas-wang-grabs-three-shot-005541176.html
https://golf.com/news/rose-zhang-fm-championship-found-something-missing/
https://golf.com/gear/miranda-wangs-fm-championship-witb/
EOF

echo "📄 已创建修复文件 fix_corrupted_articles.txt，包含3个损坏文章的URL"
echo ""
echo "执行修复："
echo "node batch_process_articles.js fix_corrupted_articles.txt"