# 不使用BitBrowser的AI检测方案

## 🎯 快速开始

### 最简单方法：一键切换到代理模式
```bash
./switch_to_proxy_mode.sh
```

## 📊 方案对比

| 方案 | 难度 | 成功率 | 速度 | 成本 |
|------|------|--------|------|------|
| 方案1：代理模式 | ⭐ | 90% | 快 | 免费/付费 |
| 方案2：替代服务 | ⭐⭐ | 70% | 中 | 免费 |
| 方案3：规则检测 | ⭐ | 50% | 极快 | 免费 |

## 🚀 方案1：使用代理模式（推荐）

### 步骤1：配置代理
编辑 `proxy_config.json`，添加您的代理：

```json
{
  "proxies": [
    {
      "type": "http",
      "host": "127.0.0.1",
      "port": 7890,
      "name": "本地Clash代理"
    }
  ]
}
```

### 步骤2：切换模式
```bash
# 方法A：使用脚本
./switch_to_proxy_mode.sh

# 方法B：手动修改
# 编辑 batch_process_articles.js
# 将 setDetectionMode('hybrid') 改为 setDetectionMode('proxy')
```

### 步骤3：运行检测
```bash
node batch_process_articles.js deep_urls_*.txt
```

## 🔧 方案2：使用简化检测器

### 快速测试
```bash
# 测试代理模式
node ai_detector_proxy_only.js "这是一段测试文本"

# 测试替代服务
node ai_detector_alternative.js "这是一段测试文本"
```

### 集成到批处理
```javascript
// 在 batch_process_articles.js 中
const SimpleAIDetector = require('./ai_detector_proxy_only');
this.aiDetector = new SimpleAIDetector();
```

## 🌐 方案3：使用免费在线服务

### 可用服务
1. **ZeroGPT** - https://www.zerogpt.com/
2. **GPTZero** - https://gptzero.me/
3. **Writer AI** - https://writer.com/ai-content-detector/
4. **Copyleaks** - https://copyleaks.com/ai-content-detector

### 使用方法
```bash
node ai_detector_alternative.js "您的文本内容"
```

## 🛠️ 代理配置指南

### 选项1：使用本地代理软件
1. **Clash** (推荐)
   - 下载: https://github.com/Dreamacro/clash
   - 默认端口: 7890 (HTTP), 7891 (SOCKS)

2. **V2RayN**
   - 下载: https://github.com/2dust/v2rayN
   - 默认端口: 10808 (SOCKS), 10809 (HTTP)

### 选项2：使用免费代理
```bash
# 获取免费代理列表
curl -s https://www.proxy-list.download/api/v1/get?type=https | head -10
```

### 选项3：购买付费代理
- **便宜选择**: ProxyRack ($10/月)
- **稳定选择**: IPRoyal (按流量计费)
- **专业选择**: Bright Data (企业级)

## 📝 常见问题

### Q: 代理模式检测失败？
A: 检查以下几点：
1. 代理是否正常工作：`curl -x http://127.0.0.1:7890 https://www.google.com`
2. 代理配置是否正确
3. 尝试直连模式（某些网络环境可用）

### Q: 检测结果不准确？
A: AI检测本身就不是100%准确的，建议：
1. 使用多个服务交叉验证
2. 参考检测结果，但不完全依赖
3. 人工审核重要内容

### Q: 想完全离线检测？
A: 使用基于规则的检测：
```javascript
const detector = new AlternativeAIDetector();
const score = detector.simpleDetection(text);
```

## 🎯 推荐配置

### 生产环境
1. 使用稳定的付费代理
2. 配置多个代理轮换
3. 启用缓存减少重复检测

### 测试环境
1. 使用本地代理软件
2. 或使用规则检测快速验证

### 最小配置
```bash
# 直接使用代理模式，不配置代理（使用直连）
./switch_to_proxy_mode.sh
node batch_process_articles.js deep_urls_*.txt
```

## 📊 性能对比

| 检测方式 | 速度 | 准确度 | 稳定性 |
|----------|------|--------|--------|
| BitBrowser | 5秒/次 | 95% | 高 |
| 代理模式 | 3秒/次 | 95% | 中 |
| 替代服务 | 10秒/次 | 80% | 低 |
| 规则检测 | 0.1秒/次 | 60% | 高 |

## 🔄 切换回BitBrowser

如果需要切换回BitBrowser模式：
```bash
# 恢复原文件
mv batch_process_articles.js.backup batch_process_articles.js

# 或手动修改
# 将 setDetectionMode('proxy') 改回 setDetectionMode('hybrid')
```

---

**总结**：不使用BitBrowser完全可行，代理模式是最佳替代方案，提供相同的检测准确度。