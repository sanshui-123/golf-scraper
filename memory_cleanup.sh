#!/bin/bash
# 高尔夫文章处理系统内存清理脚本
# 用于定期释放内存，优化系统性能

echo "=== 开始内存清理 ==="
echo "时间: $(date)"

# 1. 显示清理前的内存状态
echo -e "\n清理前内存状态:"
vm_stat | head -5

# 2. 清理7天前的日志文件
echo -e "\n清理旧日志文件..."
OLD_LOGS=$(find . -name "*.log" -mtime +7 | wc -l)
if [ $OLD_LOGS -gt 0 ]; then
    find . -name "*.log" -mtime +7 -exec rm {} \;
    echo "已删除 $OLD_LOGS 个旧日志文件"
else
    echo "没有需要清理的旧日志"
fi

# 3. 清理临时文件
echo -e "\n清理临时文件..."
TEMP_FILES=$(ls temp_*.txt 2>/dev/null | wc -l)
if [ $TEMP_FILES -gt 0 ]; then
    rm -f temp_*.txt
    echo "已删除 $TEMP_FILES 个临时文件"
else
    echo "没有临时文件需要清理"
fi

# 4. 压缩大型JSON文件的备份
echo -e "\n压缩备份文件..."
for file in failed_articles_*.json.bak; do
    if [ -f "$file" ] && [ ! -f "${file}.gz" ]; then
        gzip "$file"
        echo "已压缩: $file"
    fi
done

# 5. 清理超过30天的文章（可选，默认注释）
# echo -e "\n清理旧文章..."
# find golf_content -type f -mtime +30 -delete

# 6. 触发Node.js垃圾回收
echo -e "\n触发Node.js垃圾回收..."
WEB_PID=$(ps aux | grep "node web_server.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$WEB_PID" ]; then
    kill -USR1 $WEB_PID 2>/dev/null && echo "已向web_server.js发送垃圾回收信号"
fi

# 7. 系统缓存清理（需要sudo）
echo -e "\n清理系统缓存..."
echo "请运行: sudo purge"
echo "（需要管理员密码）"

# 8. 显示清理后的内存状态
echo -e "\n清理后内存状态:"
vm_stat | head -5
echo -e "\n交换内存使用:"
sysctl vm.swapusage

echo -e "\n=== 内存清理完成 ==="
echo "建议："
echo "1. 如果内存压力仍然很大，考虑重启batch_process进程"
echo "2. 定期运行此脚本（建议每天一次）"
echo "3. 监控内存使用情况：watch -n 60 'vm_stat | head -5'"