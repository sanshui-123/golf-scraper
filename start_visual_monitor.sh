#!/bin/bash

# 自动可视化监控启动脚本
# 程序启动后自动打开浏览器显示监控界面，用户无需输入任何命令！

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
cat << "EOF"
██╗   ██╗██╗███████╗██╗   ██╗ █████╗ ██╗     
██║   ██║██║██╔════╝██║   ██║██╔══██╗██║     
██║   ██║██║███████╗██║   ██║███████║██║     
╚██╗ ██╔╝██║╚════██║██║   ██║██╔══██║██║     
 ╚████╔╝ ██║███████║╚██████╔╝██║  ██║███████╗
  ╚═══╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
                                              
    🎨 全自动可视化监控系统
EOF
echo -e "${NC}"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🎯 启动模式: 全自动可视化监控${NC}"
echo -e "${CYAN}✨ 特性: 无需输入任何命令，自动显示！${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 函数：检查依赖
check_dependencies() {
    echo -e "${YELLOW}🔍 检查系统依赖...${NC}"
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi
    
    # 检查npm包
    if [ ! -d "node_modules/ws" ]; then
        echo -e "${YELLOW}📦 安装WebSocket依赖...${NC}"
        npm install ws > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ WebSocket依赖安装成功${NC}"
        else
            echo -e "${RED}❌ WebSocket依赖安装失败${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ WebSocket依赖已安装${NC}"
    fi
}

