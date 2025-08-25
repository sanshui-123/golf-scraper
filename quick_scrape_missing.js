#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');

async function quickScrapeMissing() {
    console.log('🔍 快速抓取缺失的文章...\n');
    
    // 准备一些可能未处理的URL
    const potentialUrls = [
        // Golf.com - 更多文章
        'https://golf.com/news/scottie-scheffler-wins-2025-open-championship/',
        'https://golf.com/news/open-championship-2025-final-leaderboard/',
        
        // Golf Monthly - 更多文章  
        'https://www.golfmonthly.com/news/scottie-scheffler-open-dominance',
        'https://www.golfmonthly.com/news/best-evnroll-putters-2025',
        
        // MyGolfSpy - 更多文章
        'https://mygolfspy.com/news-opinion/scotty-cameron-putters-review/',
        'https://mygolfspy.com/news-opinion/best-golf-balls-2025/',
        
        // GolfWRX - 更多文章
        'https://www.golfwrx.com/news/',
        'https://www.golfwrx.com/equipment/'
    ];
    
    const processor = new BatchArticleProcessor();
    
    // 只处理前4个URL来填补缺失的编号
    const urlsToProcess = potentialUrls.slice(0, 4);
    
    console.log('📝 准备处理以下URL:');
    urlsToProcess.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
    });
    
    console.log('\n🚀 开始处理...');
    await processor.processArticles(urlsToProcess);
    
    console.log('\n✅ 处理完成！');
}

quickScrapeMissing().catch(console.error);