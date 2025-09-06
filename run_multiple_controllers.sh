#!/bin/bash

# 多控制器并行处理脚本
# 利用$200订阅的高额度，不违反单控制器2并发限制

echo "🚀 启动多控制器并行处理（$200订阅优化）"
echo "=" | tr = '=' | head -c 50 && echo

# 创建日志目录
mkdir -p controller_logs

# 启动控制器函数
start_controller() {
    local urls=$1
    local name=$2
    local log_file="controller_logs/${name}_$(date +%Y%m%d_%H%M%S).log"
    
    echo "▶️ 启动控制器: $name"
    echo "   处理文件: $urls"
    echo "   日志文件: $log_file"
    
    nohup node intelligent_concurrent_controller.js "$urls" > "$log_file" 2>&1 &
    echo $! > "controller_logs/${name}.pid"
    
    echo "   PID: $!"
    echo
}

# 分组处理（每组2-3个网站）
echo "📊 网站分组处理策略："
echo "组1：Golf.com, Golf Monthly, MyGolfSpy"
echo "组2：GolfWRX, Golf Digest, Today's Golfer"
echo "组3：其他网站"
echo

# 启动第一组
if [ -f "deep_urls_golf_com.txt" ] || [ -f "deep_urls_golfmonthly_com.txt" ] || [ -f "deep_urls_mygolfspy_com.txt" ]; then
    start_controller "deep_urls_golf_com.txt deep_urls_golfmonthly_com.txt deep_urls_mygolfspy_com.txt" "group1"
fi

# 启动第二组
if [ -f "deep_urls_www_golfwrx_com.txt" ] || [ -f "deep_urls_www_golfdigest_com.txt" ] || [ -f "deep_urls_todays_golfer_com.txt" ]; then
    start_controller "deep_urls_www_golfwrx_com.txt deep_urls_www_golfdigest_com.txt deep_urls_todays_golfer_com.txt" "group2"
fi

# 启动第三组（剩余网站）
OTHER_FILES=$(ls deep_urls_*.txt 2>/dev/null | grep -v -E "(golf_com|golfmonthly|mygolfspy|golfwrx|golfdigest|todays_golfer)" | tr '\n' ' ')
if [ ! -z "$OTHER_FILES" ]; then
    start_controller "$OTHER_FILES" "group3"
fi

echo "✅ 所有控制器已启动"
echo
echo "📊 监控命令："
echo "   查看所有日志: tail -f controller_logs/*.log"
echo "   查看进程状态: ps aux | grep intelligent_concurrent"
echo "   停止所有控制器: ./stop_all_controllers.sh"
echo
echo "🌐 Web监控: http://localhost:8080/monitor"