# 函数：停止现有服务
stop_existing_services() {
    echo -e "${YELLOW}🔄 停止现有Web服务器...${NC}"
    
    # 停止端口8080上的所有服务
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    
    # 等待端口释放
    sleep 2
    
    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 函数：启动可视化监控服务器
start_visual_server() {
    echo -e "${YELLOW}🚀 启动可视化监控服务器...${NC}"
    
    # 后台启动服务器
    nohup node visual_monitor_server.js > visual_monitor.log 2>&1 &
    local server_pid=$!
    
    echo -e "${GREEN}✅ 监控服务器已启动 (PID: $server_pid)${NC}"
    echo "$server_pid" > visual_monitor.pid
    
    # 等待服务器完全启动
    echo -e "${YELLOW}⏳ 等待服务器启动完成...${NC}"
    sleep 5
    
    # 检查服务器是否正常运行
    if curl -s --max-time 3 http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 监控服务器运行正常${NC}"
        return 0
    else
        echo -e "${RED}❌ 监控服务器启动失败${NC}"
        return 1
    fi
}

# 函数：启动批处理系统
start_batch_system() {
    echo -e "${YELLOW}🔄 启动批处理系统...${NC}"
    
    # 检查是否已经有批处理进程运行
    if pgrep -f "batch_process_articles.js" > /dev/null; then
        echo -e "${GREEN}✅ 批处理系统已在运行${NC}"
        return 0
    fi
    
    # 启动批处理系统
    if [ -f "start_batch_process_only.sh" ]; then
        nohup ./start_batch_process_only.sh > batch_startup.log 2>&1 &
        echo -e "${GREEN}✅ 批处理系统已启动${NC}"
    else
        echo -e "${YELLOW}⚠️ 批处理启动脚本未找到，请手动启动${NC}"
    fi
    
    sleep 2
}

# 函数：自动打开浏览器
open_browser() {
    echo -e "${YELLOW}🌐 自动打开监控界面...${NC}"
    
    local url="http://localhost:8080"
    
    # 检测操作系统并打开浏览器
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "$url"
        echo -e "${GREEN}✅ 已在默认浏览器中打开监控界面${NC}"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v xdg-open &> /dev/null; then
            xdg-open "$url"
            echo -e "${GREEN}✅ 已在默认浏览器中打开监控界面${NC}"
        elif command -v google-chrome &> /dev/null; then
            google-chrome "$url"
            echo -e "${GREEN}✅ 已在Chrome中打开监控界面${NC}"
        elif command -v firefox &> /dev/null; then
            firefox "$url"
            echo -e "${GREEN}✅ 已在Firefox中打开监控界面${NC}"
        else
            echo -e "${YELLOW}⚠️ 无法自动打开浏览器，请手动访问: $url${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ 无法识别操作系统，请手动访问: $url${NC}"
    fi
}

# 函数：显示使用信息
show_usage_info() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🎉 可视化监控系统启动完成！${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${GREEN}📊 监控界面: http://localhost:8080${NC}"
    echo -e "${GREEN}📈 实时更新: 每5秒自动刷新${NC}"
    echo -e "${GREEN}🔌 WebSocket: 实时推送状态${NC}"
    echo ""
    echo -e "${CYAN}🎯 界面功能:${NC}"
    echo -e "  ✅ 实时进程状态监控"
    echo -e "  ✅ 文章处理进度显示"
    echo -e "  ✅ 可视化进度条和图表"
    echo -e "  ✅ 最新文章列表展示"
    echo -e "  ✅ 实时日志流显示"
    echo -e "  ✅ 系统健康状态指示"
    echo ""
    echo -e "${PURPLE}💡 使用提示:${NC}"
    echo -e "  • 界面会自动刷新，无需手动操作"
    echo -e "  • 所有状态信息实时更新"
    echo -e "  • 绿色表示正常，红色表示故障"
    echo -e "  • 可以同时在多个浏览器窗口查看"
    echo ""
    echo -e "${BLUE}🛠️ 管理命令:${NC}"
    echo -e "  查看服务器日志: tail -f visual_monitor.log"
    echo -e "  重启监控系统: $0"
    echo -e "  停止所有服务: ./stop_all_services.sh"
    echo ""
}

# 函数：创建停止脚本
create_stop_script() {
    cat > stop_all_services.sh << 'EOF'
#!/bin/bash
echo "🛑 停止所有监控服务..."

# 停止可视化监控服务器
if [ -f "visual_monitor.pid" ]; then
    local pid=$(cat visual_monitor.pid)
    kill $pid 2>/dev/null && echo "✅ 可视化监控服务器已停止"
    rm -f visual_monitor.pid
fi

# 停止端口8080上的服务
lsof -ti:8080 | xargs kill -9 2>/dev/null

# 停止批处理相关服务
pkill -f "batch_process_articles.js" 2>/dev/null
pkill -f "auto_recovery.js" 2>/dev/null
pkill -f "enhanced_health_monitor.js" 2>/dev/null

echo "🎉 所有服务已停止"
EOF
    
    chmod +x stop_all_services.sh
}

# 函数：启动后台监控
start_background_monitoring() {
    echo -e "${YELLOW}🔍 启动后台健康监控...${NC}"
    
    # 启动增强健康监控（如果存在）
    if [ -f "enhanced_health_monitor.js" ]; then
        if ! pgrep -f "enhanced_health_monitor.js" > /dev/null; then
            nohup node enhanced_health_monitor.js > enhanced_monitor_bg.log 2>&1 &
            echo -e "${GREEN}✅ 后台健康监控已启动${NC}"
        else
            echo -e "${GREEN}✅ 后台健康监控已在运行${NC}"
        fi
    fi
}

# 主要启动流程
main() {
    echo -e "${CYAN}开始启动全自动可视化监控系统...${NC}"
    echo ""
    
    # 1. 检查依赖
    check_dependencies
    echo ""
    
    # 2. 停止现有服务
    stop_existing_services
    echo ""
    
    # 3. 启动可视化监控服务器
    if start_visual_server; then
        echo ""
        
        # 4. 启动批处理系统
        start_batch_system
        echo ""
        
        # 5. 启动后台监控
        start_background_monitoring
        echo ""
        
        # 6. 自动打开浏览器
        open_browser
        echo ""
        
        # 7. 创建停止脚本
        create_stop_script
        
        # 8. 显示使用信息
        show_usage_info
        
        # 9. 保持脚本运行并显示实时状态
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}📊 实时系统状态概览${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""
        
        # 循环显示简要状态
        local counter=0
        while true; do
            counter=$((counter + 1))
            
            echo -e "${BLUE}[$(date '+%H:%M:%S')] 状态检查 #$counter:${NC}"
            
            # 检查Web服务器
            if curl -s --max-time 2 http://localhost:8080 > /dev/null 2>&1; then
                echo -e "  🌐 ${GREEN}监控界面: 运行正常${NC}"
            else
                echo -e "  🌐 ${RED}监控界面: 连接失败${NC}"
            fi
            
            # 检查批处理进程
            if pgrep -f "batch_process_articles.js" > /dev/null; then
                echo -e "  🚀 ${GREEN}批处理系统: 运行中${NC}"
            else
                echo -e "  🚀 ${YELLOW}批处理系统: 已停止${NC}"
            fi
            
            # 检查今日文章数
            local today=$(date "+%Y-%m-%d")
            if [ -d "golf_content/$today/wechat_ready" ]; then
                local article_count=$(ls golf_content/$today/wechat_ready/*.md 2>/dev/null | wc -l | tr -d ' ')
                echo -e "  📰 ${CYAN}今日文章: $article_count 篇${NC}"
            else
                echo -e "  📰 ${CYAN}今日文章: 0 篇${NC}"
            fi
            
            echo -e "  💡 ${GREEN}监控界面: http://localhost:8080${NC}"
            echo ""
            
            sleep 30  # 30秒更新一次
        done
        
    else
        echo -e "${RED}❌ 监控服务器启动失败，请检查日志文件${NC}"
        echo -e "${YELLOW}📋 日志文件: visual_monitor.log${NC}"
        exit 1
    fi
}

# 捕获中断信号
trap 'echo -e "\n${YELLOW}📴 用户中断，保持服务运行${NC}"; echo -e "${GREEN}💡 服务继续在后台运行，访问 http://localhost:8080${NC}"; exit 0' INT

# 执行主流程
main "$@"