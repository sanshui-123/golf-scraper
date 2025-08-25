#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');

async function processSpecificArticles() {
    console.log('🎯 处理特定的文章...\n');
    
    // 这些是可能还未处理的文章URL
    const urlsToProcess = [
        // Golf.com - 其他相关文章
        'https://golf.com/news/open-championship-2025-sunday-tee-times/',
        'https://golf.com/news/pga-tour-players-react-scottie-scheffler-open/',
        
        // Golf Monthly - 装备评测文章
        'https://www.golfmonthly.com/features/best-evnroll-putters-2025',
        'https://www.golfmonthly.com/features/best-new-balance-golf-shoes-2025',
        
        // MyGolfSpy - 最新文章
        'https://mygolfspy.com/news-opinion/golf-news/2025-3m-open-prize-money/',
        'https://mygolfspy.com/news-opinion/jordan-spieth-wrist-surgery-timeline/',
        
        // GolfWRX - 论坛热门
        'https://www.golfwrx.com/759875/witb-scottie-scheffler-2025-the-open-championship/',
        'https://www.golfwrx.com/759798/2025-best-utility-irons/'
    ];
    
    const processor = new BatchArticleProcessor();
    
    console.log('📝 准备处理以下URL:');
    urlsToProcess.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
    });
    
    console.log('\n🚀 开始批量处理...');
    
    try {
        await processor.processArticles(urlsToProcess);
        console.log('\n✅ 处理完成！');
    } catch (error) {
        console.error('\n❌ 处理出错:', error.message);
    }
}

processSpecificArticles().catch(console.error);