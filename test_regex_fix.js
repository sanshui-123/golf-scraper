#!/usr/bin/env node

const testContent = `<!-- AI检测: 15% | 检测时间: 2025-08-16 05:57:29 -->
看到这支平克BunkR挖起杆的时候，说不好奇是假的。64度的杆面角，这在一般球友的球包里确实不常见。`;

console.log('测试内容:', testContent.split('\n')[0]);

// 原始正则（Web服务器旧版）
const oldRegex = /^<!-- AI检测:\s*(\d+(?:\.\d+)?%?)\s*\|\s*检测时间:\s*([^-]+?)\s*-->/;
console.log('\n原始正则匹配:', testContent.match(oldRegex));

// 新正则（修复版）
const newRegex = /<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([\d\s:-]+)\s*-->/;
console.log('\n新正则匹配:', testContent.match(newRegex));

// 测试不同的变体
const variants = [
    /^<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([\d\s:-]+)\s*-->/,
    /<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([^>]+)\s*-->/,
    /<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*(.+?)\s*-->/
];

console.log('\n测试其他变体:');
variants.forEach((regex, index) => {
    const match = testContent.match(regex);
    console.log(`变体${index + 1}:`, match ? '✅ 匹配' : '❌ 不匹配', match ? match.slice(0, 3) : '');
});

// 最终推荐的正则
const recommendedRegex = /<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([^>]+?)\s*-->/;
const match = testContent.match(recommendedRegex);
console.log('\n推荐正则结果:');
if (match) {
    console.log('✅ 匹配成功');
    console.log('AI概率:', match[1] + '%');
    console.log('检测时间:', match[2].trim());
}