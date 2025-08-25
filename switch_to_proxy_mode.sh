#!/bin/bash

echo "🔄 切换AI检测到代理模式..."

# 备份原文件
cp batch_process_articles.js batch_process_articles.js.backup

# 替换检测模式
sed -i '' "s/setDetectionMode('hybrid')/setDetectionMode('proxy')/g" batch_process_articles.js

echo "✅ 已切换到代理模式"
echo ""
echo "📝 使用说明："
echo "1. 确保 proxy_config.json 中配置了有效代理"
echo "2. 或使用本地代理软件（Clash/V2Ray等）"
echo "3. 运行: node batch_process_articles.js deep_urls_*.txt"
echo ""
echo "🔙 恢复命令: mv batch_process_articles.js.backup batch_process_articles.js"