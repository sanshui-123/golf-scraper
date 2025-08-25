# 高尔夫文章管理系统 - 服务器启动指南

## ⚠️ 重要提醒
**正确的服务器文件是：`web_server.js`**

## 启动命令
```bash
# 停止所有相关服务
pkill -f "node.*(view_server|web_server)"

# 启动正确的服务器
node web_server.js
```

## 文件说明
- `web_server.js` ✅ - **主服务器**（Express框架）
  - 文章标题可点击
  - 点击标题进入微信版
  - 只有原文链接和删除按钮

## 访问地址
http://localhost:8080

## 注意事项
- 如果端口被占用，服务器会自动寻找可用端口
- 查看日志：`tail -f web_server.log`