# 🚀 立即部署到Vercel

## 步骤1：提交到GitHub

```bash
# 1. 初始化Git（如果还没有）
git init

# 2. 添加所有新文件
git add .

# 3. 提交更改
git commit -m "添加Vercel部署支持"

# 4. 添加远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/golf-scraper.git

# 5. 创建main分支并推送
git branch -M main
git push -u origin main
```

## 步骤2：部署到Vercel

### 方法A：通过网页（推荐）
1. 访问 https://vercel.com
2. 使用GitHub登录
3. 点击 "New Project"
4. 选择刚才推送的 `golf-scraper` 仓库
5. 保持所有默认设置
6. 点击 "Deploy"
7. 等待约1-2分钟

### 方法B：使用命令行
```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

## 步骤3：访问你的应用

部署成功后，Vercel会提供一个URL，格式类似：
- `https://golf-scraper-xxx.vercel.app`

点击这个链接即可访问你的应用！

## ✅ 验证部署

访问以下页面确认功能正常：
- 主页：`https://你的域名.vercel.app/`
- 文章列表：`https://你的域名.vercel.app/articles/example`
- 系统监控：`https://你的域名.vercel.app/monitor`

## 🔧 后续更新

每次更新代码后：
```bash
git add .
git commit -m "更新说明"
git push
```

Vercel会自动重新部署！

## ⚠️ 常见问题

### GitHub推送失败？
```bash
# 强制推送（谨慎使用）
git push -u origin main --force
```

### Vercel部署失败？
- 检查是否有语法错误
- 查看Vercel的构建日志
- 确保package.json存在

## 🎉 完成！

恭喜！你的高尔夫文章管理系统已经在线运行了！