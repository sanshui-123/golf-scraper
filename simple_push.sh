#!/bin/bash

# 简单推送脚本
echo "🚀 开始推送到GitHub..."

# 添加所有Vercel相关文件
echo "📦 添加Vercel部署文件..."
git add vercel.json
git add api/
git add .vercelignore
git add README_VERCEL.md
git add VERCEL_DEPLOYMENT_GUIDE.md
git add DEPLOY_NOW.md
git add golf_content/example/

# 提交更改
echo "💾 提交更改..."
git commit -m "添加Vercel部署支持"

# 尝试推送
echo "⬆️  推送到GitHub..."
echo "如果需要输入用户名密码，请输入你的GitHub凭据"
git push origin fresh-main

echo ""
echo "✅ 如果推送成功，请访问："
echo "https://vercel.com/new/clone?repository-url=https://github.com/sanshui-123/golf-scraper"
echo ""
echo "这个链接会直接导入你的项目到Vercel！"