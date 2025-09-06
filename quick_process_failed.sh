#!/bin/bash

# 快速处理失败URL的脚本
# 从failed_urls_to_process文件中取前10个URL进行测试处理

echo "🚀 快速处理失败URL测试"
echo "========================"

# 创建测试文件，只包含前10个URL
head -10 failed_urls_to_process_1756716925338.txt > test_failed_urls.txt

echo "📋 准备处理以下10个测试URL:"
cat test_failed_urls.txt
echo ""

# 直接使用智能并发控制器处理
echo "🔄 启动智能并发控制器..."
node intelligent_concurrent_controller.js test_failed_urls.txt

echo "✅ 测试完成"