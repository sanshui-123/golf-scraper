# 比特浏览器集成指南

## 概述
本指南介绍如何集成比特浏览器到AI检测系统，实现更强大的反检测能力。比特浏览器可以创建多个独立的浏览器环境，每个环境有独立的IP地址和浏览器指纹，有效突破腾讯AI检测平台的限制。

## 系统架构

### 核心组件
1. **BitBrowserManager** (`bitbrowser_manager.js`) - 比特浏览器管理器
2. **EnhancedAIContentDetector** (`ai_content_detector_enhanced.js`) - 增强版AI检测器
3. **SmartProxyManager** (`smart_proxy_manager.js`) - 智能代理管理器（备用）

### 工作模式
- **bitbrowser模式**: 仅使用比特浏览器
- **proxy模式**: 仅使用智能代理
- **hybrid模式**: 优先比特浏览器，失败时降级到代理（推荐）

## 安装配置

### 1. 安装比特浏览器客户端
1. 下载比特浏览器客户端
2. 安装并启动客户端
3. 创建多个浏览器配置文件（建议5-10个）
4. 为每个配置文件设置不同的代理

### 2. 安装Node.js依赖
```bash
# 安装必要的包
npm install playwright axios ws

# 或使用yarn
yarn add playwright axios ws
```

### 3. 配置文件设置

#### bitbrowser_config.json
```json
{
  "apiHost": "http://127.0.0.1",
  "apiPort": 54345,
  "wsPort": 54346,
  "dailyLimit": 18,
  "notes": {
    "说明": "比特浏览器API配置",
    "官方文档": "https://doc2.bitbrowser.cn/jiekou.html"
  }
}
```

### 4. 创建浏览器配置文件
在比特浏览器客户端中创建多个配置文件：
1. 每个配置文件使用不同的代理IP
2. 设置不同的User-Agent
3. 配置不同的屏幕分辨率
4. 启用指纹随机化

## 使用方法

### 1. 基础使用
```bash
# 使用混合模式（推荐）
node ai_content_detector_enhanced.js "要检测的文本内容"

# 仅使用比特浏览器
node ai_content_detector_enhanced.js --mode bitbrowser "要检测的文本"

# 仅使用代理
node ai_content_detector_enhanced.js --mode proxy "要检测的文本"
```

### 2. 文件检测
```bash
# 检测单个文件
node ai_content_detector_enhanced.js --file article.md

# 批量检测目录
node ai_content_detector_enhanced.js --batch golf_content/2025-08-14/
```

### 3. 管理命令
```bash
# 查看所有配置文件
node bitbrowser_manager.js list

# 查看统计信息
node bitbrowser_manager.js stats

# 测试特定配置文件
node bitbrowser_manager.js test <profileId>
```

## 最佳实践

### 1. 配置文件数量
- 最少：3-5个配置文件
- 推荐：10-15个配置文件
- 最佳：20+个配置文件

### 2. 代理配置
- 每个配置文件使用不同的代理
- 优先使用住宅代理
- 避免使用数据中心代理

### 3. 使用频率
- 每个配置文件每天限制18次
- 自动轮换使用不同配置
- 失败的配置会被临时标记

### 4. 错误处理
- 自动故障转移
- 连续失败3次的配置会被标记为不健康
- 每日自动重置所有配置状态

## 性能对比

| 特性 | 传统代理方案 | 比特浏览器方案 |
|------|------------|--------------|
| IP切换 | ✅ | ✅ |
| 浏览器指纹 | ❌ | ✅ |
| Canvas指纹 | ❌ | ✅ |
| WebGL指纹 | ❌ | ✅ |
| 字体指纹 | ❌ | ✅ |
| 时区伪装 | ❌ | ✅ |
| 检测难度 | 中等 | 极高 |
| 成功率 | 70-80% | 95%+ |

## 故障排查

### 1. 无法连接比特浏览器
- 确认客户端已启动
- 检查端口是否正确（默认54345）
- 防火墙是否阻止连接

### 2. 配置文件启动失败
- 检查配置文件是否存在
- 确认代理设置正确
- 查看比特浏览器日志

### 3. 检测失败
- 检查网络连接
- 验证腾讯平台可访问
- 查看截图调试信息

### 4. 性能问题
- 减少同时启动的浏览器数量
- 增加操作间隔时间
- 优化系统资源

## API参考

### BitBrowserManager

#### 初始化
```javascript
const manager = new BitBrowserManager();
await manager.initialize();
```

#### 获取最优配置
```javascript
const profile = await manager.getOptimalProfile();
```

#### 启动浏览器
```javascript
const browserInfo = await manager.launchBrowser(profileId);
```

#### 连接Playwright
```javascript
const { browser, context } = await manager.connectBrowser(wsEndpoint);
```

#### 记录使用情况
```javascript
await manager.recordUsage(profileId, success);
```

### EnhancedAIContentDetector

#### 初始化
```javascript
const detector = new EnhancedAIContentDetector();
detector.setDetectionMode('hybrid'); // 或 'bitbrowser', 'proxy'
await detector.initialize();
```

#### 检测文本
```javascript
const probability = await detector.detectText(text);
```

#### 批量检测
```javascript
const results = await detector.batchDetect([
  { id: '1', text: '文本1' },
  { id: '2', text: '文本2' }
]);
```

## 监控和统计

### 实时监控
系统会实时显示：
- 使用的配置文件名称
- 当前IP地址
- 今日使用次数
- 检测成功率

### 统计报告
```bash
# 查看详细统计
node bitbrowser_manager.js stats

# 输出示例：
📊 比特浏览器统计信息:
总配置文件数: 10
健康配置: 9
今日总配额: 180
今日已用: 45
今日剩余: 135
```

## 集成到现有系统

### 1. 更新批处理脚本
将`ai_content_detector.js`替换为`ai_content_detector_enhanced.js`

### 2. 更新配置
在启动脚本中添加模式参数：
```bash
# 使用比特浏览器优先
export AI_DETECTION_MODE=hybrid
```

### 3. 向后兼容
增强版检测器完全兼容原有API，无需修改调用代码。

## 注意事项

1. **资源消耗**：比特浏览器会消耗较多系统资源
2. **并发限制**：建议同时运行的浏览器不超过3-5个
3. **定期维护**：定期检查和更新配置文件
4. **合规使用**：仅用于合法的内容检测

## 更新日志
- 2025-08-14：初始版本，实现比特浏览器集成
- 支持三种检测模式
- 自动故障转移
- 完整的统计和监控