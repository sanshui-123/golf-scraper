# URL质量检查详细操作手册

## 目录
1. [快速开始](#快速开始)
2. [详细流程](#详细流程)
3. [各网站检查标准](#各网站检查标准)
4. [常见问题解决](#常见问题解决)
5. [执行检查单](#执行检查单)

---

## 快速开始

### 一键执行命令
```bash
# 生成所有网站URL文件
echo "1/5 Golf.com" && node discover_recent_articles.js https://golf.com 20 --ignore-time --urls-only
echo "2/5 Golf Monthly" && node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only  
echo "3/5 MyGolfSpy" && node process_mygolfspy_rss.js process 15 --urls-only
echo "4/5 GolfWRX" && node process_golfwrx.js process 10 --urls-only
echo "5/5 Golf Digest" && node discover_golfdigest_articles.js 20 --ignore-time --urls-only

# 运行质量检查
./url_quality_check.sh
```

---

## 详细流程

### 第1步：生成URL文件

**Golf.com**
```bash
node discover_recent_articles.js https://golf.com 20 --ignore-time --urls-only
# 生成文件: deep_urls_golf_com.txt
# 预期格式: /news/, /instruction/
```

**Golf Monthly**
```bash
node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only
# 生成文件: deep_urls_www_golfmonthly_com.txt
# 预期格式: /news/, /features/, /tips/, /buying-advice/
# ⚠️ 注意: 可能出现分页链接问题
```

**MyGolfSpy**
```bash
node process_mygolfspy_rss.js process 15 --urls-only
# 生成文件: deep_urls_mygolfspy_com.txt
# 建议使用RSS方法，更稳定
```

**GolfWRX**
```bash
node process_golfwrx.js process 10 --urls-only
# 生成文件: deep_urls_www_golfwrx_com.txt
# 预期格式: /数字ID/
# ⚠️ 注意: 可能遇到Cloudflare保护
```

**Golf Digest**
```bash
node discover_golfdigest_articles.js 20 --ignore-time --urls-only
# 生成文件: deep_urls_www_golfdigest_com.txt
# 预期格式: /story/, /gallery/
```

### 第2步：质量检查脚本

**创建检查脚本**
```bash
cat > url_quality_check.sh << 'EOF'
#!/bin/bash
echo "=== 5个高尔夫网站URL质量检查报告 ==="
echo "检查时间: $(date)"
echo "======================================"
echo

# 基本统计
echo "📊 基本统计:"
for file in deep_urls_*.txt; do
    if [ -f "$file" ]; then
        count=$(wc -l < "$file")
        site=$(echo "$file" | sed 's/deep_urls_//g' | sed 's/\.txt//g' | sed 's/_/./g')
        printf "  %-20s: %3d URLs\n" "$site" "$count"
    fi
done
echo

# Golf.com 检查
echo "🏌️ Golf.com 质量检查:"
file="deep_urls_golf_com.txt"
if [ -f "$file" ]; then
    total=$(wc -l < "$file")
    news=$(grep -c "/news/" "$file" 2>/dev/null || echo "0")
    instruction=$(grep -c "/instruction/" "$file" 2>/dev/null || echo "0")
    valid=$((news + instruction))
    ratio=$((valid * 100 / total))
    echo "  总URL: $total | 新闻: $news | 教学: $instruction | 有效率: $ratio%"
    if [ "$total" -eq 0 ]; then
        echo "  ❌ 状态: URL发现失败"
    elif [ "$ratio" -ge 70 ]; then
        echo "  ✅ 状态: 质量良好"
    else
        echo "  ⚠️ 状态: 有效率偏低，需要检查"
    fi
else
    echo "  ❌ 文件不存在"
fi
echo

# Golf Monthly 检查（重点：分页链接问题）
echo "📰 Golf Monthly 质量检查:"
file="deep_urls_www_golfmonthly_com.txt"
if [ -f "$file" ]; then
    total=$(wc -l < "$file")
    content=$(grep -c -E "/(news|features|tips|buying-advice)/" "$file" 2>/dev/null || echo "0")
    pagination=$(grep -c -E "(page/[0-9]+|archive)" "$file" 2>/dev/null || echo "0")
    
    echo "  总URL: $total | 内容文章: $content | 分页链接: $pagination"
    
    if [ "$pagination" -gt 0 ]; then
        echo "  ❌ 状态: 发现分页链接，需要立即修复"
        echo "  🔧 修复命令: node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only"
    elif [ "$content" -ge $((total * 80 / 100)) ]; then
        echo "  ✅ 状态: 质量良好"
    else
        echo "  ⚠️ 状态: 内容文章比例偏低"
    fi
else
    echo "  ❌ 文件不存在"
fi
echo

# MyGolfSpy 检查
echo "🕵️ MyGolfSpy 质量检查:"
file="deep_urls_mygolfspy_com.txt"
if [ -f "$file" ]; then
    total=$(wc -l < "$file")
    echo "  总URL: $total"
    if [ "$total" -eq 0 ]; then
        echo "  ❌ 状态: URL发现失败，建议使用RSS方法"
    elif [ "$total" -lt 5 ]; then
        echo "  ⚠️ 状态: URL数量偏少，建议使用RSS方法"
    else
        echo "  ✅ 状态: 质量良好"
    fi
else
    echo "  ❌ 文件不存在，建议使用RSS方法"
fi
echo

# GolfWRX 检查
echo "🔧 GolfWRX 质量检查:"
file="deep_urls_www_golfwrx_com.txt"
if [ -f "$file" ]; then
    total=$(wc -l < "$file")
    id_format=$(grep -c -E "/[0-9]+/" "$file" 2>/dev/null || echo "0")
    ratio=$((id_format * 100 / total))
    echo "  总URL: $total | ID格式: $id_format | 格式率: $ratio%"
    
    if [ "$total" -eq 0 ]; then
        echo "  ❌ 状态: URL发现失败，可能遇到Cloudflare保护"
    elif [ "$ratio" -ge 70 ]; then
        echo "  ✅ 状态: 质量良好"
    else
        echo "  ⚠️ 状态: 格式异常，需要检查"
    fi
else
    echo "  ❌ 文件不存在"
fi
echo

# Golf Digest 检查
echo "📖 Golf Digest 质量检查:"
file="deep_urls_www_golfdigest_com.txt"
if [ -f "$file" ]; then
    total=$(wc -l < "$file")
    story=$(grep -c "/story/" "$file" 2>/dev/null || echo "0")
    gallery=$(grep -c "/gallery/" "$file" 2>/dev/null || echo "0")
    valid=$((story + gallery))
    ratio=$((valid * 100 / total))
    
    echo "  总URL: $total | 故事: $story | 图集: $gallery | 有效率: $ratio%"
    
    if [ "$total" -eq 0 ]; then
        echo "  ❌ 状态: URL发现失败，可能有访问限制"
    elif [ "$ratio" -ge 70 ]; then
        echo "  ✅ 状态: 质量良好"
    else
        echo "  ⚠️ 状态: 格式异常，需要检查"
    fi
else
    echo "  ❌ 文件不存在"
fi

echo
echo "======================================"
echo "🎯 检查总结:"
echo "1. 如果发现❌状态，执行对应的🔧修复命令"
echo "2. 如果发现⚠️状态，建议进一步检查URL内容"
echo "3. 修复后重新运行此脚本验证"
echo "4. 所有网站都是✅状态后，可以开始处理文章"
EOF

chmod +x url_quality_check.sh
```

**运行检查**
```bash
./url_quality_check.sh
```

### 第3步：问题修复

**Golf Monthly分页链接修复**
```bash
if grep -q -E "(page/[0-9]+|archive)" deep_urls_www_golfmonthly_com.txt 2>/dev/null; then
    echo "🔧 修复Golf Monthly分页链接问题..."
    cp deep_urls_www_golfmonthly_com.txt deep_urls_www_golfmonthly_com.txt.backup
    node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only
    echo "修复完成，验证结果:"
    echo "修复前: $(wc -l < deep_urls_www_golfmonthly_com.txt.backup) URLs"
    echo "修复后: $(wc -l < deep_urls_www_golfmonthly_com.txt) URLs"
    echo "分页链接: $(grep -c -E "(page/|archive)" deep_urls_www_golfmonthly_com.txt || echo 0)"
fi
```

**其他网站重试**
```bash
# 如果URL数量为0，重新运行
for site_info in "golf.com:discover_recent_articles.js https://golf.com 20 --ignore-time --urls-only" \
                 "mygolfspy.com:process_mygolfspy_rss.js process 15 --urls-only" \
                 "www.golfwrx.com:process_golfwrx.js process 10 --urls-only" \
                 "www.golfdigest.com:discover_golfdigest_articles.js 20 --ignore-time --urls-only"; do
    
    site=$(echo "$site_info" | cut -d: -f1)
    command=$(echo "$site_info" | cut -d: -f2-)
    file="deep_urls_${site//./_}.txt"
    
    if [ ! -f "$file" ] || [ $(wc -l < "$file" 2>/dev/null || echo 0) -eq 0 ]; then
        echo "🔧 重试 $site..."
        eval "node $command"
    fi
done
```

### 第4步：最终验证

```bash
# 重新检查
./url_quality_check.sh

# 显示可处理的文件
echo "=== 可以开始处理的URL文件 ==="
for file in deep_urls_*.txt; do
    if [ -f "$file" ] && [ $(wc -l < "$file") -gt 0 ]; then
        count=$(wc -l < "$file")
        site=$(echo "$file" | sed 's/deep_urls_//g' | sed 's/\.txt//g' | sed 's/_/./g')
        echo "✅ $site: $count URLs ($file)"
    fi
done

echo
echo "🚀 开始批量处理文章:"
echo "node batch_process_articles.js deep_urls_*.txt"
```

---

## 各网站检查标准

### Golf.com ✅
- **URL格式**: `/news/`, `/instruction/`
- **质量标准**: 有效率 ≥ 70%
- **常见问题**: 很少出现问题

### Golf Monthly ⚠️
- **URL格式**: `/news/`, `/features/`, `/tips/`, `/buying-advice/`
- **质量标准**: 内容文章比例 ≥ 80%
- **常见问题**: 分页链接 (`/page/2`, `/archive`)
- **修复**: 重新运行URL发现命令

### MyGolfSpy 🔄
- **建议方法**: RSS (`process_mygolfspy_rss.js`)
- **质量标准**: URL数量 ≥ 5
- **常见问题**: 直接抓取效果不佳

### GolfWRX ⚠️
- **URL格式**: `/数字ID/`
- **质量标准**: ID格式比例 ≥ 70%
- **常见问题**: Cloudflare保护

### Golf Digest ⚠️
- **URL格式**: `/story/`, `/gallery/`
- **质量标准**: 有效率 ≥ 70%
- **常见问题**: 访问限制

---

## 常见问题解决

### 问题1: Golf Monthly分页链接
**症状**: 分页链接 > 0
**解决**: 
```bash
node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only
```
**验证**: 
```bash
grep -E "(page/|archive)" deep_urls_www_golfmonthly_com.txt
# 应该无结果
```

### 问题2: URL数量为0
**症状**: 总URL: 0
**可能原因**: 网络问题、反爬虫保护、脚本错误
**解决步骤**:
1. 检查网络连接
2. 重新运行对应命令
3. GolfWRX: 可能遇到Cloudflare保护，暂时跳过
4. MyGolfSpy: 使用RSS方法

### 问题3: URL格式异常
**症状**: 有效率 < 70%
**解决**: 检查URL文件内容
```bash
head -10 [问题文件]
```

### 问题4: 重复URL
**症状**: 同一URL出现多次
**解决**:
```bash
sort [文件名] | uniq > [文件名].tmp && mv [文件名].tmp [文件名]
```

---

## 执行检查单

### 执行前准备
- [ ] 确认网络连接正常
- [ ] 备份现有URL文件: `cp deep_urls_*.txt backup/`

### 执行流程
- [ ] 第1步：生成所有网站URL文件
- [ ] 第2步：运行质量检查脚本
- [ ] 第3步：根据检查结果执行修复
- [ ] 第4步：最终验证所有网站状态为✅

### 执行后验证
- [ ] 所有网站显示✅状态
- [ ] URL文件格式正确
- [ ] 开始批量处理文章

### 紧急处理
如果遇到严重问题:
1. `mkdir backup && cp deep_urls_*.txt backup/`
2. 重新执行第1步
3. 临时跳过问题网站，先处理正常网站

---

## 修复记录

### 已修复问题
- ✅ **Golf Monthly分页链接问题** (2025-08-01)
  - 修复了 `discover_recent_articles.js` 的URL过滤逻辑
  - 从20个URL（含9个分页）优化为19个有效文章URL
  - 添加了分页模式检测，排除 `/page/` 和 `/archive` 的URL

### 影响范围
- ✅ Golf Monthly: 已修复
- ✅ 其他网站: 已验证无类似问题
- ✅ 系统: 建立了完整检查修复流程