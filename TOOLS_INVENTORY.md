# 🛠️ 封装工具清单

## 一、核心处理工具

### 1. 文章处理主程序（原有）
- **文件**: `process_single_article_final.js`
- **功能**: 
  - 抓取指定URL的文章
  - 提取文章内容和图片
  - 调用Claude进行改写
  - 生成微信格式文章
- **使用**: `node process_single_article_final.js <URL>`

### 2. Claude改写器（原有）
- **文件**: `claude_rewriter_fixed.js`
- **功能**: 封装Claude API调用，改写文章内容
- **特点**: 已修复的稳定版本

### 3. 内容抓取器（原有）
- **文件**: `golf_content_daily_unlimited.js`
- **功能**: 从网站抓取文章内容和图片
- **特点**: 无限制版本，支持多图片

## 二、问题处理工具（新增）

### 1. Claude进程安全运行器
- **文件**: 
  - `claude_safe_runner.js` - 带调试输出版
  - `claude_safe_runner_quiet.js` - 静默版
- **功能**:
  - 自动清理卡住的Claude进程
  - 设置执行超时（默认2分钟）
  - 自动重试机制（最多2次）
  - 防止进程堆积
- **使用**: 
  ```bash
  node claude_safe_runner_quiet.js <输入文件> > <输出文件>
  ```

### 2. 卡住文章恢复工具
- **文件**: `handle_stuck_claude_article.js`
- **功能**:
  - 一键恢复Claude卡住的文章
  - 自动处理所有步骤（清理进程、重新改写、保存文章）
  - 更新发布日期
  - 处理图片映射
- **使用**: 
  ```bash
  node handle_stuck_claude_article.js <临时文件> <文章编号> [图片前缀]
  ```

### 3. 图片布局优化工具
- **文件**: `optimize_article_images.js`
- **功能**:
  - 检查文章图片布局问题
  - 自动将连续图片分散到相关段落
  - 智能匹配图片与内容
  - 支持单篇或批量优化
- **使用**:
  ```bash
  # 优化单篇
  node optimize_article_images.js 4
  
  # 优化所有
  node optimize_article_images.js --all
  ```

## 三、实用工具

### 1. 图片布局检查器
- **文件**: `post_process_image_layout.js`
- **功能**: 检查并报告图片布局问题
- **特点**: 可选的后处理步骤

### 2. 单次修复脚本
- **文件**: `fix_article_04_images.js`
- **功能**: 修复特定文章的图片顺序
- **特点**: 一次性使用，可作为参考

## 四、工作流程集成

### 完整处理流程
```bash
# 1. 正常处理文章
node process_single_article_final.js <URL>

# 2. 如果需要，优化图片布局
node optimize_article_images.js <文章编号>
```

### Claude卡住时的处理
```bash
# 使用一体化恢复工具
node handle_stuck_claude_article.js temp_prompt_xxx.txt 3
```

### 批量优化
```bash
# 优化今天所有文章的图片布局
node optimize_article_images.js --all
```

## 五、功能总结

### ✅ 已实现的功能

1. **文章自动处理**
   - URL → 抓取 → 改写 → 微信格式

2. **进程管理**
   - 防止Claude卡住
   - 自动清理僵尸进程
   - 超时保护

3. **图片优化**
   - 检测连续图片问题
   - 智能重新分布图片
   - 保持内容相关性

4. **错误恢复**
   - 一键恢复中断的处理
   - 保留所有已抓取数据

5. **批量操作**
   - 支持批量优化图片布局
   - 统一的文件管理

### 🎯 核心优势

1. **不修改原有封装** - 所有新功能都是独立工具
2. **灵活可选** - 每个工具都可以单独使用
3. **自动化程度高** - 最少的人工干预
4. **错误处理完善** - 各种异常情况都有对策

### 📋 使用建议

1. **日常使用**: 直接用 `process_single_article_final.js`
2. **遇到问题**: 用对应的修复工具
3. **质量检查**: 处理完运行图片优化工具
4. **批量处理**: 使用 `--all` 参数

## 六、文档清单

1. `CLAUDE_PROCESS_STUCK_SOLUTION.md` - Claude卡住处理方案
2. `HANDLE_STUCK_ARTICLE_GUIDE.md` - 卡住文章处理指南
3. `ENHANCED_WORKFLOW_GUIDE.md` - 增强版工作流程
4. `TOOLS_INVENTORY.md` - 本文档