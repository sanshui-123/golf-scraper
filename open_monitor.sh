#!/bin/bash

# 打开监控面板的脚本（VPN兼容版本）
echo "🌐 正在打开Golf Content监控面板..."
echo "================================"

# 检查Web服务器是否运行
if ps aux | grep -v grep | grep -q "web_server.js"; then
    echo "✅ Web服务器正在运行"
else
    echo "⚠️  Web服务器未运行，正在启动..."
    NO_PROXY="localhost,127.0.0.1,*.local" no_proxy="localhost,127.0.0.1,*.local" nohup node web_server.js > web_server.log 2>&1 &
    sleep 2
fi

# 测试API是否可访问
echo "🔍 测试API连接..."
if NO_PROXY="localhost,127.0.0.1,*.local" curl -s -f http://localhost:8080/api/system-progress > /dev/null; then
    echo "✅ API连接正常"
else
    echo "❌ API连接失败，请检查VPN设置"
fi

# 打开Dashboard
echo "🚀 打开Dashboard面板..."
open -a "Google Chrome" --args --proxy-bypass-list="localhost,127.0.0.1,*.local" "http://localhost:8080/dashboard"

echo ""
echo "================================"
echo "📌 提示："
echo "- 如果看到0%进度，请点击'智能启动'按钮"
echo "- 如果按钮无响应，请刷新页面（Cmd+R）"
echo "- Dashboard地址: http://localhost:8080/dashboard"
echo "================================"