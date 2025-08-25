#!/bin/bash

# 🌐 独立Web服务器启动脚本
# 完全独立运行，不依赖批处理程序

echo "🌐 启动独立Web服务器..."

# 智能启动检测 - 只在服务器不健康时重启
check_server_health() {
    # 检查端口是否被占用
    if ! lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
        return 1  # 端口未占用，需要启动
    fi
    
    # 检查服务器是否响应正常
    if curl -s --connect-timeout 3 http://localhost:8080/ >/dev/null 2>&1; then
        return 0  # 服务器健康，无需重启
    else
        return 1  # 服务器不响应，需要重启
    fi
}

if check_server_health; then
    echo "✅ Web服务器已在端口8080正常运行"
    echo "📖 访问地址: http://localhost:8080"
    echo "📊 监控面板: http://localhost:8080/dashboard"
    echo ""
    echo "💡 管理命令:"
    echo "   查看日志: tail -f web_server.log"
    echo "   停止服务器: pkill -f 'web_server.js'"
    echo ""
    echo "🎯 跳过重启，保持现有服务器运行"
    exit 0
else
    echo "⚠️  检测到端口8080服务异常，重启Web服务器..."
    pkill -f "web_server.js" 2>/dev/null || true
    sleep 2
fi

# 检查必要文件
if [ ! -f "web_server.js" ]; then
    echo "❌ 未找到 web_server.js"
    exit 1
fi

# 启动Web服务器（完全独立运行）
echo "🚀 启动Web服务器..."
nohup node web_server.js > web_server.log 2>&1 &
WEB_PID=$!

# 等待服务器启动
sleep 3

# 验证服务器是否正常启动
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Web服务器启动成功 (PID: $WEB_PID)"
    echo "📖 访问地址: http://localhost:8080"
    echo "📊 监控面板: http://localhost:8080/dashboard"
    echo ""
    echo "💡 管理命令:"
    echo "   查看日志: tail -f web_server.log"
    echo "   停止服务器: kill $WEB_PID"
    echo "   或者: pkill -f 'web_server.js'"
    echo ""
    echo "🎯 Web服务器将持续运行，不受批处理程序影响"
else
    echo "❌ Web服务器启动失败，请检查日志："
    echo "   tail web_server.log"
    exit 1
fi