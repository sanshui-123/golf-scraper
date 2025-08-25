#!/usr/bin/env node

/**
 * 批量处理文章的启动脚本
 * 使用方法：
 * 1. 直接运行处理默认URL：node start.js
 * 2. 处理指定URL：node start.js "url1" "url2" ...
 */

const BatchProcessor = require('./batch_process_articles');

// 从命令行参数获取URL，如果没有则使用默认URL
const urls = process.argv.slice(2).length > 0 
    ? process.argv.slice(2)
    : [
        // 在这里添加默认要处理的URL
        'https://www.golfmonthly.com/example-article-1',
        'https://www.golfmonthly.com/example-article-2'
    ];

if (urls.length === 0 || urls[0].includes('example')) {
    console.log('使用方法:');
    console.log('  node start.js "url1" "url2" ...');
    console.log('\n示例:');
    console.log('  node start.js "https://www.golfmonthly.com/news/some-article"');
    process.exit(0);
}

console.log(`准备处理 ${urls.length} 个URL...\n`);

const processor = new BatchProcessor();
processor.processArticles(urls)
    .then(() => {
        console.log('\n✅ 处理完成！');
    })
    .catch(error => {
        console.error('\n❌ 处理出错:', error);
        process.exit(1);
    });
