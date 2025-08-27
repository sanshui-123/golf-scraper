#\!/bin/bash

echo "🚀 SSH 推送脚本"
echo "==============="
echo ""

# 检查当前远程 URL
CURRENT_URL=$(git remote get-url origin)
echo "当前远程 URL: $CURRENT_URL"
echo ""

# 如果还是 HTTPS，切换到 SSH
if [[ "$CURRENT_URL" == https://* ]]; then
    echo "⚙️  切换到 SSH URL..."
    git remote set-url origin git@github.com:sanshui-123/golf-scraper.git
    echo "✅ 已切换到 SSH"
    echo ""
fi

# 测试 SSH 连接
echo "🔍 测试 GitHub SSH 连接..."
ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"

if [ $? -eq 0 ]; then
    echo "✅ SSH 连接成功！"
    echo ""
    
    # 推送代码
    echo "📤 推送代码到 GitHub..."
    git push origin fresh-main:main --force
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 推送成功！"
        echo "📍 仓库: https://github.com/sanshui-123/golf-scraper"
        
        # 切换分支
        echo ""
        echo "🔄 切换分支..."
        git checkout fresh-main
        git branch -D main 2>/dev/null || true
        git branch -m main
        
        echo "✅ 完成！"
    else
        echo "❌ 推送失败"
    fi
else
    echo "❌ SSH 连接失败"
    echo ""
    echo "请先完成 SSH 配置："
    echo "1. 运行 ./setup_github_ssh.sh"
    echo "2. 在 GitHub 添加公钥"
    echo "3. 重新运行此脚本"
fi
