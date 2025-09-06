#!/bin/bash
# 自动同步高尔夫文章元数据到Vercel的脚本

echo "🚀 开始自动同步流程..."

# 检查是否有正在运行的处理进程
RUNNING_PROCESSES=$(ps aux | grep -E 'node.*(batch|intelligent|scrape)' | grep -v grep | wc -l)
if [ $RUNNING_PROCESSES -gt 0 ]; then
    echo "⚠️  检测到正在运行的处理进程，是否继续？[y/N]"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 同步已取消"
        exit 1
    fi
fi

# 1. 运行文章抓取（可选）
echo "📰 是否要运行新的文章抓取？[y/N]"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "📰 抓取最新文章..."
    node auto_scrape_three_sites.js --all-sites
    
    # 2. 处理文章
    echo "⚙️ 处理文章..."
    node intelligent_concurrent_controller.js
    
    # 等待处理完成
    echo "⏳ 等待处理完成..."
    sleep 10
fi

# 3. 添加更改到Git（只添加JSON文件，不添加文章内容）
echo "📦 准备同步元数据..."
git add web_server.js
git add master_history_database.json
git add processing_status.json
git add yahoo_golf_details.json
git add espn_golf_details.json
git add content_hash_database.json
git add history_database_meta.json
git add history_url_database.json

# 4. 检查是否有更改
if git diff --staged --quiet; then
    echo "ℹ️  没有新的更改需要同步"
    exit 0
fi

# 5. 提交更改
echo "💾 提交更改..."
STATS=$(ls golf_content/$(date +%Y-%m-%d)/wechat_ready/ 2>/dev/null | wc -l || echo "0")
git commit -m "🔄 自动更新: 同步文章元数据 $(date +%Y-%m-%d\ %H:%M)

- 更新文章数据库和处理状态
- 今日处理文章数: ${STATS}篇
- 注意：文章内容仅在本地可用"

# 6. 推送到GitHub
echo "☁️  推送到GitHub..."
git push origin main

echo "✅ 同步完成！"
echo "🌐 Vercel将在1-2分钟内自动部署"
echo "📊 访问 https://golf-scraper-1l6z.vercel.app/ 查看更新"
echo ""
echo "⚠️  提醒：文章内容仅在本地可用，点击文章会显示提示信息"