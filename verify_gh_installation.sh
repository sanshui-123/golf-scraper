#\!/bin/bash

echo "🔍 GitHub CLI 安装验证工具"
echo "=========================="
echo ""

# 步骤 1: 检查是否安装
echo "1️⃣  检查 GitHub CLI 是否已安装..."
if command -v gh &> /dev/null; then
    VERSION=$(gh --version | head -n 1)
    echo "   ✅ 已安装: $VERSION"
else
    echo "   ❌ 未安装 GitHub CLI"
    echo ""
    echo "   📖 请查看 GITHUB_CLI_INSTALL_GUIDE.md 进行安装"
    echo "   或直接下载: https://github.com/cli/cli/releases/latest/download/gh_2.63.2_macOS_arm64.pkg"
    exit 1
fi

echo ""

# 步骤 2: 检查登录状态
echo "2️⃣  检查 GitHub 登录状态..."
if gh auth status &> /dev/null; then
    USER=$(gh api user -q .login)
    echo "   ✅ 已登录为: $USER"
else
    echo "   ❌ 未登录"
    echo ""
    echo "   🔑 现在登录 GitHub？(y/n)"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        echo ""
        echo "   📱 请按照提示完成登录..."
        gh auth login
    else
        echo "   稍后运行 'gh auth login' 进行登录"
    fi
fi

echo ""

# 步骤 3: 测试功能
echo "3️⃣  测试基本功能..."
if gh auth status &> /dev/null; then
    echo "   正在获取你的仓库列表..."
    REPO_COUNT=$(gh repo list --limit 5 2>/dev/null | wc -l | tr -d ' ')
    if [ "$REPO_COUNT" -gt 0 ]; then
        echo "   ✅ 成功！发现 $REPO_COUNT 个仓库"
        echo ""
        echo "   你的前 5 个仓库："
        gh repo list --limit 5
    else
        echo "   ℹ️  没有找到仓库（这是正常的，如果你还没有创建仓库）"
    fi
else
    echo "   ⏭️  跳过（需要先登录）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 验证结果总结"
echo "━━━━━━━━━━━━━━━━━━━━━━"

if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    echo "✅ GitHub CLI 已安装并配置完成！"
    echo ""
    echo "🚀 现在可以运行推送脚本了："
    echo "   ./push_with_gh.sh"
else
    echo "⚠️  还需要完成一些步骤："
    if \! command -v gh &> /dev/null; then
        echo "   1. 安装 GitHub CLI"
    fi
    if command -v gh &> /dev/null && \! gh auth status &> /dev/null; then
        echo "   1. 登录 GitHub (运行: gh auth login)"
    fi
fi

echo ""
echo "💡 提示：如需帮助，请查看 GITHUB_CLI_INSTALL_GUIDE.md"
