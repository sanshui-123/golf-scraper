# 高尔夫内容管理系统完整工作流程

## 🏗️ 系统架构

```
golf_content/                    # 主内容目录
├── 2025-07-08/                 # 日期目录（YYYY-MM-DD格式）
│   ├── articles/               # 原始文章
│   │   ├── article_001.md     # 文章1（3位数编号）
│   │   ├── article_002.md     # 文章2
│   │   └── article_003.md     # 文章3
│   ├── images/                 # 图片目录
│   │   ├── article_001_img_1.jpg
│   │   ├── article_001_img_2.jpg
│   │   └── ...
│   ├── wechat_ready/          # 微信版本
│   │   ├── wechat_article_01.md  # （2位数编号）
│   │   ├── wechat_article_02.md
│   │   └── wechat_article_03.md
│   ├── wechat_html/           # HTML版本（自动生成）
│   └── content_for_rewrite.json  # 文章元数据
```

## 📋 完整工作流程

### 第一步：启动内容管理器
```bash
node start_content_manager.js
# 访问 http://localhost:8080
```

### 第二步：获取文章URL
从 Golf Monthly 或其他来源获取要处理的文章链接

### 第三步：抓取并改写文章
```bash
# 方法1：使用批量处理器（推荐用于多篇文章）
node ultra_fast_processor.js "URL1" "URL2" "URL3"

# 方法2：使用单篇处理器
node manual_article_extractor.js "文章URL"

# 方法3：只做改写（如果已有原文）
node claude_rewriter.js "文章URL"

# 方法4：增强版一体化处理（推荐）
node enhanced_article_extractor.js "文章URL"
```

### 第四步：添加文章到系统
```bash
# 使用自动化脚本（推荐）
node add_article_to_system.js golf_article_rewritten.md "原文URL" "文章标题"

# 脚本会自动：
# ✅ 创建目录结构
# ✅ 分配文章编号
# ✅ 保存到articles和wechat_ready
# ✅ 创建图片占位符
# ✅ 更新JSON元数据
```

### 第五步：查看结果
1. 刷新 http://localhost:8080
2. 点击对应日期（如 2025-07-08）
3. 查看文章列表
4. 点击文章标题查看详情

## 🔧 核心脚本说明

### 1. **start_content_manager.js**
- 启动Web服务器（端口8080）
- 提供文章浏览界面
- 支持复制到微信功能

### 2. **claude_rewriter.js**
- 使用Claude API改写文章
- 保持图片占位符格式
- 输出为Markdown格式

### 3. **add_article_to_system.js**
- 自动化添加文章到系统
- 处理所有文件操作
- 更新元数据

### 4. **ultra_fast_processor.js**
- 批量抓取文章
- 自动调用Claude改写
- 下载图片

## 📝 文件命名规范

1. **文章文件**
   - articles目录：`article_001.md`, `article_002.md`（3位数）
   - wechat_ready：`wechat_article_01.md`, `wechat_article_02.md`（2位数）

2. **图片文件**
   - 格式：`article_001_img_1.jpg`
   - 编号与文章对应

3. **图片占位符**
   - 格式：`[IMAGE_1:描述文字]`
   - 必须保留所有占位符

## 🚀 快速命令

```bash
# 查看今天的文章
ls -la golf_content/$(date +%Y-%m-%d)/articles/

# 检查系统状态
curl -s http://localhost:8080/api/stats | jq

# 查看特定日期的文章数
curl -s http://localhost:8080/api/stats | jq '.dates[] | select(.date == "2025-07-08")'

# 添加新文章（完整流程）
node claude_rewriter.js "https://example.com/article"
node add_article_to_system.js golf_article_rewritten.md "https://example.com/article" "文章标题"
```

## ⚠️ 注意事项

1. **日期格式**：必须使用 YYYY-MM-DD 格式（如 2025-07-08）
2. **目录位置**：使用 `golf_content` 而不是 `golf_content_backups`
3. **编号递增**：新文章会自动获得下一个编号
4. **图片处理**：如果没有真实图片，会创建空的占位文件
5. **权限问题**：确保Claude命令包含 `--dangerously-skip-permissions`

## 🔄 日常使用流程

```bash
# 早上开始工作
1. node start_content_manager.js  # 启动服务器

# 处理新文章
2. 获取Golf Monthly最新文章URL
3. node claude_rewriter.js "URL"  # 改写文章
4. node add_article_to_system.js golf_article_rewritten.md "URL" "标题"

# 查看结果
5. 访问 http://localhost:8080
6. 点击今天的日期查看所有文章
```

## 📊 系统特点

1. **自动化程度高**：一条命令完成文章添加
2. **结构清晰**：按日期组织内容
3. **支持批量**：可以一次处理多篇文章
4. **微信优化**：自动生成微信版本
5. **图片管理**：保持图片与文字的对应关系

---

这个流程已经过测试验证，稳定可靠，无需进一步优化。