#!/bin/bash

# 性能监控脚本
clear
echo "📊 $200订阅性能监控面板"
echo "================================"

while true; do
    echo -e "\033[H\033[2J"  # 清屏
    echo "📊 $200订阅性能监控 - $(date)"
    echo "================================"
    
    # 显示处理进程
    echo -e "\\n🔧 活跃进程:"
    ps aux | grep -E "intelligent_concurrent" | grep -v grep | wc -l | xargs echo "控制器数量:"
    ps aux | grep -E "batch_process" | grep -v grep | wc -l | xargs echo "批处理进程:"
    
    # 显示今日文章数
    echo -e "\n📝 今日文章:"
    ls golf_content/$(date +%Y-%m-%d)/wechat_ready/ 2>/dev/null | wc -l | xargs echo "已完成:"
    
    # 显示URL统计
    echo -e "\n🔗 URL统计:"
    for f in deep_urls_*.txt; do
        if [ -f "$f" ]; then
            count=$(wc -l < "$f")
            site=$(echo $f | sed 's/deep_urls_//; s/.txt//')
            printf "%-20s: %3d
" "$site" "$count"
        fi
    done | head -5
    
    # 显示系统负载
    echo -e "\n💻 系统负载:"
    uptime | awk -F'load average:' '{print "负载: " $2}'
    
    echo -e "\n按 Ctrl+C 退出"
    sleep 5
done
