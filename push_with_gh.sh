#\!/bin/bash

echo "🚀 GitHub CLI 推送脚本"
echo "====================="

# 检查 gh 是否安装
if \! command -v gh &> /dev/null; then
    echo "❌ 错误：GitHub CLI 未安装"
    echo "   请先查看 GITHUB_CLI_INSTALL_GUIDE.md 安装 GitHub CLI"
    exit 1
fi

# 检查是否已登录
if \! gh auth status &> /dev/null; then
    echo "🔑 需要先登录 GitHub..."
    echo "   运行以下命令登录："
    echo "   gh auth login"
    echo ""
    echo "   然后重新运行此脚本"
    exit 1
fi

echo "✅ 已登录 GitHub"
echo ""

# 检查远程仓库
if \! git remote get-url origin &> /dev/null; then
    echo "⚙️  设置远程仓库..."
    gh repo set-default sanshui-123/golf-scraper
fi

# 推送代码
echo "📤 开始推送代码到 GitHub..."
echo "   分支：fresh-main → main"
echo ""

if gh repo view sanshui-123/golf-scraper &> /dev/null; then
    # 仓库存在，直接推送
    git push origin fresh-main:main --force
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 推送成功！"
        echo "📍 仓库地址: https://github.com/sanshui-123/golf-scraper"
        
        # 切换到主分支
        echo ""
        echo "🔄 正在切换分支..."
        git checkout fresh-main
        git branch -D main 2>/dev/null || true
        git branch -m main
        
        echo "✅ 完成！你的代码已经在 GitHub 上了"
        echo ""
        echo "🌐 在浏览器中查看: https://github.com/sanshui-123/golf-scraper"
    else
        echo "❌ 推送失败"
        echo "   请检查网络连接或仓库权限"
    fi
else
    echo "❌ 错误：无法访问仓库 sanshui-123/golf-scraper"
    echo "   请确保："
    echo "   1. 你已经登录到正确的 GitHub 账号"
    echo "   2. 仓库名称正确"
fi
