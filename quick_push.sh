#\!/bin/bash

echo "🔐 GitHub 安全推送工具"
echo "====================="
echo ""
echo "请准备好你的 GitHub Personal Access Token"
echo "Token 不会显示在屏幕上，输入后按回车"
echo ""

# 提示输入 token
echo -n "请粘贴你的 GitHub Token: "
read -s GITHUB_TOKEN
echo ""
echo ""

# 验证 token 不为空
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 错误：Token 不能为空"
    exit 1
fi

echo "🚀 开始推送到 GitHub..."
echo ""

# 执行推送
git push https://sanshui-123:${GITHUB_TOKEN}@github.com/sanshui-123/golf-scraper.git fresh-main:main --force

# 检查推送结果
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功！"
    echo "📍 仓库地址: https://github.com/sanshui-123/golf-scraper"
    echo ""
    
    # 切换分支
    echo "🔄 正在切换到主分支..."
    git checkout fresh-main
    git branch -D main 2>/dev/null || true
    git branch -m main
    
    echo ""
    echo "✅ 完成！你的代码已经在 GitHub 上了"
    echo "🌐 查看: https://github.com/sanshui-123/golf-scraper"
    
    # 清理 token 变量
    unset GITHUB_TOKEN
    
    # 自动删除脚本
    echo ""
    echo "🗑️  正在删除此脚本（安全考虑）..."
    rm -f "$0"
    echo "✅ 脚本已删除"
else
    echo ""
    echo "❌ 推送失败"
    echo "可能的原因："
    echo "1. Token 无效或过期"
    echo "2. Token 权限不足（需要 repo 权限）"
    echo "3. 网络连接问题"
    
    # 清理 token 变量
    unset GITHUB_TOKEN
fi
