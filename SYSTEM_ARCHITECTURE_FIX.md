# 系统架构修复方案

## 🚨 当前问题分析

### 根本矛盾
- **CLAUDE.md要求**: "每次重新生成URL确保最新内容"
- **实际实现**: 使用`--ignore-time`参数，抓取所有文章包括旧的
- **Fresh URLs机制**: 强制重复处理，绕过内容重复检测

### 具体问题
1. **URL生成阶段**:
   ```bash
   # 问题命令（抓取旧文章）
   node discover_recent_articles.js https://www.golfmonthly.com 20 --ignore-time --urls-only
   node discover_golfdigest_articles.js 20 --ignore-time --urls-only
   ```

2. **Fresh URLs机制**:
   ```json
   {
     "bypass_global_duplicates": true,  // 强制重复处理
     "generation_mode": "force_reprocess_all"  // 重复处理所有
   }
   ```

## 🛠️ 解决方案

### 1. 移除时间忽略参数
```bash
# 修正后的命令（只抓取最新文章）
node discover_recent_articles.js https://www.golfmonthly.com 20 --urls-only  # 移除--ignore-time
node discover_golfdigest_articles.js 20 --urls-only  # 移除--ignore-time
```

### 2. 基于内容的新鲜度检测
- 不是基于URL，而是基于文章内容hash
- 检查文章发布时间
- 只处理真正的新内容

### 3. 重新定义"Fresh URLs"
- 真正的新内容才标记为fresh
- 不是重新生成的URL就是fresh

### 4. 智能重复检测
- 内容hash比较
- 发布时间验证
- 标题相似度检测

## 🎯 实施步骤

1. **立即修复**: 移除`--ignore-time`参数
2. **内容检测**: 实现基于内容的新鲜度检测
3. **机制重构**: 重新设计Fresh URLs逻辑
4. **CLAUDE.md更新**: 修正设计哲学矛盾

## 📊 预期效果

- ✅ 只处理真正的新文章
- ✅ 消除重复内容处理
- ✅ 提高处理效率
- ✅ 确保内容质量