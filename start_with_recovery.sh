#!/bin/bash

# 🛡️ 带自动恢复的启动脚本
# 防断网、黑屏、进程中断

echo "🛡️ 启动带自动恢复的高尔夫内容处理系统..."

# 🌐 首先启动独立Web服务器
echo "🌐 启动独立Web服务器..."
if ! lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    ./start_web_server_only.sh
    echo "✅ 独立Web服务器已启动"
else
    echo "✅ Web服务器已在运行 (http://localhost:8080)"
fi
sleep 1

# 检查必要文件
if [ ! -f "batch_process_articles.js" ]; then
    echo "❌ 未找到 batch_process_articles.js"
    exit 1
fi

if [ ! -f "auto_recovery.js" ]; then
    echo "❌ 未找到 auto_recovery.js"
    exit 1
fi

# 查找URL文件
URL_FILES=(deep_urls_*.txt)
if [ ! -f "${URL_FILES[0]}" ]; then
    echo "❌ 未找到URL文件 (deep_urls_*.txt)"
    exit 1
fi

echo "✅ 找到URL文件: ${URL_FILES[@]}"

# 🎯 检查新URL生成标记
if [ -f "fresh_urls_flag.json" ]; then
    echo "🎯 检测到新URL生成标记，将强制处理所有新URL"
    echo "📋 系统将忽略历史状态，确保新URL被处理"
else
    echo "📋 使用常规状态检查模式"
fi

# 启动自动恢复监控（后台）
echo "🔄 启动自动恢复监控..."
node auto_recovery.js start > auto_recovery.log 2>&1 &
RECOVERY_PID=$!
echo "✅ 自动恢复监控已启动 (PID: $RECOVERY_PID)"

# 等待一秒确保监控启动
sleep 1

# 启动主处理程序
echo "🚀 启动主处理程序..."
echo "   URL文件: ${URL_FILES[@]}"
echo "   自动恢复: 已启用"
echo "   监控日志: auto_recovery.log"
echo ""

# 运行主程序
node batch_process_articles.js "${URL_FILES[@]}"

MAIN_EXIT_CODE=$?

# 主程序结束后的处理
if [ $MAIN_EXIT_CODE -eq 0 ]; then
    echo "✅ 主程序正常完成"
else
    echo "⚠️ 主程序异常退出，代码: $MAIN_EXIT_CODE"
    echo "🔄 自动恢复系统将继续监控..."
    echo "💡 查看日志: tail -f auto_recovery.log"
fi

echo ""
echo "📊 系统状态:"
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    WEB_STATUS="运行中 (独立进程)"
else
    WEB_STATUS="已停止"
fi
echo "   Web服务器: $WEB_STATUS"
echo "   主程序: 已结束"
echo "   自动恢复: 仍在运行 (PID: $RECOVERY_PID)"
echo "   恢复日志: auto_recovery.log"
echo ""
echo "🌐 Web界面访问:"
echo "   主页: http://localhost:8080"
echo "   监控面板: http://localhost:8080/dashboard"
echo ""
echo "💡 管理命令:"
echo "   查看恢复日志: tail -f auto_recovery.log"
echo "   停止恢复监控: kill $RECOVERY_PID"
echo "   停止Web服务器: pkill -f 'web_server.js'"
echo "   手动重启: node batch_process_articles.js ${URL_FILES[@]}"