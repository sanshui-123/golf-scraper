# AI检测差异调查报告

## 问题描述
用户发现自动AI检测结果与手动检测结果不一致。

## 调查发现

### 1. 文本预处理差异（根本原因）
系统在进行AI检测前会对文本进行预处理，平均移除7-9%的内容：

```javascript
// 当前系统的预处理逻辑
textContent = textContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');  // 移除图片占位符
textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // 移除链接格式
```

**具体影响：**
- `[链接文本](URL)` → `链接文本`
- `[IMAGE_1:描述]` → 空
- `![图片描述](URL)` → `!图片描述` ⚠️ （这是一个bug）

### 2. 数据真实性问题
- 37篇文章中，27篇使用模拟数据（检测时间都是08:00:45）
- 仅10篇可能是真实检测结果

### 3. 实际案例
以 `wechat_article_10086.md` 为例：
- 原始内容：1899字符
- 处理后内容：1733字符
- 差异：166字符（8.74%）

## 解决方案

### 立即解决（用户手动检测）
1. 使用生成的对比文件：
   - 查看 `*_comparison.txt` 文件
   - 复制【处理后内容】部分进行检测

2. 手动处理文本：
   - 移除所有 `[文本](链接)` 格式
   - 移除所有 `![描述](图片链接)` 格式
   - 移除所有 `[IMAGE_X:描述]` 格式

### 系统改进建议
修复 `batch_process_articles.js` 中的文本预处理：

```javascript
// 改进的预处理逻辑
textContent = textContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');      // 移除图片占位符
textContent = textContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');    // 完全移除Markdown图片
textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');   // 保留链接文本
textContent = textContent.replace(/\n\n\n+/g, '\n\n');               // 清理多余空行
```

## 验证工具
- `test_ai_detection_comparison.js` - 分析文本差异
- `verify_ai_detection.js` - 生成对比文件
- `fix_text_preprocessing.js` - 展示问题和解决方案

## 结论
自动检测和手动检测的差异主要由文本预处理造成。系统移除了Markdown格式，而用户手动检测时使用的是包含格式的原始文本。建议用户在手动检测时先进行相同的预处理，或直接使用系统生成的处理后文本。