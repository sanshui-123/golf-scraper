#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');

async function processAllUnprocessed() {
    const data = JSON.parse(fs.readFileSync('unprocessed_all_1753167070881.json', 'utf8'));
    
    console.log('🚀 开始批量处理未处理文章...');
    console.log('📊 总计 ' + data.totalUnprocessed + ' 篇文章待处理\n');
    
    const processor = new BatchArticleProcessor();
    
    // 按优先级处理
    const priority = ['golfwrx.com', 'mygolfspy.com', 'golf.com', 'golfmonthly.com'];
    
    for (const website of priority) {
        const urls = data.unprocessedByWebsite[website];
        if (!urls || urls.length === 0) continue;
        
        console.log('\n' + '='.repeat(50));
        console.log('🌐 处理 ' + website + ' (' + urls.length + ' 篇)');
        console.log('='.repeat(50) + '\n');
        
        // 根据网站设置批次大小
        const batchSize = website === 'golfwrx.com' ? 10 : 
                         website === 'mygolfspy.com' ? 10 : 15;
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(urls.length/batchSize);
            
            console.log('\n📦 处理第 ' + batchNum + '/' + totalBatches + ' 批（' + batch.length + ' 篇）');
            
            try {
                await processor.processArticles(batch);
                console.log('✅ 第 ' + batchNum + ' 批处理完成');
                
                // 批次间休息
                if (i + batchSize < urls.length) {
                    const restTime = website === 'golfwrx.com' ? 15000 : 10000;
                    console.log('⏸️  休息' + (restTime/1000) + '秒后继续...');
                    await new Promise(resolve => setTimeout(resolve, restTime));
                }
            } catch (error) {
                console.error('❌ 第 ' + batchNum + ' 批处理失败:', error.message);
            }
        }
    }
    
    console.log('\n✅ 所有文章处理完成！');
}

if (require.main === module) {
    processAllUnprocessed()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ 处理失败:', error);
            process.exit(1);
        });
}
