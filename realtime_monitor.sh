#\!/bin/bash

# 实时监控脚本 - 替代Web界面
clear

while true; do
    clear
    echo "════════════════════════════════════════════════════"
    echo "📊 高尔夫内容处理 - 实时监控面板"
    echo "⏰ 更新时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "════════════════════════════════════════════════════"
    
    # 检查进程状态
    echo -e "\n🔄 进程状态:"
    if ps aux | grep -q "[b]atch_process_articles_temp.js"; then
        pid=$(ps aux | grep "[b]atch_process_articles_temp.js" | awk '{print $2}')
        echo "   ✅ 批处理进程运行中 (PID: $pid)"
    else
        echo "   ❌ 批处理进程未运行"
    fi
    
    if ps aux | grep -q "[w]eb_server.js"; then
        echo "   ✅ Web服务器运行中"
    else
        echo "   ⚠️  Web服务器未运行"
    fi
    
    # 处理进度
    echo -e "\n📈 处理进度:"
    if [ -f batch_vpn.log ]; then
        # 获取最新的处理进度
        current=$(tail -100 batch_vpn.log | grep -E "处理第.*篇文章" | tail -1 | grep -oE "[0-9]+/[0-9]+" || echo "0/0")
        echo "   📄 当前进度: $current"
        
        # 获取成功/失败统计
        success=$(grep -c "处理完成（跳过）" batch_vpn.log 2>/dev/null || echo "0")
        failed=$(grep -c "处理失败" batch_vpn.log 2>/dev/null || echo "0")
        echo "   ✅ 成功: $success"
        echo "   ❌ 失败: $failed"
    else
        echo "   ⏳ 等待日志文件..."
    fi
    
    # 今日文章统计
    echo -e "\n📚 今日文章:"
    today=$(date +%Y-%m-%d)
    if [ -d "golf_content/$today/wechat_ready" ]; then
        count=$(ls golf_content/$today/wechat_ready/*.md 2>/dev/null | wc -l)
        echo "   📝 已生成: $count 篇"
        
        # 显示最新的3篇文章
        if [ $count -gt 0 ]; then
            echo "   🆕 最新文章:"
            ls -t golf_content/$today/wechat_ready/*.md 2>/dev/null | head -3 | while read file; do
                basename "$file" | sed 's/^/      - /'
            done
        fi
    else
        echo "   📁 暂无文章生成"
    fi
    
    # 最新日志
    echo -e "\n📋 最新日志:"
    if [ -f batch_vpn.log ]; then
        tail -5 batch_vpn.log | sed 's/^/   /'
    else
        echo "   暂无日志"
    fi
    
    echo -e "\n════════════════════════════════════════════════════"
    echo "💡 提示: 按 Ctrl+C 退出监控"
    
    # 每3秒刷新一次
    sleep 3
done
EOF < /dev/null