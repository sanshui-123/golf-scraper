#!/bin/bash

echo "🛡️  启动VPN安全模式处理程序"
echo "═" | head -c 60 && echo

# 设置环境变量绕过代理
export NO_PROXY="localhost,127.0.0.1,*.local"
export no_proxy="localhost,127.0.0.1,*.local"
export VPN_COMPATIBLE_MODE=true

echo "✅ 已设置代理例外: $NO_PROXY"
echo "✅ 已启用VPN兼容模式"

# 1. 检查VPN兼容配置文件
if [ ! -f "vpn_compatible_config.json" ]; then
    echo "❌ VPN兼容配置文件不存在，请先创建配置文件"
    exit 1
fi

echo "✅ VPN兼容配置文件存在"

# 2. 使用smart_startup.js启动完整系统
echo "🚀 启动智能处理系统（VPN安全模式）..."
node smart_startup.js

echo "✅ VPN安全模式处理系统已启动"
echo "🌐 监控面板: http://localhost:8080"
echo "📝 注意: 所有网络请求都会绕过localhost代理，不会影响VPN使用"