#\!/bin/bash

echo "🔐 GitHub SSH 密钥配置工具"
echo "========================="
echo ""

# 检查是否已有 SSH 密钥
if [ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_rsa ]; then
    echo "⚠️  发现已存在的 SSH 密钥："
    ls -la ~/.ssh/id_* 2>/dev/null
    echo ""
    echo "是否要使用现有密钥？(y/n)"
    read -r use_existing
    if [[ "$use_existing" == "y" || "$use_existing" == "Y" ]]; then
        EXISTING_KEY=true
    else
        EXISTING_KEY=false
    fi
else
    EXISTING_KEY=false
fi

# 生成新密钥
if [ "$EXISTING_KEY" = false ]; then
    echo "📝 生成新的 SSH 密钥..."
    echo "   算法：Ed25519（推荐）"
    echo "   用途：GitHub 身份验证"
    echo ""
    echo "请按 Enter 接受默认文件位置，或输入新位置："
    ssh-keygen -t ed25519 -C "sanshui-123@github.com"
    
    if [ $? -ne 0 ]; then
        echo "❌ 密钥生成失败"
        exit 1
    fi
fi

echo ""
echo "🔧 配置 SSH Agent..."

# 启动 ssh-agent
eval "$(ssh-agent -s)" > /dev/null 2>&1

# 创建 SSH config 文件
echo "📄 创建 SSH 配置文件..."
cat > ~/.ssh/config << 'CONFIG'
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
CONFIG

# 添加密钥到 ssh-agent
echo "🔑 添加密钥到 SSH Agent..."
if [ -f ~/.ssh/id_ed25519 ]; then
    ssh-add --apple-use-keychain ~/.ssh/id_ed25519 2>/dev/null || ssh-add ~/.ssh/id_ed25519
elif [ -f ~/.ssh/id_rsa ]; then
    ssh-add --apple-use-keychain ~/.ssh/id_rsa 2>/dev/null || ssh-add ~/.ssh/id_rsa
fi

echo ""
echo "📋 复制公钥到剪贴板..."

# 复制公钥
if [ -f ~/.ssh/id_ed25519.pub ]; then
    pbcopy < ~/.ssh/id_ed25519.pub
    echo "✅ Ed25519 公钥已复制到剪贴板！"
elif [ -f ~/.ssh/id_rsa.pub ]; then
    pbcopy < ~/.ssh/id_rsa.pub
    echo "✅ RSA 公钥已复制到剪贴板！"
else
    echo "❌ 未找到公钥文件"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 下一步：在 GitHub 添加 SSH 密钥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 打开浏览器访问："
echo "   https://github.com/settings/ssh/new"
echo ""
echo "2. 填写表单："
echo "   - Title: Mac SSH Key ($(date +%Y-%m-%d))"
echo "   - Key type: Authentication Key"
echo "   - Key: 粘贴（已在剪贴板）"
echo ""
echo "3. 点击 'Add SSH key'"
echo ""
echo "4. 完成后运行以下命令测试："
echo "   ssh -T git@github.com"
echo ""
echo "5. 切换仓库到 SSH："
echo "   cd /Users/sanshui/Desktop/cursor"
echo "   git remote set-url origin git@github.com:sanshui-123/golf-scraper.git"
echo ""
echo "💡 提示：公钥已在剪贴板，直接粘贴即可！"
