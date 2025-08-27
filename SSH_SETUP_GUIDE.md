# 🔐 GitHub SSH 密钥设置指南（一劳永逸）

## 为什么选择 SSH？
- ✅ **永远不需要密码**：配置一次，永久使用
- ✅ **更安全**：密钥存储在本地，不会泄露
- ✅ **更快速**：推送拉取都是自动的
- ✅ **支持多账号**：可以配置多个 GitHub 账号

## 🚀 快速开始（5分钟完成）

### 第 1 步：运行配置脚本
```bash
./setup_github_ssh.sh
```

脚本会：
1. 生成 SSH 密钥对
2. 配置 SSH Agent
3. 复制公钥到剪贴板

### 第 2 步：在 GitHub 添加公钥

1. **打开 GitHub SSH 设置页面**
   ```
   https://github.com/settings/ssh/new
   ```

2. **填写表单**
   - **Title**: `Mac SSH Key (今天日期)`
   - **Key type**: `Authentication Key`
   - **Key**: 粘贴（Cmd+V）- 已在剪贴板

3. **点击** `Add SSH key` 绿色按钮

### 第 3 步：测试连接
```bash
ssh -T git@github.com
```

成功会显示：
```
Hi sanshui-123\! You've successfully authenticated, but GitHub does not provide shell access.
```

### 第 4 步：切换仓库到 SSH（重要！）
```bash
cd /Users/sanshui/Desktop/cursor
git remote set-url origin git@github.com:sanshui-123/golf-scraper.git
```

### 第 5 步：推送代码
```bash
git push origin main --force
```

## 🎉 完成！
从现在开始，所有 git 操作都不需要密码了！

## ❓ 常见问题

### 问题：密钥生成时要求输入密码
**答案**：直接按 Enter 跳过（不设置密码），这样更方便

### 问题：ssh -T 测试失败
**解决**：
1. 确认公钥已添加到 GitHub
2. 检查网络连接
3. 运行 `ssh-add -l` 查看密钥是否加载

### 问题：推送时仍要求密码
**解决**：确保已执行第 4 步，切换到 SSH URL

## 🔧 手动步骤（如果脚本有问题）

### 1. 生成密钥
```bash
ssh-keygen -t ed25519 -C "sanshui-123@github.com"
# 连按 3 次 Enter（使用默认路径，不设密码）
```

### 2. 启动 SSH Agent
```bash
eval "$(ssh-agent -s)"
```

### 3. 添加密钥
```bash
ssh-add ~/.ssh/id_ed25519
```

### 4. 复制公钥
```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

### 5. 添加到 GitHub
访问 https://github.com/settings/ssh/new 粘贴

## 📌 SSH vs HTTPS 对比

| 特性 | SSH | HTTPS |
|------|-----|-------|
| 需要密码 | ❌ 永不需要 | ✅ 每次都要 |
| 安全性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 配置难度 | 一次配置 | 无需配置 |
| 适用场景 | 长期使用 | 临时使用 |

## 🎯 下一步
运行 `./setup_github_ssh.sh` 开始配置！
EOF < /dev/null