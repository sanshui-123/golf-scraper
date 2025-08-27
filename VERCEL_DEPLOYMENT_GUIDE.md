# Vercel部署指南

## 🚀 快速部署步骤

### 1. 准备工作
确保你已经：
- 安装了Git
- 有GitHub账号
- 有Vercel账号（可以使用GitHub登录）

### 2. 提交代码到GitHub
```bash
# 初始化git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "准备Vercel部署"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/golf-scraper.git

# 推送到GitHub
git push -u origin main
```

### 3. 在Vercel部署

#### 方法1：通过Vercel网站
1. 访问 https://vercel.com
2. 点击 "New Project"
3. 导入你的GitHub仓库
4. 保持默认设置，点击 "Deploy"
5. 等待部署完成

#### 方法2：使用Vercel CLI
```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
vercel --prod
```

### 4. 配置环境变量（如需要）
在Vercel项目设置中添加需要的环境变量。

## 📋 项目结构说明

```
golf-scraper/
├── api/
│   └── index.js        # Vercel serverless函数入口
├── golf_content/       # 文章内容目录
├── vercel.json        # Vercel配置文件
├── package.json       # 项目依赖
└── web_server.js      # 原始服务器文件（本地开发用）
```

## 🔧 配置说明

### vercel.json配置
- `builds`: 定义如何构建项目
- `routes`: 定义路由规则
- `functions`: 配置函数超时等参数

### 访问部署的应用
部署成功后，你可以通过以下地址访问：
- Vercel提供的域名：`https://你的项目名.vercel.app`
- 自定义域名：在项目设置中配置

## 🐛 常见问题

### 1. 部署失败
- 检查package.json是否存在
- 确保所有依赖都在package.json中声明
- 查看Vercel的构建日志

### 2. 静态文件无法访问
- 确保golf_content目录包含在git仓库中
- 检查vercel.json的路由配置

### 3. API超时
- 默认超时时间是30秒
- 如需更长时间，需要升级Vercel账号

## 🎯 功能验证

部署成功后，访问以下路径验证功能：
- `/` - 主页
- `/articles/today` - 今日文章
- `/monitor` - 监控面板
- `/api/system-status` - API状态

## 📝 更新部署

每次推送到GitHub主分支后，Vercel会自动重新部署。

```bash
git add .
git commit -m "更新内容"
git push
```

## ⚠️ 注意事项

1. **数据持久化**：Vercel是无服务器平台，不支持本地文件系统的持久化存储
2. **并发限制**：免费版有并发请求限制
3. **冷启动**：函数可能有冷启动延迟

## 🆘 需要帮助？

如有问题，请查看：
- Vercel文档：https://vercel.com/docs
- 项目Issues：在GitHub仓库提交问题