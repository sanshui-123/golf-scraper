#!/bin/bash
# 启动脚本 - 绕过代理设置

echo "🚀 启动高尔夫内容处理系统（无代理模式）"
echo "📋 设置环境变量以绕过localhost代理..."

# 设置环境变量绕过代理
export NO_PROXY="localhost,127.0.0.1,*.local"
export no_proxy="localhost,127.0.0.1,*.local"

# 显示当前代理设置
echo "✅ 代理例外设置: $NO_PROXY"

# 启动智能系统
echo "🎯 启动智能处理系统..."
node smart_startup.js

echo "✨ 系统启动完成！"
echo "🌐 监控面板: http://localhost:8080/dashboard"
echo "📝 如果按钮无响应，请检查浏览器代理设置"