# GitHub CLI 图形化安装指南 🚀

## 系统信息
- macOS 版本：15.6
- 系统架构：Apple Silicon (M1/M2/M3)

## 📥 第一步：下载安装包

### 下载链接（适用于你的 Mac）
🔗 **[点击这里下载 GitHub CLI for Apple Silicon](https://github.com/cli/cli/releases/latest/download/gh_2.63.2_macOS_arm64.pkg)**

或者手动访问：
```
https://github.com/cli/cli/releases/latest
```
选择文件：`gh_*_macOS_arm64.pkg`（约 30MB）

## 📦 第二步：安装步骤

1. **找到下载的文件**
   - 通常在"下载"文件夹中
   - 文件名类似：`gh_2.63.2_macOS_arm64.pkg`

2. **双击安装包**
   - 会弹出安装向导
   - 如果提示"无法打开"，右键点击选择"打开"

3. **按照向导安装**
   - 点击"继续"
   - 同意许可协议
   - 选择安装位置（默认即可）
   - 输入管理员密码
   - 等待安装完成

## ✅ 第三步：验证安装

打开终端（Terminal），运行：
```bash
gh --version
```

应该看到类似输出：
```
gh version 2.63.2 (2024-11-XX)
```

## 🔐 第四步：登录 GitHub

在终端运行：
```bash
gh auth login
```

选择：
1. GitHub.com
2. HTTPS
3. Login with a web browser
4. 复制显示的代码
5. 按 Enter 打开浏览器
6. 粘贴代码并授权

## 🎉 安装完成！

现在可以使用简化的推送命令了：
```bash
./push_with_gh.sh
```

## ❓ 常见问题

### 问题1：提示"无法验证开发者"
**解决**：系统偏好设置 → 安全性与隐私 → 点击"仍要打开"

### 问题2：找不到 gh 命令
**解决**：重启终端或运行 `source ~/.zshrc`

### 问题3：登录时浏览器没有自动打开
**解决**：手动打开 https://github.com/login/device 并输入验证码

## 📞 需要帮助？
如果遇到任何问题，请告诉我具体的错误信息！
EOF < /dev/null