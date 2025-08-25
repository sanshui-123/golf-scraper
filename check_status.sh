#\!/bin/bash

echo "════════════════════════════════════════════════════"
echo "📊 高尔夫内容处理 - 状态检查"
echo "⏰ $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════"

# 检查进程
echo -e "\n🔄 进程状态:"
batch_pid=$(ps aux | grep "[b]atch_process_articles_temp.js" | awk '{print $2}' | head -1)
if [ -n "$batch_pid" ]; then
    echo "   ✅ 批处理进程: 运行中 (PID: $batch_pid)"
    
    # 显示进程运行时间
    runtime=$(ps -p $batch_pid -o etime= | xargs)
    echo "   ⏱️  运行时间: $runtime"
else
    echo "   ❌ 批处理进程: 未运行"
fi

# 检查最新进度
echo -e "\n📈 处理进度:"
if [ -f batch_vpn.log ]; then
    # 获取当前处理的文章
    current=$(tail -50 batch_vpn.log | grep -E "处理第.*篇文章" | tail -1)
    if [ -n "$current" ]; then
        echo "   $current"
    fi
    
    # 统计成功和失败
    total=$(grep -c "处理第.*篇文章" batch_vpn.log 2>/dev/null || echo "0")
    success=$(grep -c "处理完成" batch_vpn.log 2>/dev/null || echo "0") 
    failed=$(grep -c "处理失败" batch_vpn.log 2>/dev/null || echo "0")
    
    echo "   📊 统计: 总计 $total | 成功 $success | 失败 $failed"
    
    # 计算成功率
    if [ $total -gt 0 ]; then
        rate=$(echo "scale=1; $success * 100 / $total" | bc)
        echo "   📈 成功率: $rate%"
    fi
fi

# 检查今日文章
echo -e "\n📚 今日文章:"
today=$(date +%Y-%m-%d)
if [ -d "golf_content/$today/wechat_ready" ]; then
    count=$(ls golf_content/$today/wechat_ready/*.md 2>/dev/null | wc -l)
    echo "   📝 已生成: $count 篇"
    
    if [ $count -gt 0 ]; then
        echo "   🆕 最新3篇:"
        ls -t golf_content/$today/wechat_ready/*.md 2>/dev/null | head -3 | while read file; do
            # 获取文件大小
            size=$(ls -lh "$file" | awk '{print $5}')
            name=$(basename "$file")
            echo "      - $name ($size)"
        done
    fi
else
    echo "   📁 目录不存在"
fi

# 最新错误
echo -e "\n⚠️  最新错误:"
if [ -f batch_vpn.log ]; then
    errors=$(grep -E "(错误|失败|Error|Failed)" batch_vpn.log | tail -3)
    if [ -n "$errors" ]; then
        echo "$errors" | sed 's/^/   /'
    else
        echo "   ✅ 暂无错误"
    fi
fi

echo "════════════════════════════════════════════════════"
