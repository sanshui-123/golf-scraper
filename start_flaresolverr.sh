#!/bin/bash

# FlareSolverr启动脚本

echo "🚀 启动FlareSolverr服务..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    echo "访问 https://www.docker.com/get-started 下载Docker"
    exit 1
fi

# 检查Docker是否运行
if ! docker info &> /dev/null; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 停止并删除旧容器（如果存在）
docker stop flaresolverr 2>/dev/null
docker rm flaresolverr 2>/dev/null

# 启动FlareSolverr容器
echo "📦 拉取最新的FlareSolverr镜像..."
docker pull ghcr.io/flaresolverr/flaresolverr:latest

echo "🔧 启动FlareSolverr容器..."
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if curl -s http://localhost:8191/health > /dev/null; then
    echo "✅ FlareSolverr服务已成功启动！"
    echo "📍 服务地址: http://localhost:8191"
    echo ""
    echo "🔍 查看日志: docker logs -f flaresolverr"
    echo "🛑 停止服务: docker stop flaresolverr"
    echo ""
    echo "现在可以处理MyGolfSpy文章了！"
else
    echo "❌ FlareSolverr服务启动失败"
    echo "查看日志: docker logs flaresolverr"
    exit 1
fi