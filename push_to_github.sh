#!/bin/bash
echo "准备推送到GitHub..."

# 设置远程仓库（使用您的Personal Access Token）
echo "设置远程仓库..."
git remote set-url origin https://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@github.com/sanshui-123/golf-scraper.git

# 推送到GitHub
echo "开始推送..."
git push -u origin main

# 推送完成后，出于安全考虑，删除token
echo "清理token..."
git remote set-url origin https://github.com/sanshui-123/golf-scraper.git

echo "完成！"