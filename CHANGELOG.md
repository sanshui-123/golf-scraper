# 更新日志

## [2.3.0] - 2025-08-16 - AI检测预处理修复

### 🐛 Bug修复
- 修复AI检测预处理中Markdown图片处理Bug
- 修复图片标记`![描述](URL)`被错误处理为`!描述`的问题

### ✨ 改进
- 优化文本预处理逻辑，添加多余空行清理
- 提升AI检测准确率（降低7-9%虚高率）
- 改进手动检测指南文档

### 📝 文档
- 更新`manual_ai_detection_guide.md`
- 更新`CLAUDE.md`系统说明
- 创建`AI_DETECTION_FIX_SUMMARY.md`修复报告

### 🧪 测试
- 添加`test_ai_preprocessing_fix.js`测试脚本
- 所有预处理测试用例100%通过

## [2025-01-18] - MyGolfSpy完善支持

### 新增功能
- 🚀 添加MyGolfSpy RSS获取功能，支持获取最新文章列表
- 🖼️ 实现MyGolfSpy专用图片处理器，支持懒加载图片
- ⏱️ 动态超时设置，根据文章长度自动调整处理时间

### 优化改进
- 🐛 修复"Assignment to constant variable"错误
- 🖼️ 增强懒加载图片处理：
  - 慢速滚动触发图片加载
  - 手动触发data-lazy-src
  - 多次检查确保所有图片加载
- 🚫 改进弹窗处理策略：
  - 滚动过程中持续检测弹窗
  - 采用隐藏而非删除避免破坏页面
  - 支持延迟出现的弹窗处理
- 🔄 优化图片去重逻辑：
  - 基于文件名基础部分去重
  - 自动过滤小尺寸图片(300x210等)
- ⚡ 性能优化：
  - MyGolfSpy: 基础120秒+每KB增加20秒
  - 最大超时限制10分钟

### 测试结果
- ✅ 成功抓取所有懒加载图片（13/13）
- ✅ 4.8KB文章处理时间：71秒
- ✅ 5.9KB文章处理时间：81秒
- ✅ 弹窗处理成功率：100%

### 文件变更
- `batch_process_articles.js` - 修复const赋值错误，添加动态超时
- `site_specific_scrapers.js` - 增强MyGolfSpy抓取逻辑
- `mygolfspy_com_image_handler.js` - 新增专用图片处理器
- `process_mygolfspy_rss.js` - 新增RSS获取功能
- `image_processor_final.js` - 优化图片处理逻辑