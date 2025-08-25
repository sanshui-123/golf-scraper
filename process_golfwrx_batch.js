#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const GolfWRXScraper = require('./golfwrx_scraper');

async function processGolfWRXBatch() {
    console.log('🏌️ 开始批量处理GolfWRX文章...\n');
    console.log('💡 浏览器将在后台运行，不会影响您的桌面\n');
    
    try {
        // 1. 获取GolfWRX文章URL
        console.log('📋 步骤1: 获取GolfWRX文章URL...');
        const scraper = new GolfWRXScraper();
        const urls = await scraper.getRecentArticles(88); // 获取88篇文章
        
        console.log(`\n✅ 成功获取 ${urls.length} 个URL`);
        
        if (urls.length === 0) {
            console.log('❌ 没有获取到文章URL');
            return;
        }
        
        // 显示前5个URL作为示例
        console.log('\n📰 文章示例（前5篇）:');
        urls.slice(0, 5).forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`);
        });
        console.log(`  ... 还有 ${urls.length - 5} 篇文章\n`);
        
        // 2. 批量处理文章
        console.log('📋 步骤2: 开始批量处理文章...');
        console.log('⏱️  预计需要时间:', Math.round(urls.length * 30 / 60), '分钟\n');
        
        const processor = new BatchArticleProcessor();
        
        // 分批处理，每批10篇，避免内存占用过多
        const batchSize = 10;
        let processedCount = 0;
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(urls.length / batchSize);
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📦 处理第 ${batchNum}/${totalBatches} 批（${batch.length} 篇）`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            try {
                await processor.processArticles(batch);
                processedCount += batch.length;
                
                console.log(`\n✅ 第 ${batchNum} 批处理完成`);
                console.log(`📊 总进度: ${processedCount}/${urls.length} (${Math.round(processedCount/urls.length*100)}%)`);
                
                // 批次之间休息一下
                if (i + batchSize < urls.length) {
                    console.log('\n⏸️  休息10秒后继续下一批...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
                
            } catch (error) {
                console.error(`\n❌ 第 ${batchNum} 批处理失败:`, error.message);
                console.log('📌 将继续处理下一批...');
            }
        }
        
        console.log('\n🎉 所有批次处理完成！');
        console.log(`📊 最终统计: 成功处理 ${processedCount} 篇文章`);
        
        // 显示处理结果
        const today = new Date().toISOString().split('T')[0];
        console.log(`\n📁 文章保存位置: golf_content/${today}/`);
        console.log('🌐 访问 http://localhost:8080 查看处理结果');
        
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
        console.error(error.stack);
    }
}

// 运行处理
if (require.main === module) {
    console.log('🚀 GolfWRX批量处理程序启动...');
    console.log('📅 时间:', new Date().toLocaleString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    processGolfWRXBatch()
        .then(() => {
            console.log('\n✅ 程序执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 程序执行失败:', error);
            process.exit(1);
        });
}