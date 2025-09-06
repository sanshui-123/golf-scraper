#!/bin/bash

# $200订阅优化启动脚本
echo "🚀 $200订阅优化启动流程"
echo "================================"

# 1. 检查并启动Web服务器
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "▶️ 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 3
fi

# 2. 生成URL（使用更积极的参数）
echo "🔗 生成URL（增强模式）..."
node auto_scrape_three_sites.js --all-sites --aggressive

# 3. 启动多控制器并行处理
echo "🎯 启动多控制器并行处理..."
./run_multiple_controllers.sh

echo ""
echo "✅ 优化启动完成！"
echo ""
echo "📊 监控地址: http://localhost:8080/monitor"
echo "📝 查看日志: tail -f controller_logs/*.log"
