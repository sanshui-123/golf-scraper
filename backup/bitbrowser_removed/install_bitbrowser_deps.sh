#!/bin/bash

# 比特浏览器集成依赖安装脚本

echo "🚀 开始安装比特浏览器集成所需依赖..."
echo ""

# 检查是否安装了npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到npm，请先安装Node.js"
    echo "访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "📦 安装必要的npm包..."

# 安装axios（HTTP请求）
if ! npm list axios &> /dev/null; then
    echo "Installing axios..."
    npm install axios
else
    echo "✅ axios 已安装"
fi

# 安装ws（WebSocket）
if ! npm list ws &> /dev/null; then
    echo "Installing ws..."
    npm install ws
else
    echo "✅ ws 已安装"
fi

# 确保playwright已安装
if ! npm list playwright &> /dev/null; then
    echo "Installing playwright..."
    npm install playwright
else
    echo "✅ playwright 已安装"
fi

echo ""
echo "✅ 所有依赖安装完成！"
echo ""
echo "📋 下一步操作："
echo "1. 确保比特浏览器客户端已安装并启动"
echo "2. 在比特浏览器中创建多个配置文件"
echo "3. 运行测试: node test_bitbrowser_integration.js"
echo ""
echo "📖 查看详细文档: BITBROWSER_INTEGRATION_GUIDE.md"