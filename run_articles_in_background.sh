#!/bin/bash

# 后台运行文章处理脚本
echo "🚀 启动后台文章处理..."
echo "📋 日志文件: process_log.txt"
echo ""

# 确保日志文件存在
touch process_log.txt

# 后台运行，并将输出重定向到日志文件
nohup node process_remaining_articles.js > process_log.txt 2>&1 &

# 获取进程ID
PID=$!
echo "✅ 后台进程已启动 (PID: $PID)"
echo ""
echo "💡 使用以下命令查看进度："
echo "   tail -f process_log.txt"
echo ""
echo "💡 使用以下命令停止处理："
echo "   kill $PID"
echo ""
echo "💡 使用以下命令查看实时状态："
echo "   node monitor_progress.js"