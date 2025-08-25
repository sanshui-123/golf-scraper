#!/bin/bash

# 停止处理进程脚本 - 不影响Web服务器

echo "🛑 停止处理进程..."

# 获取要停止的进程列表
PROCESSES=$(ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup|auto_scrape|discover|url_generator)' | grep -v grep | grep -v web_server)

if [ -z "$PROCESSES" ]; then
    echo "✅ 没有运行中的处理进程"
else
    echo "找到以下处理进程："
    echo "$PROCESSES" | awk '{print "  - " $11 " " $12 " (PID: " $2 ")"}'
    
    # 停止进程
    echo -e "\n正在停止..."
    echo "$PROCESSES" | awk '{print $2}' | xargs kill 2>/dev/null || true
    
    # 等待进程结束
    sleep 2
    
    # 检查是否还有残留进程
    REMAINING=$(ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup|auto_scrape|discover|url_generator)' | grep -v grep | grep -v web_server | wc -l)
    
    if [ $REMAINING -eq 0 ]; then
        echo "✅ 所有处理进程已停止"
    else
        echo "⚠️ 还有 $REMAINING 个进程未停止，尝试强制终止..."
        ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup|auto_scrape|discover|url_generator)' | grep -v grep | grep -v web_server | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        sleep 1
        echo "✅ 强制终止完成"
    fi
fi

# 显示Web服务器状态
echo -e "\n📊 系统状态："
if ps aux | grep "node.*web_server" | grep -v grep > /dev/null; then
    echo "✅ Web服务器运行中: http://localhost:8080"
else
    echo "❌ Web服务器未运行"
fi