# AI检测系统代理配置指南

## 背景说明
腾讯AI检测平台（matrix.tencent.com）对每个IP地址有每日20次的访问限制。为了突破这个限制，我们实现了代理轮换系统，通过多个代理IP来扩展检测容量。

## 系统架构

### 核心组件
1. **AI检测器** (`ai_content_detector.js`) - 执行AI文本检测
2. **代理管理器** (`proxy_rotation_manager.js`) - 管理代理池和轮换
3. **代理配置** (`proxy_config.json`) - 存储代理服务器信息
4. **状态追踪** (`proxy_status.json`) - 记录代理使用情况

### 工作原理
- 系统使用Round-Robin策略轮换代理
- 每个代理每日限制18次（留2次余量）
- 失败自动切换到下一个代理
- 每日00:00自动重置配额

## 代理配置方案

### 方案1：免费代理池（仅供测试）

**⚠️ 注意**：免费代理不稳定，不推荐生产环境使用

```json
{
  "proxies": [
    {
      "type": "direct",
      "host": "direct",
      "name": "直连（默认）"
    },
    {
      "type": "http",
      "host": "47.91.45.198",
      "port": 8080,
      "name": "免费HTTP代理1"
    },
    {
      "type": "http",
      "host": "103.152.112.162",
      "port": 80,
      "name": "免费HTTP代理2"
    },
    {
      "type": "socks5",
      "host": "174.64.199.79",
      "port": 4145,
      "name": "免费SOCKS5代理1"
    }
  ],
  "rotationStrategy": "round-robin",
  "dailyLimit": 18,
  "retryWithNextProxy": true,
  "proxyTestUrl": "https://matrix.tencent.com"
}
```

### 方案2：付费代理服务（推荐）

#### 易路代理（适合国内访问）
```json
{
  "proxies": [
    {
      "type": "http",
      "host": "tps.kdlapi.com",
      "port": 15818,
      "name": "易路代理-隧道1",
      "auth": {
        "user": "your_username",
        "pass": "your_password"
      }
    }
  ],
  "dailyLimit": 18,
  "retryWithNextProxy": true
}
```

#### 阿布云代理
```json
{
  "proxies": [
    {
      "type": "http",
      "host": "http-dyn.abuyun.com",
      "port": 9020,
      "name": "阿布云动态代理",
      "auth": {
        "user": "your_access_id",
        "pass": "your_access_key"
      }
    }
  ],
  "dailyLimit": 18,
  "retryWithNextProxy": true
}
```

### 方案3：多代理池配置（最优方案）

**建议配置10个代理，提供180次/天的检测容量**

```json
{
  "proxies": [
    {
      "type": "direct",
      "host": "direct",
      "name": "直连"
    },
    {
      "type": "http",
      "host": "proxy1.example.com",
      "port": 8080,
      "name": "付费代理1",
      "auth": {
        "user": "user1",
        "pass": "pass1"
      }
    },
    {
      "type": "http",
      "host": "proxy2.example.com",
      "port": 8080,
      "name": "付费代理2",
      "auth": {
        "user": "user2",
        "pass": "pass2"
      }
    },
    {
      "type": "http",
      "host": "proxy3.example.com",
      "port": 8080,
      "name": "付费代理3",
      "auth": {
        "user": "user3",
        "pass": "pass3"
      }
    },
    {
      "type": "http",
      "host": "proxy4.example.com",
      "port": 8080,
      "name": "付费代理4",
      "auth": {
        "user": "user4",
        "pass": "pass4"
      }
    },
    {
      "type": "http",
      "host": "proxy5.example.com",
      "port": 8080,
      "name": "付费代理5",
      "auth": {
        "user": "user5",
        "pass": "pass5"
      }
    }
  ],
  "rotationStrategy": "round-robin",
  "dailyLimit": 18,
  "retryWithNextProxy": true,
  "proxyTestUrl": "https://matrix.tencent.com",
  "resetTime": "00:00"
}
```

## 代理服务商推荐

