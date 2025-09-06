#!/bin/bash

echo "🛑 安全关闭系统"
echo "================"

# 1. 停止健康监控
if [ -f "health_monitor.pid" ]; then
    PID=$(cat health_monitor.pid)
    echo "停止健康监控 (PID: $PID)..."
    kill $PID 2>/dev/null
    rm health_monitor.pid
fi

# 2. 停止所有控制器
echo "停止所有控制器..."
./stop_all_controllers.sh

# 3. 可选：停止Web服务器
read -p "是否停止Web服务器？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "停止Web服务器..."
    ps aux | grep "node web_server.js" | grep -v grep | awk '{print $2}' | xargs -r kill
fi

echo "✅ 系统已安全关闭"