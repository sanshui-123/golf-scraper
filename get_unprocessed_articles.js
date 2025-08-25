#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GolfComScraper = require('./golf_com_scraper');
const GolfMonthlyScraper = require('./golf_monthly_scraper');
const MyGolfSpyScraper = require('./mygolfspy_scraper');
const GolfWRXScraper = require('./golfwrx_scraper');

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

async function getUnprocessedArticles() {
    console.log('🔍 开始获取4个网站的未处理文章...\n');
    
    const processedUrls = await getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}\n`);
    
    const unprocessedByWebsite = {};
    
    // 1. Golf.com
    console.log('1️⃣ 正在获取 Golf.com 文章...');
    try {
        const golfComScraper = new GolfComScraper();
        const golfComUrls = await golfComScraper.getRecentArticles(50);
        const unprocessedGolfCom = golfComUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        unprocessedByWebsite['golf.com'] = unprocessedGolfCom;
        console.log(`   ✅ Golf.com: 获取${golfComUrls.length}篇，未处理${unprocessedGolfCom.length}篇`);
    } catch (error) {
        console.error('   ❌ Golf.com 获取失败:', error.message);
        unprocessedByWebsite['golf.com'] = [];
    }
    
    // 2. Golf Monthly
    console.log('\n2️⃣ 正在获取 Golf Monthly 文章...');
    try {
        const golfMonthlyScraper = new GolfMonthlyScraper();
        const golfMonthlyUrls = await golfMonthlyScraper.getRecentArticles(50);
        const unprocessedGolfMonthly = golfMonthlyUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        unprocessedByWebsite['golfmonthly.com'] = unprocessedGolfMonthly;
        console.log(`   ✅ Golf Monthly: 获取${golfMonthlyUrls.length}篇，未处理${unprocessedGolfMonthly.length}篇`);
    } catch (error) {
        console.error('   ❌ Golf Monthly 获取失败:', error.message);
        unprocessedByWebsite['golfmonthly.com'] = [];
    }
    
    // 3. MyGolfSpy
    console.log('\n3️⃣ 正在获取 MyGolfSpy 文章...');
    try {
        const myGolfSpyScraper = new MyGolfSpyScraper();
        const myGolfSpyUrls = await myGolfSpyScraper.getRecentArticles(50);
        const unprocessedMyGolfSpy = myGolfSpyUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        unprocessedByWebsite['mygolfspy.com'] = unprocessedMyGolfSpy;
        console.log(`   ✅ MyGolfSpy: 获取${myGolfSpyUrls.length}篇，未处理${unprocessedMyGolfSpy.length}篇`);
    } catch (error) {
        console.error('   ❌ MyGolfSpy 获取失败:', error.message);
        unprocessedByWebsite['mygolfspy.com'] = [];
    }
    
    // 4. GolfWRX
    console.log('\n4️⃣ 正在获取 GolfWRX 文章...');
    try {
        const golfWRXScraper = new GolfWRXScraper();
        const golfWRXUrls = await golfWRXScraper.getRecentArticles(100); // 获取更多因为之前处理的少
        const unprocessedGolfWRX = golfWRXUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        unprocessedByWebsite['golfwrx.com'] = unprocessedGolfWRX;
        console.log(`   ✅ GolfWRX: 获取${golfWRXUrls.length}篇，未处理${unprocessedGolfWRX.length}篇`);
    } catch (error) {
        console.error('   ❌ GolfWRX 获取失败:', error.message);
        unprocessedByWebsite['golfwrx.com'] = [];
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
    
    // 保存到文件
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
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
    
    // 创建批处理脚本
    const batchScript = `#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');

async function processAllUnprocessed() {
    const data = JSON.parse(fs.readFileSync('${outputFile}', 'utf8'));
    
    console.log('🚀 开始批量处理所有未处理文章...');
    console.log('📊 总计 ' + data.totalUnprocessed + ' 篇文章待处理\\n');
    
    const processor = new BatchArticleProcessor();
    
    // 按网站分批处理
    for (const [website, urls] of Object.entries(data.unprocessedByWebsite)) {
        if (urls.length === 0) continue;
        
        console.log('\\n' + '='.repeat(50));
        console.log('🌐 处理 ' + website + ' (' + urls.length + ' 篇)');
        console.log('='.repeat(50) + '\\n');
        
        // 每次处理10篇，避免内存问题
        const batchSize = 10;
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            console.log('\\n📦 处理第 ' + (Math.floor(i/batchSize) + 1) + '/' + Math.ceil(urls.length/batchSize) + ' 批');
            
            try {
                await processor.processArticles(batch);
                console.log('✅ 批次处理完成');
                
                // 批次间休息
                if (i + batchSize < urls.length) {
                    console.log('⏸️  休息10秒后继续...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            } catch (error) {
                console.error('❌ 批次处理失败:', error.message);
            }
        }
    }
    
    console.log('\\n✅ 所有文章处理完成！');
}

if (require.main === module) {
    processAllUnprocessed().catch(console.error);
}
`;
    
    const batchScriptFile = `process_unprocessed_${timestamp}.js`;
    fs.writeFileSync(batchScriptFile, batchScript);
    fs.chmodSync(batchScriptFile, '755');
    console.log(`\n📜 批处理脚本已创建: ${batchScriptFile}`);
    console.log(`   运行命令: node ${batchScriptFile}`);
    
    return outputData;
}

// 运行主函数
if (require.main === module) {
    getUnprocessedArticles()
        .then(() => {
            console.log('\n✅ 完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = getUnprocessedArticles;