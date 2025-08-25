# 高尔夫文章处理系统 - 备份说明

备份时间：2025-07-11 23:40:03

## 备份内容

### 核心文件
- `batch_process_articles.js` - 批量文章处理器
- `article_rewriter_enhanced.js` - Claude文章改写器
- `image_processor_final.js` - 图片处理器
- `website_duplicate_checker.js` - 重复检测器
- `api_failure_handler.js` - API失败处理器
- `view_server.js` - Web查看服务器
- `start.js` - 命令行启动脚本
- `golf_rewrite_prompt_turbo.txt` - Claude改写提示词

### 文档说明
- `工作流程说明.md` - 详细的系统工作流程
- `快速使用指南.md` - 用户快速上手指南
- `系统架构说明.md` - 技术架构详解
- `一键启动脚本.sh` - 便捷启动脚本

## 系统特性

### 已实现功能
✅ 自动抓取高尔夫文章内容
✅ 使用Claude API智能改写成中文
✅ 自动下载和管理文章图片
✅ 生成微信公众号适配格式
✅ 一键复制功能（文字+图片）
✅ 两级展开的文章管理界面
✅ 文章搜索和删除功能
✅ 去重检测避免重复处理
✅ 完整的错误处理机制

### 最新优化
- 修复了图片路径问题，使用绝对路径
- 优化了文章底部格式，只保留原文链接
- 改进了两级展开界面，更清晰的日期分组
- 增强了一键复制功能的兼容性

## 快速恢复指南

1. **恢复文件**
   ```bash
   cp -r system_backup_20250711_234003/* /Users/sanshui/Desktop/cursor/
   ```

2. **设置环境变量**
   ```bash
   export ANTHROPIC_API_KEY='your-api-key'
   ```

3. **启动系统**
   ```bash
   ./一键启动脚本.sh
   ```

4. **处理文章**
   ```bash
   node start.js "https://www.golfmonthly.com/news/article-url"
   ```

## 注意事项

1. 确保Node.js已安装（建议v16+）
2. 需要有效的Claude API密钥
3. 默认使用8080端口，确保未被占用
4. 文章数据存储在 golf_content 目录

## 联系支持

如有问题，请查看各文档说明或检查错误日志。