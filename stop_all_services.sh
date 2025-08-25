#!/bin/bash
echo "🛑 停止所有监控服务..."

# 停止可视化监控服务器
if [ -f "visual_monitor.pid" ]; then
    local pid=$(cat visual_monitor.pid)
    kill $pid 2>/dev/null && echo "✅ 可视化监控服务器已停止"
    rm -f visual_monitor.pid
fi

# 停止端口8080上的服务
lsof -ti:8080 | xargs kill -9 2>/dev/null

# 停止批处理相关服务
pkill -f "batch_process_articles.js" 2>/dev/null
pkill -f "auto_recovery.js" 2>/dev/null
pkill -f "enhanced_health_monitor.js" 2>/dev/null

echo "🎉 所有服务已停止"
