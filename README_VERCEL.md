# 高尔夫文章管理系统 - Vercel版本

## 🚀 快速开始

### 一键部署到Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/golf-scraper)

### 手动部署步骤

1. **Fork或克隆此仓库**
```bash
git clone https://github.com/你的用户名/golf-scraper.git
cd golf-scraper
```

2. **推送到你的GitHub**
```bash
git remote set-url origin https://github.com/你的用户名/golf-scraper.git
git push -u origin main
```

3. **在Vercel导入项目**
- 访问 [Vercel Dashboard](https://vercel.com/dashboard)
- 点击 "New Project"
- 导入你的GitHub仓库
- 点击 "Deploy"

## 📁 项目结构

```
/
├── api/
│   └── index.js          # Vercel serverless函数
├── golf_content/         # 文章内容目录
│   └── example/         # 示例文章
├── vercel.json          # Vercel配置
├── package.json         # 依赖配置
└── .vercelignore       # Vercel忽略文件
```

## 🌟 功能特点

- ✅ 在线查看高尔夫文章
- ✅ 系统状态监控
- ✅ 按日期浏览文章
- ✅ 响应式设计
- ✅ Serverless架构

## 🔗 访问地址

部署成功后，你可以通过以下地址访问：

- 主页: `https://你的项目名.vercel.app/`
- 今日文章: `https://你的项目名.vercel.app/articles/today`
- 系统监控: `https://你的项目名.vercel.app/monitor`
- API状态: `https://你的项目名.vercel.app/api/system-status`

## ⚙️ 本地开发

```bash
# 安装依赖
npm install

# 使用Vercel CLI本地运行
vercel dev

# 或使用原始服务器（端口8080）
node web_server.js
```

## 📝 注意事项

1. **文章存储**: 由于Vercel是无服务器平台，文章需要存储在Git仓库中或使用外部存储服务
2. **API限制**: 免费版有请求次数和执行时间限制
3. **静态文件**: golf_content目录下的文件会作为静态资源提供

## 🆘 故障排除

### 部署失败
- 检查 `vercel.json` 配置是否正确
- 确保所有依赖都在 `package.json` 中

### 文章无法显示
- 确保 `golf_content` 目录包含文章文件
- 检查文件路径是否正确

### API超时
- 默认超时30秒，复杂操作可能需要优化

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可

MIT License