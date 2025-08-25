# 高尔夫文章添加工作流程

## 📋 标准步骤

### 1. 准备阶段
```bash
# 获取当前日期（格式：YYYY-MM-DD）
TODAY=$(date +%Y-%m-%d)  # 例如：2025-07-08
```

### 2. 抓取原文
```bash
# 方式一：使用ultra_fast_processor（批量）
node ultra_fast_processor.js "文章URL1" "文章URL2"

# 方式二：使用manual_article_extractor（单篇）
node manual_article_extractor.js "文章URL"

# 方式三：使用enhanced_article_extractor（推荐-一体化处理）
node enhanced_article_extractor.js "文章URL"
# 这个方法会自动完成：抓取、下载图片、改写、保存
```

### 3. Claude改写
```bash
# 改写会自动进行，如果失败可以手动执行
# 创建改写文件，例如：golf_article_rewritten.md
```

### 4. 创建目录结构
```bash
# 确保目录存在
mkdir -p golf_content/$TODAY/articles
mkdir -p golf_content/$TODAY/images
mkdir -p golf_content/$TODAY/wechat_ready
mkdir -p golf_content/$TODAY/wechat_html
```

### 5. 保存文章
```bash
# 获取当前文章数量
ARTICLE_COUNT=$(ls golf_content/$TODAY/articles/article_*.md 2>/dev/null | wc -l)
NEXT_NUM=$(printf "%03d" $((ARTICLE_COUNT + 1)))

# 复制文章到正确位置
cp 改写后的文章.md golf_content/$TODAY/articles/article_$NEXT_NUM.md

# 创建微信版本
cp 改写后的文章.md golf_content/$TODAY/wechat_ready/wechat_article_$(printf "%02d" $((ARTICLE_COUNT + 1))).md
```

### 6. 更新元数据
需要更新 `golf_content/$TODAY/content_for_rewrite.json` 文件：

```json
{
  "extractionTime": "2025-07-08T20:30:00",
  "source": "Golf Monthly",
  "totalArticles": 2,  // 更新总数
  "articles": [
    // 现有文章...
    {
      "id": 2,  // 递增ID
      "文章标题": "新文章标题",
      "摘要": "文章摘要",
      "原始链接": "原文URL",
      "字数": 4238,
      "状态": "✅ 已改写完成"
    }
  ]
}
```

### 7. 处理图片
```bash
# 如果有真实图片，复制到images目录
# 命名格式：article_${NEXT_NUM}_img_1.jpg
# 如果没有真实图片，创建占位文件
for i in {1..8}; do 
  touch golf_content/$TODAY/images/article_${NEXT_NUM}_img_${i}.jpg
done
```

### 8. 验证
```bash
# 检查文章数量
curl -s http://localhost:8080/api/stats | jq '.dates[] | select(.date == "'$TODAY'")'

# 应该显示正确的文章数量
```

## 🔧 常见问题

### 问题1：页面不显示新文章
- 确保文件在 `golf_content` 目录，而不是 `golf_content_backups`
- 检查日期格式是否正确（YYYY-MM-DD）
- 强制刷新浏览器（Ctrl+F5）

### 问题2：文章编号
- articles目录使用3位数：article_001.md, article_002.md
- wechat_ready使用2位数：wechat_article_01.md, wechat_article_02.md

### 问题3：图片占位符
- 文章中使用格式：[IMAGE_1:描述]
- 图片文件命名：article_001_img_1.jpg

## 📝 完整示例脚本

```bash
#!/bin/bash
# add_article.sh - 添加新文章的脚本

# 1. 设置变量
TODAY=$(date +%Y-%m-%d)
ARTICLE_URL="$1"
ARTICLE_TITLE="$2"

# 2. 创建目录
mkdir -p golf_content/$TODAY/{articles,images,wechat_ready,wechat_html}

# 3. 获取下一个文章编号
ARTICLE_COUNT=$(ls golf_content/$TODAY/articles/article_*.md 2>/dev/null | wc -l)
NEXT_NUM=$(printf "%03d" $((ARTICLE_COUNT + 1)))
WECHAT_NUM=$(printf "%02d" $((ARTICLE_COUNT + 1)))

# 4. 复制文章
cp golf_article_rewritten.md golf_content/$TODAY/articles/article_$NEXT_NUM.md
cp golf_article_rewritten.md golf_content/$TODAY/wechat_ready/wechat_article_$WECHAT_NUM.md

# 5. 创建占位图片
for i in {1..8}; do 
  touch golf_content/$TODAY/images/article_${NEXT_NUM}_img_${i}.jpg
done

# 6. 更新JSON（需要手动编辑）
echo "请手动更新 golf_content/$TODAY/content_for_rewrite.json"
echo "添加文章：$ARTICLE_TITLE"
echo "文章编号：$NEXT_NUM"
```

## 🚀 优化建议

1. **自动化脚本**
   - 创建一个 `add_article.js` 脚本自动完成所有步骤
   - 自动更新JSON文件
   - 自动生成正确的文件名

2. **批量处理**
   - 使用 `ultra_fast_processor.js` 一次处理多篇文章
   - 自动分配文章编号

3. **图片处理**
   - 自动下载原文图片
   - 自动调整图片大小
   - 保持图片与占位符的对应关系

4. **错误处理**
   - 检查文件是否已存在
   - 验证JSON格式
   - 确保目录权限正确

## 📌 快速命令

```bash
# 查看今天的文章
ls -la golf_content/$(date +%Y-%m-%d)/articles/

# 检查系统状态
curl -s http://localhost:8080/api/stats | jq

# 启动内容管理器
node start_content_manager.js
```