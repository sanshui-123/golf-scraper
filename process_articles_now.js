#!/usr/bin/env node

// 从命令行参数获取URLs
const args = process.argv.slice(2);
let urls = [];

if (args.length > 0) {
    // 如果有命令行参数，使用传入的URLs
    urls = args;
    console.log(`\n准备处理 ${urls.length} 个URL...\n`);
    urls.forEach((url, index) => {
        console.log(`文章${index + 1}: ${url}`);
    });
    console.log('');
} else {
    // 如果没有参数，使用默认URL（保持向后兼容）
    urls = [
        'https://www.golfmonthly.com/news/example-article'
    ];
    console.log(`\n准备处理 ${urls.length} 个URL...\n`);
    console.log('提示：你可以通过命令行传入URL，例如：');
    console.log('node process_articles_now.js "https://example.com/article1" "https://example.com/article2"\n');
}

const BatchProcessor = require('./batch_process_articles');
const processor = new BatchProcessor();

processor.processArticles(urls).then(() => {
    console.log('\n✅ 全部处理完成！');
}).catch(error => {
    console.error('\n❌ 处理出错:', error);
});