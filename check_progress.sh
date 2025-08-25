#!/bin/bash

echo "📊 批处理进度监控"
echo "═══════════════════"

# 检查进程
if ps aux | grep -q "[b]atch_process_articles_temp.js"; then
    echo "✅ 批处理程序正在运行"
else
    echo "❌ 批处理程序未运行"
fi

# 显示最新进度
echo -e "\n📝 最新处理状态："
tail -20 batch_vpn.log | grep -E "(处理第|成功|失败|完成)" | tail -5

# 统计结果
echo -e "\n📈 处理统计："
today=$(date +%Y-%m-%d)
if [ -d "golf_content/$today/wechat_ready" ]; then
    count=$(ls golf_content/$today/wechat_ready/*.md 2>/dev/null | wc -l)
    echo "今日已生成文章: $count 篇"
else
    echo "今日暂无文章生成"
fi

echo -e "\n💡 查看实时日志: tail -f batch_vpn.log"