# VPN/代理问题修复指南

## 问题描述
监控面板按钮无响应，原因是VPN/代理将localhost请求重定向到了错误的端口。

## 临时解决方案

### 方法1：浏览器设置（推荐）
1. 在浏览器中打开监控面板前，先关闭代理
2. 或者将 localhost 和 127.0.0.1 添加到代理例外列表

### 方法2：使用无代理模式
在Chrome中使用无痕模式，并禁用扩展：
```bash
open -a "Google Chrome" --args --incognito --disable-extensions http://localhost:8080/dashboard
```

### 方法3：修改系统代理设置
在系统偏好设置 > 网络 > 高级 > 代理中，添加以下地址到"忽略这些主机与域的代理设置"：
```
localhost, 127.0.0.1, *.local
```

## 永久解决方案

### 环境变量设置
在启动程序前设置环境变量：
```bash
export NO_PROXY=localhost,127.0.0.1
export no_proxy=localhost,127.0.0.1
node smart_startup.js
```

### 或创建启动脚本
```bash
#!/bin/bash
export NO_PROXY=localhost,127.0.0.1
export no_proxy=localhost,127.0.0.1
node smart_startup.js
```

## 测试方法
使用curl测试API是否正常：
```bash
# 绕过代理测试
curl --noproxy localhost http://localhost:8080/api/control/check-status

# 应该返回：
# {"success":true,"status":"...","details":{...}}
```

## 注意事项
- 使用VPN时，监控面板可能无法正常工作
- 建议在不需要VPN时关闭代理，或配置代理例外
- 如果必须使用VPN，请按照上述方法配置代理例外