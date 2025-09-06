#!/bin/bash
# PM2 管理脚本 - 一键管理高尔夫文章处理系统

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查PM2是否安装
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}❌ PM2未安装${NC}"
        echo "请先安装PM2: npm install -g pm2"
        exit 1
    fi
}

# 显示菜单
show_menu() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${GREEN}高尔夫文章处理系统 - PM2管理${NC}"
    echo -e "${BLUE}================================${NC}"
    echo "1) 🚀 启动所有服务"
    echo "2) 🛑 停止所有服务"
    echo "3) 🔄 重启所有服务"
    echo "4) 📊 查看服务状态"
    echo "5) 📜 查看实时日志"
    echo "6) 🧹 清理日志"
    echo "7) 💾 保存PM2配置"
    echo "8) 🔧 设置开机自启"
    echo "9) 🎯 启动单个服务"
    echo "10) ❌ 退出"
    echo -e "${BLUE}================================${NC}"
}

# 启动所有服务
start_all() {
    echo -e "${GREEN}🚀 启动所有服务...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ 所有服务已启动${NC}"
}

# 停止所有服务
stop_all() {
    echo -e "${YELLOW}🛑 停止所有服务...${NC}"
    pm2 stop ecosystem.config.js
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
}

# 重启所有服务
restart_all() {
    echo -e "${YELLOW}🔄 重启所有服务...${NC}"
    pm2 restart ecosystem.config.js
    echo -e "${GREEN}✅ 所有服务已重启${NC}"
}

# 查看状态
show_status() {
    echo -e "${BLUE}📊 服务状态:${NC}"
    pm2 list
    echo ""
    echo -e "${BLUE}📈 资源使用:${NC}"
    pm2 monit
}

# 查看日志
show_logs() {
    echo -e "${BLUE}📜 选择查看哪个服务的日志:${NC}"
    echo "1) Web服务器"
    echo "2) 智能控制器"
    echo "3) URL生成器"
    echo "4) 健康监控器"
    echo "5) 所有日志"
    
    read -p "选择 (1-5): " log_choice
    
    case $log_choice in
        1) pm2 logs golf-web-server --lines 50 ;;
        2) pm2 logs golf-controller --lines 50 ;;
        3) pm2 logs golf-url-generator --lines 50 ;;
        4) pm2 logs golf-health-monitor --lines 50 ;;
        5) pm2 logs --lines 50 ;;
        *) echo -e "${RED}无效选择${NC}" ;;
    esac
}

# 清理日志
clean_logs() {
    echo -e "${YELLOW}🧹 清理PM2日志...${NC}"
    pm2 flush
    echo -e "${GREEN}✅ 日志已清理${NC}"
    
    # 运行日志清理脚本
    if [ -f "log_cleaner.js" ]; then
        echo -e "${YELLOW}🧹 运行日志清理脚本...${NC}"
        node log_cleaner.js
    fi
}

# 保存PM2配置
save_config() {
    echo -e "${BLUE}💾 保存PM2配置...${NC}"
    pm2 save
    echo -e "${GREEN}✅ 配置已保存${NC}"
}

# 设置开机自启
setup_startup() {
    echo -e "${BLUE}🔧 设置开机自启动...${NC}"
    
    # 检测系统类型
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        pm2 startup
        echo -e "${YELLOW}请复制上面的命令并运行以完成设置${NC}"
    else
        # Linux
        sudo pm2 startup systemd -u $USER --hp $HOME
        pm2 save
        echo -e "${GREEN}✅ 开机自启动已设置${NC}"
    fi
}

# 启动单个服务
start_single() {
    echo -e "${BLUE}🎯 选择要启动的服务:${NC}"
    echo "1) Web服务器"
    echo "2) 智能控制器"
    echo "3) URL生成器（立即运行一次）"
    echo "4) 健康监控器"
    
    read -p "选择 (1-4): " service_choice
    
    case $service_choice in
        1) pm2 start ecosystem.config.js --only golf-web-server ;;
        2) pm2 start ecosystem.config.js --only golf-controller ;;
        3) 
            echo -e "${YELLOW}立即运行URL生成...${NC}"
            node auto_scrape_three_sites.js --all-sites
            ;;
        4) pm2 start ecosystem.config.js --only golf-health-monitor ;;
        *) echo -e "${RED}无效选择${NC}" ;;
    esac
}

# 主程序
check_pm2

while true; do
    show_menu
    read -p "请选择操作 (1-10): " choice
    
    case $choice in
        1) start_all ;;
        2) stop_all ;;
        3) restart_all ;;
        4) show_status ;;
        5) show_logs ;;
        6) clean_logs ;;
        7) save_config ;;
        8) setup_startup ;;
        9) start_single ;;
        10) 
            echo -e "${GREEN}👋 再见！${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 无效选择，请重试${NC}"
            ;;
    esac
    
    echo ""
    read -p "按回车键继续..."
    clear
done