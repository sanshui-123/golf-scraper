#!/usr/bin/env node

const fs = require('fs');
const BatchProcessor = require('./batch_process_articles');

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('请提供URL文件路径');
    console.error('用法: node run_batch_processor.js <urls.json>');
    process.exit(1);
}

const urlFile = args[0];

// 读取URL文件
let urls;
try {
    const content = fs.readFileSync(urlFile, 'utf8');
    urls = JSON.parse(content);
} catch (error) {
    console.error('读取URL文件失败:', error.message);
    process.exit(1);
}

console.log(`\n从 ${urlFile} 读取到 ${urls.length} 个URL\n`);

// 处理URL
const processor = new BatchProcessor();
processor.processArticles(urls).then(() => {
    console.log('\n✅ 批处理完成！');
}).catch(error => {
    console.error('\n❌ 处理出错:', error);
});