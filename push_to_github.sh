#\!/bin/bash

# 请将下面的 YOUR_TOKEN_HERE 替换为你的 GitHub Personal Access Token
# 例如: ghp_xxxxxxxxxxxxxxxx
GITHUB_TOKEN="YOUR_TOKEN_HERE"

# 检查是否已经替换了 token
if [ "$GITHUB_TOKEN" = "YOUR_TOKEN_HERE" ]; then
    echo "❌ 错误：请先将 YOUR_TOKEN_HERE 替换为你的实际 GitHub Token"
    echo "   编辑这个文件，将第5行的 YOUR_TOKEN_HERE 替换为你的 token"
    exit 1
fi

echo "🚀 开始推送到 GitHub..."

# 推送代码
git push https://sanshui-123:${GITHUB_TOKEN}@github.com/sanshui-123/golf-scraper.git fresh-main:main --force

if [ $? -eq 0 ]; then
    echo "✅ 推送成功！"
    echo "📍 仓库地址: https://github.com/sanshui-123/golf-scraper"
    
    # 切换分支
    echo "🔄 切换到主分支..."
    git checkout fresh-main
    git branch -D main 2>/dev/null || true
    git branch -m main
    
    echo "✅ 完成！现在你的主分支就是推送的版本了"
else
    echo "❌ 推送失败，请检查你的 token 是否正确"
fi
EOF < /dev/null