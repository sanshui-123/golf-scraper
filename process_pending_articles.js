#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');

async function processPendingArticles() {
    console.log('📋 开始处理所有待处理的文章...\n');
    
    // 读取失败文章列表
    const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
    
    // 筛选待处理的真实URL（排除示例和无效URL）
    const pendingUrls = Object.entries(failedArticles)
        .filter(([url, data]) => {
            return data.status === 'pending_retry' && 
                   url.startsWith('https://www.golfmonthly.com/') &&
                   !url.includes('example.com') &&
                   !url.match(/^url\d+$/);
        })
        .map(([url]) => url);
    
    console.log(`📊 找到 ${pendingUrls.length} 篇待处理的文章\n`);
    
    if (pendingUrls.length === 0) {
        console.log('✅ 没有待处理的文章！');
        return;
    }
    
    // 显示待处理的URL
    pendingUrls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
    
    console.log('\n🚀 开始批量处理...\n');
    
    const processor = new BatchProcessor();
    
    try {
        await processor.processArticles(pendingUrls);
        console.log('\n✅ 所有待处理文章处理完成！');
    } catch (error) {
        console.error('\n❌ 处理待处理文章时出错:', error);
    }
}

processPendingArticles();