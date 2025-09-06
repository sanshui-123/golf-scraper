#!/bin/bash

# 实时系统监控面板
clear

echo "📊 实时系统监控面板"
echo "按 Ctrl+C 退出"
echo ""

while true; do
    # 清屏并定位到顶部
    echo -e "\033[3;0H"
    
    echo "🕐 $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    
    # 显示控制器进程
    echo -e "\n🔧 控制器状态:"
    ps aux | grep -E "intelligent_concurrent" | grep -v grep | awk '{printf "   PID %-6s | CPU: %5s%% | MEM: %5s%% | 运行时间: %s\n", $2, $3, $4, $10}'
    CONTROLLER_COUNT=$(ps aux | grep -E "intelligent_concurrent" | grep -v grep | wc -l)
    echo "   总计: $CONTROLLER_COUNT 个控制器运行中"
    
    # 显示今日文章
    echo -e "\n📝 今日文章:"
    TODAY=$(date +%Y-%m-%d)
    if [ -d "golf_content/$TODAY/wechat_ready" ]; then
        ARTICLE_COUNT=$(ls golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | wc -l)
        echo "   已完成: $ARTICLE_COUNT 篇"
        
        # 显示最新的3篇文章
        if [ $ARTICLE_COUNT -gt 0 ]; then
            echo "   最新文章:"
            ls -t golf_content/$TODAY/wechat_ready/*.md 2>/dev/null | head -3 | while read file; do
                basename "$file" | sed 's/\.md$//' | xargs -I {} echo "     - {}"
            done
        fi
    else
        echo "   已完成: 0 篇"
    fi
    
    # 显示处理速度
    echo -e "\n⚡ 处理速度:"
    if [ -f "controller_logs/group1_"*.log ]; then
        RECENT_LOG=$(ls -t controller_logs/group1_*.log 2>/dev/null | head -1)
        if [ -f "$RECENT_LOG" ]; then
            SUCCESS_COUNT=$(grep -c "✅.*成功改写" "$RECENT_LOG" 2>/dev/null || echo 0)
            FAIL_COUNT=$(grep -c "❌.*失败" "$RECENT_LOG" 2>/dev/null || echo 0)
            echo "   最近成功: $SUCCESS_COUNT | 失败: $FAIL_COUNT"
        fi
    fi
    
    # 显示CPU和内存
    echo -e "\n💻 系统资源:"
    top -l 1 | grep "CPU usage" | awk '{print "   CPU: " $3 " " $4 " " $5}'
    top -l 1 | grep "PhysMem" | awk '{print "   内存: " $2 " used, " $6 " unused"}'
    
    # 显示错误（如果有）
    echo -e "\n⚠️ 最近错误:"
    if [ -f "controller_health.log" ]; then
        grep -E "❌|卡死|失败" controller_health.log | tail -3 | while read line; do
            echo "   $line" | cut -c1-80
        done
    else
        echo "   暂无错误"
    fi
    
    echo "═══════════════════════════════════════════════════════════════"
    
    sleep 5
done