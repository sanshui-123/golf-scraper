# Claude API调用失败处理指南

## 一、增强功能说明

### 1. 自动重试机制
- **重试次数**：3次
- **重试间隔**：10秒
- **单次超时**：180秒（3分钟）

### 2. 失败记录功能
所有API调用失败的文章会自动记录到 `failed_articles.json`

### 3. 批量重试功能
可以一次性重试所有失败的文章

## 二、处理流程

### 当API调用失败时

1. **系统会自动重试3次**
   ```
   🔄 第1次尝试Claude改写...
   ❌ 第1次尝试失败: API调用失败
   ⏳ 10秒后重试...
   🔄 第2次尝试Claude改写...
   ```

2. **如果3次都失败**
   - 文章会被跳过，继续处理其他文章
   - 失败信息会记录到 `failed_articles.json`
   - 程序不会中断，会完成其他文章的处理

### 查看失败报告

```bash
node api_failure_handler.js report
```

输出示例：
```
📊 API失败处理报告
==================

❌ 待重试文章 (2):
   1. https://www.golfmonthly.com/article1
      原因: API调用失败: rate limit exceeded
      尝试次数: 3
      最后尝试: 2025-01-10 14:45:32
```

### 批量重试失败的文章

```bash
# 生成重试URL列表
node api_failure_handler.js retry

# 系统会生成一个临时文件，例如：retry_urls_1736498732000.json
# 然后运行：
node run_batch_processor.js retry_urls_1736498732000.json
```

### 清除失败记录

```bash
node api_failure_handler.js clear
```

## 三、常见API失败原因

1. **Rate Limit（频率限制）**
   - 解决：等待一段时间后重试
   - 建议：批量处理时控制并发数

2. **Network Error（网络错误）**
   - 解决：检查网络连接
   - 系统会自动重试

3. **Timeout（超时）**
   - 原因：文章太长或网络慢
   - 解决：系统会自动重试

4. **API Error（API错误）**
   - 可能是临时服务问题
   - 解决：稍后重试

## 四、最佳实践

1. **定期检查失败报告**
   ```bash
   node api_failure_handler.js report
   ```

2. **批量重试失败文章**
   - 建议在网络状况好的时候进行
   - 可以在深夜或清晨重试

3. **监控处理过程**
   - 观察重试次数
   - 如果某篇文章总是失败，可能需要单独处理

## 五、手动处理单篇失败文章

如果某篇文章反复失败，可以单独处理：

```bash
# 创建单个URL的JSON文件
echo '["https://www.golfmonthly.com/problem-article"]' > single_retry.json

# 运行处理
node run_batch_processor.js single_retry.json
```

## 六、文件说明

- **article_rewriter_enhanced.js** - 增强版改写器（包含重试机制）
- **api_failure_handler.js** - API失败处理工具
- **failed_articles.json** - 失败文章记录（自动生成）

---

最后更新：2025-01-10