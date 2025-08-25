#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function getProcessedUrls() {
    const processedUrls = new Set();
    const golfContentDir = './golf_content';
    
    // 获取所有日期目录
    const dates = fs.readdirSync(golfContentDir).filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/));
    
    dates.forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (fs.existsSync(urlsFile)) {
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                Object.values(urls).forEach(url => {
                    // 标准化URL（去除查询参数）
                    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                    processedUrls.add(cleanUrl);
                });
            } catch (e) {}
        }
    });
    
    return processedUrls;
}

async function getAllUnprocessedArticles() {
    console.log('🔍 获取4个网站的未处理文章...\n');
    
    const processedUrls = await getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}\n`);
    
    // 使用现有的scraper脚本获取文章
    const unprocessedByWebsite = {};
    
    // 1. 使用discover_recent_articles.js获取新文章
    console.log('📰 获取各网站最新文章...');
    
    try {
        const discoverScript = require('./discover_recent_articles');
        const allRecentUrls = await discoverScript();
        
        // 按网站分组并过滤未处理的
        Object.entries(allRecentUrls).forEach(([website, urls]) => {
            const domain = website.replace('www.', '');
            const unprocessed = urls.filter(url => {
                const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                return !processedUrls.has(cleanUrl);
            });
            unprocessedByWebsite[domain] = unprocessed;
            console.log(`✅ ${domain}: 获取${urls.length}篇，未处理${unprocessed.length}篇`);
        });
        
    } catch (error) {
        console.error('❌ 获取失败:', error.message);
        
        // 备用方案：使用scrape_three_sites.js
        console.log('\n尝试备用方案...');
        const scrapeScript = require('./scrape_three_sites');
        const results = await scrapeScript();
        
        // 过滤未处理的文章
        Object.entries(results).forEach(([website, data]) => {
            const domain = website;
            const urls = data.urls || [];
            const unprocessed = urls.filter(url => {
                const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                return !processedUrls.has(cleanUrl);
            });
            unprocessedByWebsite[domain] = unprocessed;
            console.log(`✅ ${domain}: 获取${urls.length}篇，未处理${unprocessed.length}篇`);
        });
    }
    
    // 特别处理GolfWRX（使用专用scraper）
    if (!unprocessedByWebsite['golfwrx.com'] || unprocessedByWebsite['golfwrx.com'].length < 50) {
        console.log('\n🎯 使用GolfWRX专用抓取器获取更多文章...');
        try {
            const GolfWRXScraper = require('./golfwrx_scraper');
            const scraper = new GolfWRXScraper();
            const golfwrxUrls = await scraper.getRecentArticles(100);
            
            const unprocessedGolfWRX = golfwrxUrls.filter(url => {
                const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                return !processedUrls.has(cleanUrl);
            });
            
            unprocessedByWebsite['golfwrx.com'] = unprocessedGolfWRX;
            console.log(`✅ GolfWRX: 获取${golfwrxUrls.length}篇，未处理${unprocessedGolfWRX.length}篇`);
        } catch (error) {
            console.error('❌ GolfWRX获取失败:', error.message);
        }
    }
    
    // 汇总统计
    console.log('\n📊 未处理文章汇总:');
    console.log('═══════════════════════════════════════════');
    
    let totalUnprocessed = 0;
    Object.entries(unprocessedByWebsite).forEach(([website, urls]) => {
        console.log(`${website}: ${urls.length} 篇未处理`);
        totalUnprocessed += urls.length;
    });
    
    console.log('───────────────────────────────────────────');
    console.log(`总计: ${totalUnprocessed} 篇未处理文章`);
    
    // 保存结果
    const timestamp = Date.now();
    const outputFile = `unprocessed_articles_${timestamp}.json`;
    
    const outputData = {
        timestamp: new Date().toISOString(),
        totalProcessed: processedUrls.size,
        totalUnprocessed: totalUnprocessed,
        unprocessedByWebsite: unprocessedByWebsite,
        allUnprocessedUrls: Object.values(unprocessedByWebsite).flat()
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 未处理文章列表已保存到: ${outputFile}`);
    
    // 创建处理脚本
    const processScript = `#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');

async function processUnprocessedArticles() {
    const data = JSON.parse(fs.readFileSync('${outputFile}', 'utf8'));
    
    console.log('🚀 开始批量处理未处理文章...');
    console.log('📊 总计 ' + data.totalUnprocessed + ' 篇文章待处理\\n');
    
    const processor = new BatchArticleProcessor();
    
    // 优先级：GolfWRX > MyGolfSpy > Golf.com > Golf Monthly
    const priority = ['golfwrx.com', 'mygolfspy.com', 'golf.com', 'golfmonthly.com'];
    
    for (const website of priority) {
        const urls = data.unprocessedByWebsite[website];
        if (!urls || urls.length === 0) continue;
        
        console.log('\\n' + '='.repeat(50));
        console.log('🌐 处理 ' + website + ' (' + urls.length + ' 篇)');
        console.log('='.repeat(50) + '\\n');
        
        // GolfWRX每批10篇，其他网站每批15篇
        const batchSize = website === 'golfwrx.com' ? 10 : 15;
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(urls.length/batchSize);
            
            console.log('\\n📦 处理第 ' + batchNum + '/' + totalBatches + ' 批（' + batch.length + ' 篇）');
            
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
    
    console.log('\\n✅ 所有文章处理完成！');
}

if (require.main === module) {
    processUnprocessedArticles()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ 处理失败:', error);
            process.exit(1);
        });
}
`;
    
    const processScriptFile = `process_unprocessed_${timestamp}.js`;
    fs.writeFileSync(processScriptFile, processScript);
    fs.chmodSync(processScriptFile, '755');
    
    console.log(`\n📜 批处理脚本已创建: ${processScriptFile}`);
    console.log(`   运行命令: node ${processScriptFile}`);
    
    return outputData;
}

// 主函数
if (require.main === module) {
    getAllUnprocessedArticles()
        .then(() => {
            console.log('\n✅ 完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = getAllUnprocessedArticles;