# GitHub 推送指南

由于代码库包含敏感信息，请按照以下步骤手动推送：

## 步骤 1: 设置 GitHub Token

```bash
export GITHUB_TOKEN="你的GitHub Personal Access Token"
```

## 步骤 2: 推送代码

```bash
# 推送到 GitHub（Token 会从环境变量读取）
git push https://sanshui-123:${GITHUB_TOKEN}@github.com/sanshui-123/golf-scraper.git fresh-main:main --force
```

## 步骤 3: 切换回主分支

```bash
git checkout fresh-main
git branch -D main
git branch -m main
```

## 注意事项

1. **不要**将 Token 直接写在命令中
2. **不要**将 Token 提交到代码库
3. 使用环境变量或 GitHub CLI 进行认证
4. 推送成功后，可以删除本地的 fresh-main 分支

## 备选方案：使用 GitHub CLI

如果已安装 GitHub CLI：

```bash
# 登录 GitHub
gh auth login

# 推送代码
git push origin fresh-main:main --force
```

## 当前状态

- 已创建新的分支 `fresh-main`，不包含历史记录和大文件
- 代码已准备好推送，只需要正确的认证方式
- 原始的 `main` 分支包含大文件历史，不建议使用