#!/bin/bash

echo "🛑 停止所有控制器进程"

# 读取所有PID文件
if [ -d "controller_logs" ]; then
    for pid_file in controller_logs/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                echo "停止进程 $pid"
                kill "$pid"
            fi
            rm "$pid_file"
        fi
    done
fi

# 确保清理所有相关进程
ps aux | grep -E 'intelligent_concurrent_controller.js' | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null

echo "✅ 所有控制器已停止"