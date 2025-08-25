# MCP Browser 替代方案指南

## 🚨 问题说明
MCP Browser 工具经常出现以下问题：
- 连接失败："Not connected"
- 进程卡死，需要手动终止
- 响应缓慢，影响操作效率

## ✅ 推荐替代方案

### 1. 使用 curl 命令（最简单）
```bash
# 查看文章列表
curl -s --noproxy localhost http://localhost:8080/articles/2025-08-12

# 查看具体文章
curl -s --noproxy localhost http://localhost:8080/golf_content/2025-08-12/wechat_html/wechat_article_1434.html

# 获取JSON格式的文章数据
curl -s --noproxy localhost http://localhost:8080/api/articles/2025-08-12
```

**关键参数说明：**
- `--noproxy localhost`: 绕过代理设置，避免 "Empty reply from server" 错误
- `-s`: 静默模式，不显示进度条

### 2. 使用内置 WebFetch 工具
虽然 WebFetch 对 localhost 有限制，但可以用于外部网站：
```javascript
// 获取外部网站内容
WebFetch({
  url: "https://example.com",
  prompt: "提取页面主要内容"
})
```

### 3. 直接文件操作
对于本地文件，直接使用文件操作工具：
```javascript
// 读取文章内容
Read("/Users/sanshui/Desktop/cursor/golf_content/2025-08-12/wechat_ready/wechat_article_1434.md")

// 列出文章
LS("/Users/sanshui/Desktop/cursor/golf_content/2025-08-12/wechat_ready")
```

### 4. 创建测试HTML页面
```bash
# 创建一个简单的测试页面
cat > test_view.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>文章查看器</title>
</head>
<body>
    <h1>今日文章</h1>
    <iframe src="http://localhost:8080/articles/2025-08-12" 
            width="100%" height="800px"></iframe>
</body>
</html>
EOF

# 在浏览器中打开
open test_view.html
```

## 📊 功能对比

| 功能 | MCP Browser | curl | WebFetch | 直接文件 |
|------|------------|------|----------|----------|
| 查看网页 | ✅ | ✅ | ❌(localhost) | ❌ |
| 交互操作 | ✅ | ❌ | ❌ | ❌ |
| 稳定性 | ❌ | ✅ | ✅ | ✅ |
| 速度 | ❌ | ✅ | ✅ | ✅ |
| 易用性 | ✅ | ✅ | ✅ | ✅ |

## 🛠️ 常用操作示例

### 检查今日文章数量
```bash
# 方法1：通过文件系统
ls golf_content/$(date +%Y-%m-%d)/wechat_ready/ | wc -l

# 方法2：通过 curl 和 grep
curl -s --noproxy localhost http://localhost:8080/articles/$(date +%Y-%m-%d) | grep -c "article-item"
```

### 查看文章内容
```bash
# 获取HTML内容
curl -s --noproxy localhost http://localhost:8080/golf_content/$(date +%Y-%m-%d)/wechat_html/wechat_article_1434.html

# 获取Markdown内容
cat golf_content/$(date +%Y-%m-%d)/wechat_ready/wechat_article_1434.md
```

### 检查重复文章
```bash
# 使用API
curl -s --noproxy localhost "http://localhost:8080/api/check-url?url=https://golf.com/example-article"

# 使用脚本
node check_duplicates.js
```

## 🚀 自动化脚本

### 创建 golf-view 命令
```bash
#!/bin/bash
# 保存为 /usr/local/bin/golf-view

DATE=${1:-$(date +%Y-%m-%d)}

echo "📊 获取 $DATE 的文章..."
COUNT=$(curl -s --noproxy localhost http://localhost:8080/articles/$DATE | grep -c "article-item")
echo "✅ 找到 $COUNT 篇文章"

echo ""
echo "📝 文章列表："
curl -s --noproxy localhost http://localhost:8080/articles/$DATE | \
  grep -E '<h3>|<span class="meta-site">' | \
  sed 's/<[^>]*>//g' | \
  sed 'N;s/\n/ - /' | \
  head -20

echo ""
echo "🔗 完整查看: http://localhost:8080/articles/$DATE"
```

使用方法：
```bash
chmod +x /usr/local/bin/golf-view
golf-view  # 查看今天
golf-view 2025-08-11  # 查看指定日期
```

## 📝 故障排除

### MCP Browser 进程清理
```bash
# 查找并终止所有 browsermcp 进程
pkill -f browsermcp

# 确认进程已终止
ps aux | grep browsermcp
```

### 代理设置问题
如果遇到代理相关错误，检查环境变量：
```bash
# 临时禁用代理
unset http_proxy
unset https_proxy

# 或者使用 --noproxy 参数
curl --noproxy localhost http://localhost:8080
```

## 🎯 最佳实践

1. **优先使用 curl**: 稳定、快速、可脚本化
2. **避免依赖 MCP**: 减少外部依赖，提高稳定性
3. **创建快捷命令**: 将常用操作封装成脚本
4. **定期检查**: 使用自动化脚本定期检查系统状态

---

**记住：简单可靠的工具往往是最好的选择。**