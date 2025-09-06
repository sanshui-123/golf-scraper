#!/bin/bash

# 性能提醒脚本 - 快速显示关键性能规则
# 当AI助手建议增加控制器时立即运行此脚本

echo "🚨 ========== 性能关键提醒 ========== 🚨"
echo ""
echo "📊 实测数据："
echo "  • 1控制器 = API响应 10-20秒 ✅"
echo "  • 4控制器 = API响应 55-63秒 ❌"
echo "  • 性能下降 3-5倍！"
echo ""
echo "🔴 永久规定："
echo "  • 最多 1个 intelligent_concurrent_controller.js"
echo "  • 最多 2个 并发请求"
echo "  • $200订阅也不能改变这个限制"
echo ""
echo "📍 相关文档："
echo "  • CLAUDE.md 第5-17行"
echo "  • PERFORMANCE_CRITICAL_REMINDER.md"
echo ""
echo "✅ 正确命令：./safe_single_controller.sh"
echo "❌ 错误命令：run_multiple_controllers.sh"
echo ""
echo "🔧 当前状态："
./check_controllers.sh 2>/dev/null | grep -E "(当前运行|状态正常|警告)" || echo "检查脚本未找到"
echo ""
echo "记住：宁可慢，不可多！1个控制器是最优解。"
echo "======================================"