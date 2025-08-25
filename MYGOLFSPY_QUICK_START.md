# MyGolfSpy快速开始指南

## 第一步：安装Docker（5分钟）
1. 下载Docker Desktop: https://desktop.docker.com/mac/main/arm64/Docker.dmg
2. 双击安装，拖到Applications
3. 启动Docker（从Applications文件夹）
4. 等待Docker图标出现在菜单栏

## 第二步：启动FlareSolverr（1分钟）
```bash
./start_flaresolverr.sh
```

## 第三步：测试抓取（立即）
```bash
node test_mygolfspy_flaresolverr.js
```

## 第四步：正常使用
```bash
# 单篇文章
node process_single_article.js "https://mygolfspy.com/reviews/..."

# 批量处理
node batch_process_articles.js /tmp/mygolfspy_urls.txt
```

---

**注意**：系统会自动检测MyGolfSpy URL并使用FlareSolverr处理，其他网站继续正常抓取。