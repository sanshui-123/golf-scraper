# 高尔夫内容工作流 - 快速命令参考

## 常用命令

### 1. 每日自动运行
```bash
node daily_golf_workflow_final.js
```

### 2. 处理单个文章
```bash
# 创建临时URL文件
echo '["https://www.golfmonthly.com/buying-advice/your-article-url"]' > temp_url.json

# 运行处理
node run_batch_processor.js temp_url.json
```

### 3. 处理多个文章
```bash
# 创建URL列表
cat > urls.json << EOF
[
  "https://www.golfmonthly.com/article1",
  "https://www.golfmonthly.com/article2",
  "https://www.golfmonthly.com/article3"
]
EOF

# 运行批处理
node run_batch_processor.js urls.json
```

### 4. 查看内容
```bash
# 启动管理界面
node start_content_manager.js

# 浏览器访问
open http://localhost:8080
```

### 5. 测试Claude
```bash
echo "Hello" | claude --dangerously-skip-permissions --print
```

### 6. 查看今日文章
```bash
ls -la golf_content/$(date +%Y-%m-%d)/wechat_ready/
```

### 7. 清理临时文件
```bash
rm -f temp_*.json temp_*.txt
```

## 文件位置

- **改写后的文章**：`golf_content/YYYY-MM-DD/wechat_ready/`
- **HTML版本**：`golf_content/YYYY-MM-DD/wechat_html/`
- **图片文件**：`golf_content/YYYY-MM-DD/images/`
- **扫描结果**：`scan_results/YYYY-MM-DD/`

## 故障排查

### Claude超时
```bash
# 查看Claude是否正常
echo "test" | claude --dangerously-skip-permissions --print
```

### 查看日志
```bash
# 运行时会直接在控制台输出日志
# 可以重定向到文件
node daily_golf_workflow_final.js > workflow.log 2>&1
```

### 手动重试失败的文章
```bash
# 查看哪些文章是英文（未成功翻译）
grep -L "[\u4e00-\u9fa5]" golf_content/*/wechat_ready/*.md

# 获取失败文章的URL并重新处理
# (需要从article_urls.json中查找对应URL)
```

---
记住：封装的模块（article_rewriter_final.js 和 image_processor_final.js）只能调用，不能修改！