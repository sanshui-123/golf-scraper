#\!/usr/bin/env node

/**
 * 处理新发现的文章
 */

const BatchProcessor = require('./batch_process_articles');

async function processNewArticles() {
    console.log('🏌️ 处理新发现的文章...\n');
    
    // Golf Monthly的新文章
    const golfMonthlyUrls = [
        'https://www.golfmonthly.com/buying-advice/best-portable-launch-monitors',
        'https://www.golfmonthly.com/news/charlie-woods-misses-us-junior-amateur-cut'
    ];
    
    console.log('📊 发现新文章:');
    console.log('• Golf Monthly: 2篇新文章\n');
    
    // 使用批量处理器
    const processor = new BatchProcessor();
    
    try {
        // 处理Golf Monthly新文章
        if (golfMonthlyUrls.length > 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📰 处理Golf Monthly新文章');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            await processor.processArticles(golfMonthlyUrls, 'golfmonthly.com');
        }
        
        console.log('\n✅ 新文章处理完成！');
        
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
    }
}

// 运行
if (require.main === module) {
    processNewArticles().catch(console.error);
}
EOF < /dev/null