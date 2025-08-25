# 智能代理池管理系统使用说明

## 概述
智能代理池管理系统是基于原有`proxy_rotation_manager.js`的增强版本，专门为访问腾讯AI检测平台（https://matrix.tencent.com/ai-detect/）而设计。它提供了智能的代理管理功能，包括健康检查、动态优先级调整、故障转移等高级特性。

## 主要特性

### 1. 智能代理选择
- **优先级队列**：根据多个指标计算代理优先级，自动选择最优代理
- **评分算法**：综合考虑成功率(40%)、响应时间(30%)、可用配额(20%)、最近使用时间(10%)

### 2. 健康检查系统
- **定期检查**：每5分钟自动检查所有代理健康状态
- **实时监测**：访问腾讯AI检测平台，验证代理是否被封禁
- **健康评分**：0-100分评估每个代理的健康状况

### 3. 智能故障转移
- **错误分类**：自动识别网络错误、超时、封禁、配额用尽等错误类型
- **智能重试**：根据错误类型采取不同的重试策略
- **自动切换**：失败时立即切换到下一个最优代理

### 4. 自动剔除机制
- **剔除条件**：
  - 成功率低于30%
  - 连续失败超过5次
  - 响应时间超过10秒
  - 被平台永久封禁
- **黑名单管理**：自动将低质量代理加入黑名单

### 5. 详细统计分析
- **实时统计**：每个代理的请求数、成功率、平均响应时间等
- **历史分析**：保存完整的使用历史和分析数据
- **系统健康**：整体系统健康状态监控和告警

## 配置说明

### proxy_config.json 配置项
```json
{
  "smartConfig": {
    "enableSmartManagement": true,      // 启用智能管理
    "healthCheckInterval": 300000,      // 健康检查间隔（毫秒）
    "minSuccessRate": 0.3,             // 最低成功率
    "maxConsecutiveFailures": 5,       // 最大连续失败次数
    "maxResponseTime": 10000,          // 最大响应时间（毫秒）
    "targetUrl": "https://matrix.tencent.com/ai-detect/",  // 目标URL
    "testText": "测试文本"            // 测试用文本
  }
}
```

## 使用方法

### 1. 初始化
```javascript
const SmartProxyManager = require('./smart_proxy_manager');
const manager = new SmartProxyManager();
await manager.initialize();
```

### 2. 获取最优代理
```javascript
// 自动选择最优代理
const proxy = await manager.getOptimalProxy();

// 向后兼容：getNextProxy也会调用getOptimalProxy
const proxy = await manager.getNextProxy();
```

### 3. 记录使用结果
```javascript
// 成功
await manager.recordProxyUsage(proxy, true, responseTime);

// 失败
await manager.recordProxyUsage(proxy, false, 0, 'TIMEOUT');
```

### 4. 智能故障转移
```javascript
// 当代理失败时，获取替代代理
const newProxy = await manager.smartFailover(failedProxy, 'BLOCKED');
```

## 命令行工具

### 查看详细统计
```bash
node smart_proxy_manager.js stats
```
显示所有代理的详细统计信息，包括健康评分、成功率、响应时间等。

### 强制健康检查
```bash
node smart_proxy_manager.js health-check
```
立即执行一次健康检查，不等待定时器。

### 自动清理低质量代理
```bash
node smart_proxy_manager.js auto-clean
```
根据配置的阈值自动清理低质量代理。

### 从黑名单移除
```bash
node smart_proxy_manager.js remove-blacklist <proxyKey>
```
手动将代理从黑名单移除。

### 导出分析数据
```bash
node smart_proxy_manager.js export
```
导出完整的分析数据到JSON文件。

## 监控和告警

### 系统状态
- **HEALTHY**：系统正常
- **WARNING**：整体成功率低于50%
- **CRITICAL**：可用代理数少于3个

### 告警通知
系统会在以下情况自动发出控制台警告：
- 可用代理数量不足
- 整体成功率过低
- 代理被加入黑名单

## 数据文件

### 生成的文件
- `proxy_status.json`：代理使用状态
- `proxy_analytics.json`：详细分析数据
- `proxy_blacklist.json`：黑名单列表

### 数据备份
系统会自动保存所有统计数据，确保重启后能恢复状态。

## 性能优化建议

### 1. 代理配置
- 建议配置10个以上代理，确保高可用性
- 使用高质量付费代理，提高成功率
- 定期检查代理状态，及时替换失效代理

### 2. 参数调优
- 根据实际情况调整健康检查间隔
- 适当设置成功率阈值，平衡质量和可用性
- 调整响应时间限制，适应网络环境

### 3. 监控维护
- 定期查看统计报告
- 及时处理系统告警
- 导出分析数据进行深入分析

## 故障排查

### 所有代理都失败
1. 检查网络连接
2. 验证腾讯平台是否可访问
3. 检查代理配置是否正确
4. 查看黑名单是否过多

### 健康检查失败
1. 确认代理服务正常
2. 检查目标URL是否正确
3. 查看错误日志分析原因

### 性能下降
1. 检查代理响应时间
2. 清理低质量代理
3. 增加高质量代理

## 与AI检测系统集成

### 更新ai_content_detector.js
将原有的`ProxyRotationManager`替换为`SmartProxyManager`：
```javascript
const SmartProxyManager = require('./smart_proxy_manager');
// ... 
this.proxyManager = new SmartProxyManager();
```

### 利用智能故障转移
在检测失败时自动切换代理：
```javascript
if (error) {
    const errorType = this.categorizeError(error);
    const newProxy = await this.proxyManager.smartFailover(currentProxy, errorType);
    // 使用新代理重试
}
```

## 最佳实践

1. **定期维护**：每周检查一次代理健康状态
2. **及时更新**：发现新的优质代理及时添加
3. **数据分析**：定期导出分析数据，优化配置
4. **监控告警**：关注系统告警，及时处理问题
5. **备份配置**：定期备份proxy_config.json

## 更新日志
- 2025-08-14：初始版本发布
- 实现智能代理池管理所有核心功能
- 完全向后兼容原有系统