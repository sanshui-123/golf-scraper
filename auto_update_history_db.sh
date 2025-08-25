#\!/bin/bash

# 自动更新历史数据库脚本
# 可以在cron中设置定期运行，或在批处理完成后调用

echo "🔄 开始自动更新历史数据库..."
echo "⏰ 时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 运行更新脚本
node update_history_db.js

# 检查是否成功
if [ $? -eq 0 ]; then
    echo "✅ 历史数据库更新成功"
else
    echo "❌ 历史数据库更新失败"
    exit 1
fi

# 清理临时文件
echo "🧹 清理临时文件..."
rm -f temp_batch_*.txt 2>/dev/null
rm -f deep_urls_*.txt.backup 2>/dev/null

echo "✨ 自动更新完成"
