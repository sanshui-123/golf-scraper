#!/bin/bash
# 🚀 一键启动持续运行系统

echo "🚀 高尔夫文章处理系统 - 持续运行启动器"
echo "========================================"

# 检查PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚠️ PM2未安装，正在安装..."
    npm install -g pm2
    
    if [ $? -ne 0 ]; then
        echo "❌ PM2安装失败，请手动安装：npm install -g pm2"
        exit 1
    fi
fi

# 停止可能存在的旧进程
echo "🛑 停止旧进程..."
pm2 kill 2>/dev/null || true

# 启动PM2服务
echo "🚀 启动PM2管理的服务..."
pm2 start ecosystem.config.js

# 保存PM2配置
echo "💾 保存PM2配置..."
pm2 save

# 设置开机自启（可选）
echo ""
echo "❓ 是否设置开机自启动？(y/N)"
read -p "> " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 设置开机自启动..."
    pm2 startup
    echo ""
    echo "⚠️ 请复制上面的命令并运行以完成开机自启设置"
    echo ""
fi

# 显示状态
echo ""
echo "✅ 系统已启动！"
echo ""
pm2 list
echo ""
echo "📋 有用的命令："
echo "   查看状态: pm2 list"
echo "   查看日志: pm2 logs"
echo "   监控资源: pm2 monit"
echo "   Web界面: http://localhost:8080"
echo "   监控面板: http://localhost:8080/monitor"
echo ""
echo "💡 提示：使用 ./pm2_manager.sh 进行更多管理操作"