#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');

async function continueProcessing() {
    console.log('🔄 继续处理剩余的未处理文章...\n');
    
    // 获取所有待处理的文章
    const remainingUrls = [
        // 新闻类文章
        'https://www.golfmonthly.com/news/royal-portrush-facts-open-championship-host-course',
        'https://www.golfmonthly.com/news/open-championship-2025-form-guide-scheffler-mcilroy-schauffele-and-co',
        'https://www.golfmonthly.com/news/open-championship-2025-full-field-how-qualified',
        
        // 装备类文章
        'https://www.golfmonthly.com/buying-advice/best-beginner-golf-clubs-for-ladies',
        'https://www.golfmonthly.com/buying-advice/best-womens-golf-clubs-year',
        'https://www.golfmonthly.com/buying-advice/dont-tell-amazon-but-these-prime-day-golf-deals-are-still-live',
        'https://www.golfmonthly.com/buying-advice/i-cant-believe-this-new-putter-is-already-discounted-by-34-percent-on-amazons-final-prime-day',
        'https://www.golfmonthly.com/buying-advice/amazon-prime-day-ends-tonight-this-is-your-last-chance-to-pick-up-these-golf-balls-training-aids-and-accessories-under-usd50'
    ];
    
    console.log(`📊 准备逐个处理 ${remainingUrls.length} 篇剩余文章\n`);
    
    const processor = new BatchProcessor();
    let successCount = 0;
    let failCount = 0;
    
    // 逐个处理
    for (let i = 0; i < remainingUrls.length; i++) {
        const url = remainingUrls[i];
        const type = url.includes('buying-advice') ? '🛍️ 装备类' : '📰 新闻类';
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📄 处理进度: ${i + 1}/${remainingUrls.length}`);
        console.log(`${type} ${url}`);
        console.log(`${'='.repeat(60)}\n`);
        
        try {
            await processor.processArticles([url]);
            
            // 检查结果
            const failedList = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
            if (failedList[url] && failedList[url].status === 'success') {
                successCount++;
                console.log(`\n✅ 成功处理并同步到网页！`);
            } else {
                failCount++;
                console.log(`\n❌ 处理失败或跳过`);
            }
            
            console.log(`\n📊 当前统计: 成功 ${successCount} | 失败/跳过 ${failCount}`);
            
            // 休息3秒
            if (i < remainingUrls.length - 1) {
                console.log('\n⏳ 休息3秒后继续...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (error) {
            console.error(`\n❌ 处理错误: ${error.message}`);
            failCount++;
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 处理完成！');
    console.log(`✅ 成功: ${successCount} 篇`);
    console.log(`❌ 失败/跳过: ${failCount} 篇`);
    console.log(`\n🌐 访问查看: http://localhost:8080/articles/2025-07-15`);
}

continueProcessing();