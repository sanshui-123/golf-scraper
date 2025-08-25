# MyGolfSpy FlareSolverr 抓取方案

## 概述
由于MyGolfSpy使用了强大的Cloudflare保护，我们集成了FlareSolverr作为专门的解决方案。这个方案：
- ✅ 只影响MyGolfSpy的抓取
- ✅ 其他网站继续使用原有方式
- ✅ 完全兼容现有系统

## 安装和使用

### 1. 安装Docker（如果还没安装）
```bash
# macOS
brew install --cask docker
# 或访问 https://www.docker.com/get-started
```

### 2. 启动FlareSolverr服务
```bash
./start_flaresolverr.sh
```

### 3. 测试服务
```bash
node test_mygolfspy_flaresolverr.js
```

### 4. 正常使用
处理MyGolfSpy文章时，系统会自动使用FlareSolverr：
```bash
# 单篇文章
node process_single_article.js "https://mygolfspy.com/reviews/..."

# 批量处理
node batch_process_articles.js /tmp/mygolfspy_urls.txt
```

## 工作原理
1. 检测到MyGolfSpy URL时，优先使用FlareSolverr
2. FlareSolverr会自动处理Cloudflare挑战
3. 获取内容后，继续原有的改写和保存流程
4. 如果FlareSolverr失败，自动回退到Playwright方法

## 常见问题

### Q: Docker未安装
A: 请访问 https://www.docker.com/get-started 下载并安装Docker

### Q: FlareSolverr服务启动失败
A: 检查8191端口是否被占用：`lsof -i :8191`

### Q: 抓取仍然失败
A: 查看FlareSolverr日志：`docker logs -f flaresolverr`

## 服务管理
```bash
# 查看服务状态
docker ps | grep flaresolverr

# 查看日志
docker logs -f flaresolverr

# 停止服务
docker stop flaresolverr

# 重启服务
docker restart flaresolverr

# 删除服务
docker rm -f flaresolverr
```