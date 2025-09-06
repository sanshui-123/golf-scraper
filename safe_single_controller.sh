#!/bin/bash

# 安全的单控制器启动脚本
# 防止多控制器导致的性能问题

echo "🛡️ 安全启动单控制器模式"
echo "=" | tr = '=' | head -c 50 && echo

# 检查是否已有控制器运行
EXISTING=$(ps aux | grep "intelligent_concurrent_controller" | grep -v grep | wc -l)
if [ $EXISTING -gt 0 ]; then
    echo "⚠️  检测到已有控制器运行"
    echo "现有控制器进程："
    ps aux | grep "intelligent_concurrent_controller" | grep -v grep
    echo
    read -p "是否要终止现有控制器并启动新的？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "终止现有控制器..."
        ps aux | grep "intelligent_concurrent_controller" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
        sleep 2
    else
        echo "保留现有控制器，退出"
        exit 0
    fi
fi

# 启动单个控制器处理所有URL
echo "📋 收集所有URL文件..."
URL_FILES=$(ls deep_urls_*.txt 2>/dev/null | tr '\n' ' ')

if [ -z "$URL_FILES" ]; then
    echo "❌ 未找到URL文件，请先运行："
    echo "   node auto_scrape_three_sites.js --all-sites"
    exit 1
fi

echo "✅ 找到URL文件："
echo "$URL_FILES" | tr ' ' '\n' | sed 's/^/   - /'
echo

# 启动单控制器
LOG_FILE="single_controller_$(date +%Y%m%d_%H%M%S).log"
echo "🚀 启动单控制器处理所有网站"
echo "📝 日志文件: $LOG_FILE"

nohup node intelligent_concurrent_controller.js $URL_FILES > "$LOG_FILE" 2>&1 &
PID=$!

echo "✅ 控制器已启动 (PID: $PID)"
echo

# 性能提醒
echo "⚡ 性能优化提示："
echo "1. 单控制器模式可避免API过载"
echo "2. 最大并发数限制为2"
echo "3. API响应时间应保持在20秒以下"
echo

echo "📊 监控命令："
echo "   实时日志: tail -f $LOG_FILE"
echo "   查看进度: curl http://localhost:8080/monitor"
echo "   停止处理: kill $PID"