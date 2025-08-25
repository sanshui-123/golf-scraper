# 【封装系统】最终版本说明 - 禁止修改，只能调用

## 一、核心封装文件（禁止修改）

### 1. article_rewriter_enhanced.js
- **功能**：增强版文章改写器
- **特性**：
  - 无重试机制（失败直接进行下一篇）
  - 单次超时180秒
  - 验证输出包含中文
  - 实时显示改写进度
- **状态**：✅ 已封装，禁止修改
- **更新**：
  - 2025-01-10 - 取消了重试机制，提高处理效率
  - 2025-01-10 - 添加了进度显示功能

### 2. image_processor_final.js  
- **功能**：图片下载和处理
- **特性**：
  - 下载重试3次
  - 单次超时15秒
  - 支持中英文占位符替换
- **状态**：✅ 已封装，禁止修改

### 3. batch_process_articles.js
- **功能**：批量处理文章主程序
- **特性**：
  - 全局去重检测
  - 自动文章编号
  - API失败处理
  - 并行抓取优化
- **状态**：✅ 已封装，禁止修改

### 4. global_duplicate_checker.js
- **功能**：全局去重检测器
- **特性**：
  - 扫描所有日期文件夹
  - 防止重复处理
  - 早期退出优化
- **状态**：✅ 已封装，禁止修改

### 5. api_failure_handler.js
- **功能**：API失败处理器
- **特性**：
  - 自动记录失败文章
  - 批量重试功能
  - 生成失败报告
- **状态**：✅ 已封装，禁止修改

## 二、用户配置文件（用户维护）

### golf_rewrite_prompt_turbo.txt
- **功能**：Claude改写提示词
- **维护者**：用户
- **注意**：用户可根据需要修改，但不要删除关键规则

## 三、使用方法（只能调用）

### 1. 处理单个URL
```bash
# 创建处理脚本
cat > process_single.js << 'EOF'
const BatchArticleProcessor = require('./batch_process_articles');
async function process() {
    const processor = new BatchArticleProcessor();
    await processor.processArticles(['YOUR_URL_HERE']);
}
process().catch(console.error);
EOF

# 运行
node process_single.js
```

### 2. 处理多个URL
```bash
# 创建URL列表
echo '["URL1", "URL2", "URL3"]' > urls.json

# 运行批处理
node run_batch_processor.js urls.json
```

### 3. API失败处理
```bash
# 查看失败报告
node api_failure_handler.js report

# 重试失败文章
node api_failure_handler.js retry

# 清除失败记录
node api_failure_handler.js clear
```

## 四、重要提醒

⚠️ **以下文件已封装，禁止修改，只能调用：**
1. article_rewriter_enhanced.js
2. image_processor_final.js  
3. batch_process_articles.js
4. global_duplicate_checker.js
5. api_failure_handler.js

✅ **可以创建新的调用脚本**
✅ **可以修改golf_rewrite_prompt_turbo.txt**
❌ **不要修改封装的核心文件**
❌ **不要直接编辑封装模块的代码**

## 五、串行处理方案（新增）

### 为什么需要串行处理？
- 批量并发处理容易导致Claude API超时
- 串行处理更稳定，成功率更高
- 已验证可连续处理7篇以上文章

### 新增文件（推荐使用）

#### 1. serial_article_processor.js
- **功能**：串行处理文章，一篇完成后再处理下一篇
- **特性**：
  - 完整保留所有图片处理功能
  - 完整使用golf_rewrite_prompt_turbo.txt提示词
  - 完整的网页展示格式
  - 每篇文章独立处理，互不影响
  - 自动等待2秒再处理下一篇
- **用法**：
```bash
# 处理单个或多个URL
node serial_article_processor.js URL1 URL2 URL3

# 示例
node serial_article_processor.js "https://www.golfmonthly.com/news/xxx"
```

#### 2. daily_golf_workflow_serial.js
- **功能**：每日工作流的串行处理版本
- **特性**：
  - 先运行golf_scanner_optimized.js扫描
  - 然后串行处理所有新文章
  - 生成工作流报告
- **用法**：
```bash
node daily_golf_workflow_serial.js
```

#### 3. batch_process_articles_serial.js
- **功能**：批量处理的串行版本
- **特性**：
  - 先进行全局去重
  - 然后串行处理新文章
- **用法**：
```bash
node batch_process_articles_serial.js URL1 URL2 URL3
```

### 推荐使用场景
1. **日常工作流**：使用 `daily_golf_workflow_serial.js`
2. **手动处理多篇**：使用 `serial_article_processor.js`
3. **需要去重时**：使用 `batch_process_articles_serial.js`

## 六、系统特性总结

1. **智能去重**：自动检测所有已处理文章，避免重复
2. **失败恢复**：API调用失败自动重试，不影响整体流程
3. **并行优化**：同时抓取多篇文章，提高效率
4. **串行处理**：新增串行处理方案，更稳定可靠
5. **自动编号**：防止文章覆盖，确保唯一性
6. **稳定可靠**：经过多次测试验证的封装系统

---

最后更新：2025-01-10
封装人：Claude
状态：最终版本，核心文件禁止修改，新增串行处理方案