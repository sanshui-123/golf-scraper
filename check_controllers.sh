#!/bin/bash

# 检查控制器数量脚本 - 防止性能问题
# 2025-09-06 创建

echo "=== 系统控制器检查 ==="

# 计算运行中的控制器数量
controller_count=$(ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep | wc -l)

echo "当前运行的控制器数量: $controller_count"

if [ $controller_count -eq 0 ]; then
    echo "✅ 状态正常：没有控制器运行"
elif [ $controller_count -eq 1 ]; then
    echo "✅ 状态正常：只有1个控制器运行（最优配置）"
else
    echo "❌ 警告：检测到 $controller_count 个控制器同时运行！"
    echo "⚠️  这会导致API响应时间从10-20秒飙升到60+秒！"
    echo "🔧 建议立即执行以下操作："
    echo "   1. 终止多余的控制器："
    echo "      ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep | awk '{print \$2}' | tail -n +2 | xargs kill"
    echo "   2. 使用安全启动脚本："
    echo "      ./safe_single_controller.sh"
    
    # 显示运行中的控制器进程
    echo ""
    echo "运行中的控制器进程："
    ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep
fi

# 检查批处理进程
batch_count=$(ps aux | grep -E 'node.*(batch_process|enhanced_batch|resilient_batch)' | grep -v grep | wc -l)
if [ $batch_count -gt 0 ]; then
    echo ""
    echo "批处理进程数量: $batch_count"
fi

# 计算总并发数（智能控制器自动管理批处理进程）
if [ $controller_count -gt 0 ]; then
    # 智能控制器模式：控制器会自动管理批处理进程，最多2个并发
    echo ""
    echo "并发模式：智能控制器自动管理"
    echo "批处理进程由控制器管理: $batch_count 个"
    echo "预计API并发请求数: 最多 2 个（由控制器自动控制）"
else
    # 独立批处理模式
    total_concurrent=$batch_count
    echo ""
    echo "并发模式：独立批处理"
    echo "预计API并发请求数: $total_concurrent"
    
    if [ $total_concurrent -gt 2 ]; then
        echo "⚠️  警告：并发数超过推荐值（最大2个）！"
        echo "📉 当前配置会导致处理速度严重下降！"
    fi
fi

echo ""
echo "💡 最佳配置：1个控制器 + 2个并发 = 最优性能"