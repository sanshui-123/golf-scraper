# 代理配置指南

## 方案一：使用免费测试代理（仅用于测试）

### 免费SOCKS5代理资源
1. **获取免费代理列表**
   - https://www.proxy-list.download/SOCKS5
   - https://www.socks-proxy.net/
   - https://hidemy.io/en/proxy-list/?type=5

2. **选择代理时注意**
   - 选择延迟低的（<1000ms）
   - 选择匿名度高的（Elite或Anonymous）
   - 优先选择近地区的服务器

## 方案二：使用本地代理软件

### 1. Clash for Windows/Mac
```json
{
  "proxyType": "socks5",
  "host": "127.0.0.1",
  "port": 7890  // Clash默认SOCKS5端口
}
```

### 2. V2RayN/V2RayX
```json
{
  "proxyType": "socks5",
  "host": "127.0.0.1",
  "port": 10808  // V2Ray默认SOCKS5端口
}
```

### 3. Shadowsocks
```json
{
  "proxyType": "socks5",
  "host": "127.0.0.1",
  "port": 1080  // Shadowsocks默认端口
}
```

## 方案三：付费代理服务（推荐生产环境）

### 推荐服务商
1. **Bright Data** (原Luminati)
   - 住宅代理质量高
   - 支持SOCKS5
   - 价格：$15/GB起

2. **SmartProxy**
   - 性价比高
   - 支持多种协议
   - 价格：$75/月起

3. **IPRoyal**
   - 价格实惠
   - SOCKS5代理稳定
   - 价格：$7/GB起

## 在比特浏览器中配置

1. 打开比特浏览器客户端
2. 进入"浏览器管理"
3. 编辑配置文件
4. 在"代理设置"中：
   - 代理类型：选择SOCKS5
   - 代理主机：填入IP地址（不是"532"）
   - 代理端口：填入端口号
   - 如需认证，填入用户名密码

## 测试代理是否工作

配置后，在配置文件中打开浏览器，访问：
- https://www.whatismyip.com
- https://httpbin.org/ip

查看显示的IP是否为代理IP。