### 国内代理服务商（适合访问腾讯）
1. **易路代理** (https://www.kuaidaili.com/)
   - 优势：国内老牌，稳定性高
   - 价格：按流量计费，适合小规模使用
   
2. **阿布云** (https://www.abuyun.com/)
   - 优势：动态IP池大，支持并发
   - 价格：包月套餐，性价比高
   
3. **讯代理** (https://www.xdaili.com/)
   - 优势：响应速度快，支持多协议
   - 价格：灵活计费方案
   
4. **小象代理** (https://www.xiaoxiangdaili.com/)
   - 优势：专注数据采集，成功率高
   - 价格：企业级服务

### 免费代理源（仅供测试）
- ProxyNova: https://www.proxynova.com/proxy-server-list/
- FreeProxyList: https://free-proxy-list.net/
- ProxyScrape: https://proxyscrape.com/free-proxy-list

## 配置步骤

### 1. 购买代理服务
- 选择"动态住宅代理"或"数据中心代理"
- 建议购买5-10个代理（提供90-180次/天检测容量）
- 确保代理支持HTTPS协议

### 2. 编辑配置文件
```bash
# 编辑代理配置
nano proxy_config.json

# 将购买的代理信息填入配置文件
```

### 3. 测试代理连接
```bash
# 测试单个代理
curl -x http://username:password@proxy.example.com:8080 https://matrix.tencent.com

# 运行代理管理器测试
node proxy_rotation_manager.js --test
```

### 4. 验证配置
```bash
# 查看代理状态
cat proxy_status.json

# 运行AI检测测试
node ai_content_detector.js "测试文本内容"
```

## 使用指南

### 启动AI检测
```bash
# 一键启动检测今日文章
./start_ai_detection.sh

# 或手动运行
node detect_today_articles.js
```

### 监控代理使用情况
```bash
# 查看代理状态文件
cat proxy_status.json

# 访问Web监控页面
http://localhost:8080/monitor
```

### 处理常见问题

#### 所有代理都失败
1. 检查网络连接
2. 验证代理服务是否过期
3. 测试代理是否能访问目标网站
4. 查看错误日志

#### 配额用尽
1. 添加更多代理到配置文件
2. 等待次日00:00自动重置
3. 手动重置：删除 proxy_status.json

#### 检测速度慢
1. 检查代理响应时间
2. 使用更快的代理服务
3. 调整请求间隔时间

## 容量规划

### 检测容量计算
- 每个代理：18次/天（保守估计）
- 5个代理：90次/天
- 10个代理：180次/天
- 20个代理：360次/天

### 建议配置
- 小规模（<50篇/天）：5个代理
- 中等规模（50-150篇/天）：10个代理
- 大规模（>150篇/天）：20个代理

## 高级功能

### 代理健康检查
系统自动执行以下检查：
- 连接测试（每次使用前）
- 响应时间监控
- 成功率统计
- 自动剔除失效代理

### 智能轮换策略
- Round-Robin：均匀分配（默认）
- Random：随机选择
- Weighted：基于成功率加权
- Least-Used：优先使用次数少的

### 统计和报告
Monitor页面提供：
- 每个代理的使用次数
- 成功/失败率
- 平均响应时间
- 剩余配额

## 安全注意事项

1. **保护代理凭证**
   - 不要将真实代理信息提交到公开仓库
   - 使用环境变量存储敏感信息
   - 定期更换代理密码

2. **访问控制**
   - 限制代理使用范围
   - 监控异常访问
   - 设置访问白名单

3. **合规使用**
   - 遵守代理服务条款
   - 不用于非法用途
   - 控制访问频率

## 故障排查

### 日志文件位置
- AI检测日志：控制台输出
- 代理状态：proxy_status.json
- 错误日志：检查控制台错误信息

### 调试命令
```bash
# 测试代理连接
node proxy_rotation_manager.js --test

# 强制重置代理状态
rm proxy_status.json

# 单独测试某个代理
curl -v -x http://proxy:port https://matrix.tencent.com
```

## 更新日志
- 2025-08-14：创建完整的代理配置指南
- 2025-08-13：实现代理轮换系统
- 2025-08-12：集成AI检测功能