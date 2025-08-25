#!/usr/bin/env node

/**
 * 对比新旧提示词系统的差异
 * 展示元数据增强系统的优势
 */

const chalk = require('chalk');

// 模拟一篇高尔夫装备评测文章
const sampleArticle = {
  url: 'https://golf.com/equipment/irons/2025-titleist-t200-irons-review',
  title: 'Titleist T200 Irons Review: Distance Meets Control',
  content: `The new Titleist T200 irons deliver impressive distance gains while maintaining the feel Titleist is known for.
[IMAGE_1:Titleist T200 irons set]
Featuring a forged face insert and max impact technology, these irons provide exceptional ball speed.
[IMAGE_2:Iron face technology close-up]
Testing showed 7-10 yards more distance compared to the previous generation.`
};

// 旧系统输出示例（缺少原文链接）
const oldSystemOutput = `## 泰特利斯T200铁杆评测：距离与控制的完美结合

最近看到泰特利斯推出了新的T200铁杆，这款铁杆在保持泰特利斯一贯手感的同时，距离性能有了明显提升。

[IMAGE_1:泰特利斯T200铁杆套装]

这次采用了锻造杆面嵌入技术和最大冲击技术，**球速表现真的很出色**。

[IMAGE_2:铁杆杆面技术特写]

测试数据显示，比上一代多了7-10码的距离。总的来说，这是一款不错的选择。

❌ **原文URL未提供**`;

// 新系统输出示例（元数据增强）
const newSystemOutput = `## 泰特利斯T200铁杆评测：距离与控制的完美结合

昨天在Golf.com上看到这篇T200的详细测评，刚好我上周也试打过这套杆。泰特利斯这次确实下了本钱，
既保住了自家的手感优势，距离上也没落下。

[IMAGE_1:泰特利斯T200铁杆套装]

锻造杆面嵌入这个技术不是新鲜事了，但配合他们的最大冲击技术，**球速提升是真的能感受到**。
我自己用7号铁测试，比之前用的AP2多飞了8码左右，这还是在没换杆身的情况下。

[IMAGE_2:铁杆杆面技术特写]

官方数据说比上一代多7-10码，我觉得这个数字还挺靠谱的。不过说实话，价格不便宜，
一套下来小一万了。但如果你像我一样，既想要距离又不想牺牲太多手感，
T200确实值得考虑。具体效果怎么样，还是得看个人挥杆了。

---

[查看原文](https://golf.com/equipment/irons/2025-titleist-t200-irons-review) | 发布于8月14日`;

// 对比展示
function showComparison() {
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.cyan('🔍 新旧提示词系统对比分析'));
  console.log('='.repeat(80));
  
  console.log('\n' + chalk.yellow('📄 原始文章信息：'));
  console.log(`URL: ${sampleArticle.url}`);
  console.log(`标题: ${sampleArticle.title}`);
  console.log(`内容预览: ${sampleArticle.content.substring(0, 100)}...`);
  
  console.log('\n' + chalk.red('❌ 旧系统输出问题：'));
  console.log('1. 缺少原文链接，显示"原文URL未提供"');
  console.log('2. 开头模板化："最近看到..."');
  console.log('3. 结尾生硬："总的来说..."');
  console.log('4. 缺乏个人体验和深度分析');
  console.log('5. 没有时效性表达');
  
  console.log('\n' + chalk.green('✅ 新系统优势：'));
  console.log('1. 完整的原文链接和发布日期');
  console.log('2. 自然的开头："昨天在Golf.com上看到..."');
  console.log('3. 自然的结尾："具体效果怎么样，还是得看个人挥杆了"');
  console.log('4. 融入个人体验："我上周也试打过"');
  console.log('5. 价格讨论和性价比分析');
  console.log('6. 更口语化的表达');
  
  console.log('\n' + chalk.magenta('📊 元数据增强效果：'));
  console.log(`✓ 来源信息: 自然提及“Golf.com”`);
  console.log(`✓ 时效性: “昨天”、“上周”等自然时间表达`);
  console.log(`✓ 作者角度: 融入个人经历和见解`);
  console.log(`✓ 深度分析: 添加了价格考量和选购建议`);
  
  console.log('\n' + chalk.bold.blue('🎯 核心改进点总结：'));
  console.log('1. 🔗 解决了原文链接缺失问题');
  console.log('2. 🎨 根据文章类型动态调整写作风格');
  console.log('3. 🕰️ 时效性表达更自然');
  console.log('4. 🤖 增强反AI检测策略');
  console.log('5. 📝 内容深度和个性化提升');
  
  console.log('\n' + '='.repeat(80));
}

// 执行对比
showComparison();

// 如果没有chalk模块，提供替代方案
if (!chalk) {
  console.log('\n提示: 安装 chalk 模块可以获得更好的显示效果');
  console.log('npm install chalk');
}