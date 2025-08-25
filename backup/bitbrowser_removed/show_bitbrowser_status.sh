#!/bin/bash

# BitBrowser状态显示脚本

echo "🔍 BitBrowser系统状态检查"
echo "========================================"

# 1. 检查客户端连接
echo -e "\n📡 客户端连接状态："
if node check_bitbrowser.js 2>/dev/null | grep -q "✅"; then
    echo "✅ BitBrowser客户端已连接"
    
    # 2. 显示配置文件统计
    echo -e "\n📊 配置文件统计："
    node bitbrowser_manager.js stats 2>/dev/null || echo "❌ 无法获取统计信息"
    
else
    echo "❌ BitBrowser客户端未运行或API服务未启用"
    echo ""
    echo "🚀 启动步骤："
    echo "1. 启动BitBrowser客户端软件"
    echo "2. 确保API服务已启用（默认端口：54345）"
    echo "3. 创建至少一个浏览器配置文件"
fi

# 3. 检查代理状态
echo -e "\n🌐 代理池状态："
proxy_count=$(grep -c '"proxy"' proxy_config.json 2>/dev/null || echo 0)
echo "代理总数：$proxy_count"

# 4. 显示AI检测模式
echo -e "\n🎯 AI检测模式："
mode=$(grep -o 'setDetectionMode.*hybrid\|setDetectionMode.*bitbrowser\|setDetectionMode.*proxy' batch_process_articles.js | head -1 | cut -d"'" -f2)
echo "当前模式：${mode:-hybrid}"
echo ""
echo "📌 模式说明："
echo "- hybrid: 优先BitBrowser，失败时自动降级到代理"
echo "- bitbrowser: 仅使用BitBrowser"
echo "- proxy: 仅使用代理池"

# 5. 显示今日AI检测统计
echo -e "\n📈 今日AI检测统计："
today_dir="golf_content/$(date +%Y-%m-%d)/wechat_ready"
if [ -d "$today_dir" ]; then
    total_articles=$(ls -1 "$today_dir"/*.md 2>/dev/null | wc -l)
    ai_detected=$(grep -l "<!-- AI检测:" "$today_dir"/*.md 2>/dev/null | wc -l)
    echo "总文章数：$total_articles"
    echo "已检测数：$ai_detected"
    
    if [ $ai_detected -gt 0 ]; then
        echo -e "\n🤖 AI检测结果示例："
        grep "<!-- AI检测:" "$today_dir"/*.md 2>/dev/null | head -3 | sed 's/.*<!-- AI检测: /  - AI率: /; s/ | 检测时间:.*-->//'
    fi
else
    echo "今日暂无文章"
fi

echo -e "\n========================================"
echo "💡 提示：使用 ./smart_restart.sh 启动系统"