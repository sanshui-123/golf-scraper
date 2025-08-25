#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');

// 要处理的文章URL
const urls = [
    'https://www.golfmonthly.com/news/tour-pro-reveals-just-how-much-pga-tour-players-really-earn'
];

console.log('开始处理文章...');
console.log(`URL: ${urls[0]}`);

const processor = new BatchArticleProcessor();
processor.processArticles(urls)
    .then(() => {
        console.log('\n✅ 处理完成！');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ 处理失败:', error);
        process.exit(1);
    });