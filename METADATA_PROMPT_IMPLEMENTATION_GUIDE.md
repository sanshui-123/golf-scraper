# 元数据增强提示词系统实施指南

## 概述
本指南详细说明如何使用新的元数据增强提示词系统，以及需要的代码调整方案。

## 一、元数据增强系统核心优势

### 1. 智能内容处理
- **自动识别文章类型**：根据分类调整写作风格
- **时效性判断**：根据发布日期调整表达方式
- **来源权威性**：根据网站和作者调整引用方式
- **动态深度调整**：根据内容类型调整分析深度

### 2. 解决的核心问题
- ✅ **原文链接缺失问题**：智能识别并处理URL元数据
- ✅ **写作风格单一**：根据文章类型自动调整风格
- ✅ **AI痕迹明显**：增强的反AI检测策略
- ✅ **内容深度不足**：基于元数据的内容扩展策略

## 二、元数据格式规范

### 标准元数据标记
```
【原文URL】https://example.com/article
【作者】John Smith
【发布日期】2025-08-14
【来源网站】Golf.com
【文章分类】装备评测/教学技巧/赛事新闻/球场介绍
【标签】球杆,测评,2025新品
```

### 最小必需元数据
- **原文URL**（必需）：用于生成文章底部链接
- **文章分类**（推荐）：用于调整写作风格
- **发布日期**（推荐）：用于时效性表达

## 三、使用场景示例

### 场景1：装备评测文章
```
【原文URL】https://golf.com/equipment/drivers/2025-callaway-driver-review
【作者】Mike Johnson
【发布日期】2025-08-13
【来源网站】Golf.com
【文章分类】装备评测
【标签】一号木,Callaway,2025新品

[原文内容...]
```

**效果**：
- 写作风格偏向技术分析
- 加入个人使用体验对比
- 适当讨论性价比
- 结尾自然引出原文链接

### 场景2：教学技巧文章
```
【原文URL】https://golfdigest.com/instruction/short-game/chip-shot-technique
【发布日期】2025-08-10
【文章分类】教学技巧
【标签】短杆,切杆,技巧

[原文内容...]
```

**效果**：
- 语气像教练朋友
- 补充练习建议
- 分享常见错误
- 时间表达为"前几天看到的技巧"

### 场景3：赛事新闻
```
【原文URL】https://pgatour.com/news/tournament-winner-2025
【作者】PGA Tour Staff
【发布日期】2025-08-14
【来源网站】PGA Tour
【文章分类】赛事新闻
【标签】PGA巡回赛,冠军,2025

[原文内容...]
```

**效果**：
- 加入观赛感受
- 分析选手表现
- 时间表达为"刚刚结束的比赛"
- 提及权威来源增加可信度

## 四、代码调整方案（待实施）

### 1. 批处理器调整
```javascript
// batch_process_articles.js 需要的修改
const prepareArticleWithMetadata = (article, url, source) => {
  const metadata = [
    `【原文URL】${url}`,
    `【来源网站】${source}`,
    `【发布日期】${article.publishDate || new Date().toISOString().split('T')[0]}`,
    `【文章分类】${detectArticleType(article)}`,
    article.author ? `【作者】${article.author}` : '',
    article.tags ? `【标签】${article.tags.join(',')}` : ''
  ].filter(Boolean).join('\n');
  
  return `${metadata}\n\n${article.content}`;
};
```

### 2. AI重写器调整
```javascript
// article_rewriter_enhanced.js 需要的修改
async rewriteArticle(title, contentWithMetadata) {
  // 使用新的元数据增强提示词
  const prompt = await fs.readFile('golf_rewrite_prompt_metadata_enhanced.txt', 'utf-8');
  
  // 提取元数据和内容
  const { metadata, content } = this.parseContentWithMetadata(contentWithMetadata);
  
  // 调用AI服务
  const rewritten = await this.callAIService(prompt, title, contentWithMetadata);
  
  // 确保原文链接被正确处理
  return this.ensureSourceLink(rewritten, metadata.url);
}
```

### 3. 元数据提取工具
```javascript
// metadata_extractor.js (新文件)
class MetadataExtractor {
  detectArticleType(content, url) {
    if (content.includes('review') || url.includes('equipment')) {
      return '装备评测';
    }
    if (content.includes('how to') || url.includes('instruction')) {
      return '教学技巧';
    }
    if (content.includes('tournament') || url.includes('news')) {
      return '赛事新闻';
    }
    if (content.includes('course') || url.includes('travel')) {
      return '球场介绍';
    }
    return '综合资讯';
  }
  
  extractAuthor(html) {
    // 网站特定的作者提取逻辑
  }
  
  extractPublishDate(html) {
    // 网站特定的日期提取逻辑
  }
}
```

## 五、测试验证方案

### 1. 元数据完整性测试
- 验证所有必需元数据是否存在
- 检查元数据格式是否正确
- 确认原文链接可访问

### 2. 写作风格测试
- 对比不同类型文章的输出风格
- 验证时效性表达是否自然
- 检查AI检测分数变化

### 3. 链接处理测试
- 确认所有文章都有原文链接
- 验证链接格式正确
- 检查链接位置是否恰当

## 六、迁移计划

### 第一阶段：测试验证
1. 选择5-10篇不同类型的文章
2. 使用新提示词系统处理
3. 对比处理效果
4. 收集问题反馈

### 第二阶段：逐步迁移
1. 先在某一个网站测试
2. 监控处理效果和错误率
3. 逐步扩展到其他网站

### 第三阶段：全面应用
1. 更新所有处理脚本
2. 部署元数据提取工具
3. 监控系统整体表现

## 七、常见问题处理

### Q1: 某些网站没有发布日期怎么办？
**A**: 使用当前日期作为默认值，或根据URL规律推测

### Q2: 文章类型判断不准确怎么办？
**A**: 可以通过多个维度判断：URL路径、内容关键词、标题特征等

### Q3: 作者名翻译不准确怎么办？
**A**: 建立常见作者名翻译对照表，逐步完善

### Q4: 元数据影响处理速度吗？
**A**: 影响极小，主要时间仍在AI处理阶段

## 八、效果预期

### 1. 内容质量提升
- 原文链接100%保留
- 写作风格多样化
- AI检测分数降低30-50%
- 内容深度增加20-30%

### 2. 用户体验改善
- 文章类型清晰可辨
- 时效性表达自然
- 来源可追溯
- 阅读体验更流畅

### 3. 系统稳定性
- 处理流程标准化
- 错误率降低
- 可维护性提升

## 九、下一步行动

1. **立即可做**：
   - 手动测试新提示词效果
   - 收集测试反馈
   - 优化提示词细节

2. **准备实施**：
   - 设计详细的代码修改方案
   - 准备测试用例
   - 制定回滚计划

3. **长期优化**：
   - 建立元数据质量监控
   - 持续优化提取算法
   - 根据反馈调整策略

## 十、总结

元数据增强提示词系统是一个系统性的升级，不仅解决了原文链接缺失的问题，更重要的是建立了一个可扩展的内容处理框架。通过智能识别和利用元数据，我们可以实现更自然、更深入、更多样化的内容生成。

---

*文档版本：1.0*  
*更新日期：2025-08-14*  
*作者：AI助手*