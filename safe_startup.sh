#!/bin/bash

# 安全的启动脚本 - 带健康监控
echo "🛡️ 安全启动系统（带健康监控）"
echo "================================"

# 1. 检查并停止旧进程
echo "🧹 清理旧进程..."
./stop_all_controllers.sh 2>/dev/null || true
sleep 2

# 2. 确保Web服务器运行
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "▶️ 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 3
fi

# 3. 生成URL
echo "🔗 生成URL..."
node auto_scrape_three_sites.js --all-sites

# 4. 启动健康监控（它会自动启动和管理所有控制器）
echo "🏥 启动健康监控系统..."
echo "   - 自动启动3个控制器组"
echo "   - 每30秒检查健康状态"
echo "   - 自动重启卡死的控制器"
echo ""

# 使用nohup在后台运行
nohup node controller_health_monitor.js > health_monitor.log 2>&1 &
echo $! > health_monitor.pid

echo "✅ 系统已启动！"
echo ""
echo "📊 监控命令："
echo "   Web界面: http://localhost:8080/monitor"
echo "   健康日志: tail -f controller_health.log"
echo "   控制器日志: tail -f controller_logs/*.log"
echo "   停止系统: ./safe_shutdown.sh"