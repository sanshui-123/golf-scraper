#!/usr/bin/env node

const urls = [
    'https://www.golfmonthly.com/news/phil-mickelson-tiger-woods-head-to-head-record',
    'https://www.golfmonthly.com/features/im-a-golf-historian-and-these-5-records-blow-my-mind'
];

console.log(`\n准备处理 ${urls.length} 个URL...\n`);

const BatchProcessor = require('./batch_process_articles');
const processor = new BatchProcessor();

processor.processArticles(urls).then(() => {
    console.log('\n✅ 全部处理完成！');
}).catch(error => {
    console.error('\n❌ 处理出错:', error);
});