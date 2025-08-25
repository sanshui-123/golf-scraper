# 重复文章问题分析与解决方案

## 问题描述
2025年7月24日，发现MyGolfSpy的文章被重复处理多次：
- "Callaway Pre-Owned"文章被处理5次（编号：16, 33, 35, 39, 40）
- "SM10挖起杆"文章被处理4次（编号：17, 34, 36, 41）

## 根本原因：并发竞态条件

### 系统架构问题
1. **分布式状态管理缺失**
   - 多个处理器独立运行（MyGolfSpy、GolfWRX、通用处理器）
   - 没有中央化的编号分配机制

2. **编号分配的时序问题**
   ```javascript
   // 旧代码：批量预分配编号
   let currentNum = parseInt(this.getNextArticleNumber());
   const urlsWithNumbers = newUrls.map((url, index) => ({
       url,
       articleNum: String(currentNum + index).padStart(2, '0')
   }));
   ```
   - 进程A在14:30获取编号40-42
   - 进程B在14:31也获取编号40-42（因为A还未保存文件）
   - 结果：相同URL被分配相同编号

## 已实施的解决方案

### 1. 基于URL的原子编号分配
```javascript
// 新代码：每个URL实时获取唯一编号
getOrAssignArticleNumber(url) {
    // 检查URL是否已有编号
    if (urlMapping中存在该URL) {
        return 已有编号;
    }
    // 分配新编号并立即保存
    新编号 = 最大编号 + 1;
    立即保存到article_urls.json;
    return 新编号;
}
```

### 2. 清理已产生的重复
- 删除了38个重复文件
- 保留最早的版本（编号16, 17）

## 预防措施
1. **URL作为主键**：使用URL而非编号作为文章的唯一标识
2. **实时编号分配**：处理每篇文章时实时获取编号，而非批量预分配
3. **原子性保存**：分配编号后立即保存到`article_urls.json`

## 监控建议
定期运行重复检查：
```bash
node clean_duplicate_articles.js
```

## 更高层次的架构改进建议
1. **考虑使用数据库**：SQLite等轻量级数据库可提供事务支持
2. **进程锁机制**：实现真正的分布式锁
3. **消息队列**：使用队列系统协调多个处理器
4. **唯一性约束**：在保存文件时检查URL唯一性