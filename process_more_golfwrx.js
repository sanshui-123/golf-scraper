#!/usr/bin/env node

const GolfWRXScraper = require('./golfwrx_scraper');
const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

// 获取已处理的URL
function getProcessedUrls() {
    const processedUrls = new Set();
    const golfContentDir = './golf_content';
    const dates = fs.readdirSync(golfContentDir).filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/));
    
    dates.forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (fs.existsSync(urlsFile)) {
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                Object.values(urls).forEach(url => {
                    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                    processedUrls.add(cleanUrl);
                });
            } catch (e) {}
        }
    });
    
    return processedUrls;
}

async function processMoreGolfWRX() {
    console.log('🎯 专门获取更多GolfWRX文章...\n');
    
    const processedUrls = getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}`);
    
    // 统计GolfWRX已处理数量
    let golfwrxProcessed = 0;
    processedUrls.forEach(url => {
        if (url.includes('golfwrx.com')) {
            golfwrxProcessed++;
        }
    });
    console.log(`📊 GolfWRX已处理: ${golfwrxProcessed} 篇\n`);
    
    // 获取更多GolfWRX文章
    console.log('🔍 获取GolfWRX最新文章...');
    const scraper = new GolfWRXScraper();
    
    try {
        // 获取150篇文章确保有足够的未处理文章
        const golfwrxUrls = await scraper.getRecentArticles(150);
        console.log(`✅ 获取到 ${golfwrxUrls.length} 篇文章`);
        
        // 过滤未处理的
        const unprocessed = golfwrxUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        
        console.log(`📊 未处理文章: ${unprocessed.length} 篇\n`);
        
        if (unprocessed.length === 0) {
            console.log('✅ 没有新的未处理文章！');
            return;
        }
        
        // 显示前10个未处理文章
        console.log('📝 未处理文章示例:');
        unprocessed.slice(0, 10).forEach((url, i) => {
            console.log(`  ${i+1}. ${url}`);
        });
        if (unprocessed.length > 10) {
            console.log(`  ... 还有 ${unprocessed.length - 10} 篇\n`);
        }
        
        // 处理文章（每批10篇）
        console.log('🚀 开始批量处理...');
        const processor = new BatchArticleProcessor();
        const batchSize = 10;
        
        // 只处理前30篇避免时间过长
        const toProcess = unprocessed.slice(0, 30);
        console.log(`📊 本次将处理 ${toProcess.length} 篇文章\n`);
        
        for (let i = 0; i < toProcess.length; i += batchSize) {
            const batch = toProcess.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(toProcess.length/batchSize);
            
            console.log(`\n📦 处理第 ${batchNum}/${totalBatches} 批（${batch.length} 篇）`);
            
            try {
                await processor.processArticles(batch);
                console.log(`✅ 第 ${batchNum} 批处理完成`);
                
                // 批次间休息
                if (i + batchSize < toProcess.length) {
                    console.log('⏸️  休息15秒后继续...');
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }
            } catch (error) {
                console.error(`❌ 第 ${batchNum} 批处理失败:`, error.message);
            }
        }
        
        console.log('\n✅ 处理完成！');
        
        // 保存剩余未处理的URL
        if (unprocessed.length > toProcess.length) {
            const remaining = unprocessed.slice(toProcess.length);
            const outputFile = `golfwrx_remaining_${Date.now()}.json`;
            fs.writeFileSync(outputFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                totalRemaining: remaining.length,
                urls: remaining
            }, null, 2));
            console.log(`\n💾 剩余 ${remaining.length} 篇未处理文章已保存到: ${outputFile}`);
        }
        
    } catch (error) {
        console.error('❌ 获取文章失败:', error.message);
    }
}

// 执行
if (require.main === module) {
    processMoreGolfWRX()
        .then(() => {
            console.log('\n✅ 全部完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = processMoreGolfWRX;