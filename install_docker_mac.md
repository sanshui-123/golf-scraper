# macOS Docker 安装指南

## 方法1：Docker Desktop（推荐）

1. 下载Docker Desktop for Mac（Apple Silicon版本）：
   https://desktop.docker.com/mac/main/arm64/Docker.dmg
   
2. 打开下载的 .dmg 文件
3. 将Docker拖到Applications文件夹
4. 启动Docker（从Applications文件夹或Launchpad）
5. 等待Docker启动完成（菜单栏会出现Docker图标）

## 方法2：使用Homebrew（需要先安装Homebrew）

如果您已经有Homebrew：
```bash
brew install --cask docker
```

## 验证安装

安装完成后，在终端运行：
```bash
docker --version
docker ps
```

## 启动FlareSolverr

Docker安装并启动后，运行：
```bash
./start_flaresolverr.sh
```

然后测试MyGolfSpy抓取：
```bash
node test_mygolfspy_flaresolverr.js
```