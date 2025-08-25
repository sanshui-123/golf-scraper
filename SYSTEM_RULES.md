# 高尔夫内容管理系统规则

## 核心规则

### 1. 日期管理规则
- **今天抓取的内容** → 保存到今天的日期目录（如：2025-07-09）
- **历史内容保留** → 之前抓取的内容永久保留，不会被覆盖或删除
- **目录结构**：
  ```
  golf_content/
  ├── 2025-07-07/  (保留)
  ├── 2025-07-08/  (保留)
  └── 2025-07-09/  (今天新内容)
      ├── articles/
      ├── images/
      └── wechat_ready/
  ```

### 2. 重复内容处理规则
- **检查机制**：抓取前检查 URL 是否已存在于当天的 `article_urls.json`
- **跳过处理**：如果文章已存在，直接跳过，不做任何处理
- **不跨天检查**：不检查其他日期目录，允许不同日期抓取同一文章

### 3. 文章处理流程
1. **扫描** → 获取文章列表和发布时间
2. **去重** → 检查当天目录中是否已存在
3. **抓取** → 下载文章内容和图片
4. **改写** → 使用 Claude 改写成中文
5. **保存** → 保存到当天的日期目录

### 4. 时间管理
- **北京时间为准**：每日扫描以北京时间 10:00 为界
- **发布时间显示**：使用 Golf Monthly 的原始发布时间

## 实现代码位置

- **日期获取**：`getToday()` 函数
  ```javascript
  getToday() {
      return new Date().toISOString().split('T')[0];
  }
  ```

- **重复检测**：`checkArticleExists()` 函数
  ```javascript
  checkArticleExists(url) {
      const urlMapPath = path.join(dateDir, 'article_urls.json');
      if (!fs.existsSync(urlMapPath)) return false;
      const urlMap = JSON.parse(fs.readFileSync(urlMapPath, 'utf8'));
      return Object.values(urlMap).some(item => item.url === url);
  }
  ```

## 使用示例

```bash
# 每日扫描（自动保存到今天目录）
node golf_monthly_daily_scanner.js

# 单篇文章处理（自动保存到今天目录）
node smart_article_extractor.js <URL>

# 查看今天的内容
http://localhost:8080/articles/2025-07-09
```

## 注意事项
- 不要手动修改日期目录名
- 不要删除历史数据
- 系统会自动管理日期和重复检测