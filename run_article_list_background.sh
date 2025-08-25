#!/bin/bash

# 后台运行文章列表处理脚本
echo "🚀 启动后台文章列表处理..."
echo "📋 将按顺序处理9篇文章"
echo "📋 日志文件: article_list_log.txt"
echo ""

# 确保日志文件存在
touch article_list_log.txt

# 后台运行，并将输出重定向到日志文件
nohup node process_article_list.js > article_list_log.txt 2>&1 &

# 获取进程ID
PID=$!
echo "✅ 后台进程已启动 (PID: $PID)"
echo ""
echo "💡 使用以下命令查看进度："
echo "   tail -f article_list_log.txt"
echo ""
echo "💡 使用以下命令停止处理："
echo "   kill $PID"
echo ""
echo "💡 查看处理状态："
echo "   grep '处理第' article_list_log.txt | tail -10"