#!/bin/bash

# 高尔夫文章处理系统 - 一键启动脚本

echo "======================================"
echo "高尔夫文章处理系统启动脚本"
echo "======================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未安装Node.js"
    echo "请先安装Node.js: https://nodejs.org/"
    exit 1
fi

# 检查环境变量
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️ 警告：未设置ANTHROPIC_API_KEY环境变量"
    echo "请设置: export ANTHROPIC_API_KEY='your-api-key'"
fi

# 检查并停止已运行的服务器
echo "正在检查已运行的服务器..."
if lsof -i :8080 > /dev/null 2>&1; then
    echo "发现8080端口被占用，正在停止..."
    pkill -f "node.*view_server.js" || true
    sleep 2
fi

# 启动查看服务器
echo "正在启动文章查看服务器..."
node view_server.js &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器是否成功启动
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ 服务器启动成功！"
    echo ""
    echo "======================================"
    echo "系统已就绪！"
    echo ""
    echo "📱 查看文章: http://localhost:8080"
    echo ""
    echo "🚀 处理新文章:"
    echo "   node start.js \"文章URL\""
    echo ""
    echo "⏹️  停止服务器: 按 Ctrl+C"
    echo "======================================"
    echo ""
    
    # 保持脚本运行
    wait $SERVER_PID
else
    echo "❌ 服务器启动失败"
    exit 1
fi