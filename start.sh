#!/bin/bash

# 高尔夫文章管理系统启动脚本
# 确保启动正确的服务器：web_server.js

echo "🚀 启动高尔夫文章管理系统..."

# 停止所有可能运行的服务器
echo "⏹️  停止旧服务..."
pkill -f "node.*(view_server|web_server)" 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 启动正确的服务器
echo "✅ 启动 web_server.js..."
node web_server.js

# 如果需要后台运行，使用下面的命令替代：
# node web_server.js > web_server.log 2>&1 &
# echo "✅ 服务器已在后台启动，查看日志：tail -f web_server.log"