#!/usr/bin/env node

// 修复文本预处理的正则表达式问题

function currentProcessing(text) {
    // 当前系统的处理方式（有问题）
    let processed = text;
    processed = processed.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
    processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    return processed;
}

function improvedProcessing(text) {
    // 改进的处理方式
    let processed = text;
    
    // 1. 移除图片占位符
    processed = processed.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
    
    // 2. 正确处理Markdown图片（先处理图片，再处理链接）
    processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, ''); // 完全移除图片
    
    // 3. 处理普通Markdown链接
    processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // 4. 清理多余的空行
    processed = processed.replace(/\n\n\n+/g, '\n\n');
    
    return processed.trim();
}

// 测试示例
const testText = `看到这支平克BunkR挖起杆的时候，说不好奇是假的。64度的杆面角，这在一般球友的球包里确实不常见。

![The Ping BunkR wedge.](../images/golf_image_10086_1.avif)

平时我不会建议休闲球友或者周末球手带着64度的挖起杆下场，但这次彻底测试了这支球杆后，我发现这恰恰就是为这类球手设计的。

这里有个[链接文本](https://example.com)和另一个[测试链接](https://test.com)。

[IMAGE_1:这是一个图片占位符]

更多内容...`;

console.log('🔧 文本预处理对比测试\n');
console.log('原始文本长度:', testText.length);

const current = currentProcessing(testText);
const improved = improvedProcessing(testText);

console.log('\n当前处理结果长度:', current.length);
console.log('改进处理结果长度:', improved.length);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('当前处理结果（有问题）:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(current);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('改进处理结果（建议）:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(improved);

console.log('\n💡 建议修改 batch_process_articles.js 中的 processArticleWithAIDetection 方法：');
console.log(`
// 原代码：
textContent = textContent.replace(/\\[IMAGE_\\d+:[^\\]]+\\]/g, '');
textContent = textContent.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1');

// 建议改为：
textContent = textContent.replace(/\\[IMAGE_\\d+:[^\\]]+\\]/g, '');
textContent = textContent.replace(/!\\[([^\\]]*)\\]\\([^)]+\\)/g, ''); // 完全移除图片
textContent = textContent.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1'); // 保留链接文本
textContent = textContent.replace(/\\n\\n\\n+/g, '\\n\\n'); // 清理多余空行
`);