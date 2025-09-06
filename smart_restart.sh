#!/bin/bash

# 智能重启脚本 - 只停止处理进程，保留Web服务器

echo "🔄 开始智能重启..."

# 1. 停止处理进程（不影响其他Node程序）
echo "📋 停止处理进程..."
ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup|auto_scrape)' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true

# 等待进程结束
sleep 2

# 2. 检查Web服务器（不存在时才启动）
echo "🌐 检查Web服务器..."
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "  ✅ 启动Web服务器..."
    nohup node web_server.js > web_server.log 2>&1 &
    sleep 3
else
    echo "  ✅ Web服务器已在运行"
fi

# 3. 检查BitBrowser客户端状态（可选但推荐）
echo "🔍 检查BitBrowser客户端..."
if node check_bitbrowser.js > /dev/null 2>&1; then
    echo "  ✅ BitBrowser客户端运行正常"
else
    echo "  ⚠️  BitBrowser客户端未运行或API服务未启用"
    echo "  💡 提示：启动BitBrowser客户端可获得更好的AI检测效果"
    echo "  📌 系统将使用降级模式继续运行..."
    sleep 2
fi

# 4. 检查是否有残留的控制器进程
echo "🔍 检查控制器状态..."
controller_count=$(ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep | wc -l)
if [ $controller_count -gt 0 ]; then
    echo "  ⚠️  发现 $controller_count 个残留控制器进程，正在终止..."
    ps aux | grep -E 'node.*intelligent_concurrent_controller' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true
    sleep 2
fi

# 5. 清理失败文章队列
echo "🧹 清理永久失败的文章..."
node intelligent_failure_filter.js 2>/dev/null || echo "  ⚠️  过滤器未运行"

# 6. 生成URL（18个网站）
echo "🔍 生成URL（18个网站）..."
node auto_scrape_three_sites.js --all-sites

# 7. 计算新URL数量
echo -e "\n📊 计算实际需要处理的新URL..."
node calculate_new_urls.js

# 8. 启动智能并发控制器（传递所有deep_urls文件）
echo -e "\n🚀 启动智能并发控制器..."
nohup node intelligent_concurrent_controller.js deep_urls_*.txt > intelligent_controller.log 2>&1 &

# 9. 等待并显示状态
sleep 3
echo -e "\n✅ 重启完成！"
echo "📝 查看进度: tail -f intelligent_controller.log"
echo "📊 查看文章: ls -la golf_content/$(date +%Y-%m-%d)/wechat_ready/"
echo "🌐 访问Web: http://localhost:8080"