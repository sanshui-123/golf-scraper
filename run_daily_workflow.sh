#!/bin/bash

# 日常工作流程脚本 - 智能判断是否需要生成URL
echo "🚀 日常启动工作流程"
echo "================================"

# 1. 检查今日是否已有URL
TODAY=$(date +%Y-%m-%d)
URL_COUNT=0
for f in deep_urls_*.txt; do
    if [ -f "$f" ]; then
        # 检查URL文件的修改时间是否是今天
        if [ "$(date -r "$f" +%Y-%m-%d)" = "$TODAY" ]; then
            URL_COUNT=$((URL_COUNT + 1))
        fi
    fi
done

# 2. 判断是否需要生成URL
if [ $URL_COUNT -gt 10 ]; then
    echo "✅ 今日已有 $URL_COUNT 个URL文件，跳过URL生成"
    SKIP_URL_GEN=true
else
    echo "⚠️ 今日URL文件较少（$URL_COUNT个），需要生成新URL"
    SKIP_URL_GEN=false
fi

# 3. 检查是否有进程在运行
CTRL_COUNT=$(ps aux | grep "intelligent_concurrent" | grep -v grep | wc -l)
if [ $CTRL_COUNT -gt 0 ]; then
    echo "🔍 发现 $CTRL_COUNT 个控制器正在运行"
    read -p "是否要停止它们并重新启动？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 停止现有控制器..."
        ./stop_all_controllers.sh
        sleep 2
    else
        echo "✅ 保持现有控制器继续运行"
        exit 0
    fi
fi

# 4. 确保Web服务器运行
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "▶️ 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 3
else
    echo "✅ Web服务器已在运行"
fi

# 5. 根据需要生成URL
if [ "$SKIP_URL_GEN" = false ]; then
    echo "🔗 生成新的URL..."
    node auto_scrape_three_sites.js --all-sites
else
    echo "⏭️ 跳过URL生成阶段"
fi

# 6. 选择启动方式
echo ""
echo "请选择启动方式："
echo "1) 🛡️ 安全模式（带健康监控）"
echo "2) ⚡ 快速模式（多控制器并行）"
echo "3) 🎯 单控制器模式（保守）"
echo "4) ❌ 退出"

read -p "选择 (1-4): " -n 1 -r
echo
echo

case $REPLY in
    1)
        echo "🏥 启动健康监控系统..."
        nohup node controller_health_monitor.js > health_monitor.log 2>&1 &
        echo $! > health_monitor.pid
        echo "✅ 健康监控已启动"
        ;;
    2)
        echo "⚡ 启动多控制器并行..."
        ./run_multiple_controllers.sh
        ;;
    3)
        echo "🎯 启动单控制器..."
        nohup node intelligent_concurrent_controller.js > single_controller.log 2>&1 &
        echo "✅ 单控制器已启动"
        ;;
    4)
        echo "👋 退出"
        exit 0
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "✅ 系统启动完成！"
echo ""
echo "📊 后续操作："
echo "   监控界面: http://localhost:8080/monitor"
echo "   实时监控: ./realtime_monitor.sh"
echo "   系统诊断: ./system_diagnosis.sh"
echo "   安全关闭: ./safe_shutdown.sh"