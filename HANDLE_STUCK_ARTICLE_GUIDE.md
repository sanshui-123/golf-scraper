# 处理Claude卡住文章的标准流程

## 使用场景
当Claude改写进程卡住时，使用此工具恢复并完成文章处理。

## 使用方法

### 1. 基本命令
```bash
node handle_stuck_claude_article.js <临时文件路径> <文章编号> [图片前缀]
```

### 2. 参数说明
- **临时文件路径**: temp_prompt_xxx.txt 文件的路径
- **文章编号**: 要保存为第几篇文章（如 3 表示第3篇）
- **图片前缀**: 可选，图片文件的前缀编号（默认为1）

### 3. 实际示例
```bash
# 处理第3篇文章，使用默认图片前缀
node handle_stuck_claude_article.js temp_prompt_1752046172619.txt 3

# 处理第5篇文章，图片前缀为2
node handle_stuck_claude_article.js temp_prompt_xxx.txt 5 2
```

## 工具功能

1. **自动清理进程** - 检查并终止卡住的Claude进程
2. **安全重新改写** - 使用超时保护重新运行Claude
3. **图片占位符处理** - 自动替换为正确的图片路径
4. **发布日期更新** - 更新article_publish_dates.json
5. **微信格式生成** - 添加所需的头部信息

## 注意事项

1. **不要手动修改** - 此工具已封装所有必要步骤
2. **临时文件检查** - 确保临时文件存在且内容完整
3. **文章编号** - 确保编号不与现有文章冲突
4. **图片文件** - 确保对应的图片文件已下载到images目录

## 常见问题

### Q: 如何知道是第几篇文章？
A: 查看 `golf_content/2025-07-09/wechat_ready/` 目录下已有的文章数量

### Q: 图片前缀是什么？
A: 图片文件名中的数字，如 `article_1_img_1.jpg` 中的 1

### Q: 处理失败怎么办？
A: 检查错误信息，确保：
- 临时文件存在
- Claude安全运行器已创建
- 目录权限正确

## 完整处理流程

```bash
# 1. 发现Claude卡住
ps aux | grep claude

# 2. 使用封装工具处理
node handle_stuck_claude_article.js temp_prompt_1752046172619.txt 3

# 3. 查看结果
# 浏览器访问: http://localhost:8080/article/2025-07-09/03
```