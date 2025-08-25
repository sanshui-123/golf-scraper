#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GolfWRXScraper = require('./golfwrx_scraper');
const BatchArticleProcessor = require('./batch_process_articles');

async function getUnprocessedGolfWRX() {
    // 获取已处理的URL
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
    
    console.log('📊 已处理文章总数:', processedUrls.size);
    
    // 统计各网站文章数
    const websiteStats = {};
    dates.forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (fs.existsSync(urlsFile)) {
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                Object.values(urls).forEach(url => {
                    const domain = new URL(url).hostname.replace('www.', '');
                    websiteStats[domain] = (websiteStats[domain] || 0) + 1;
                });
            } catch (e) {}
        }
    });
    
    console.log('\n📈 各网站已处理统计:');
    Object.entries(websiteStats).sort((a, b) => b[1] - a[1]).forEach(([domain, count]) => {
        console.log(`  - ${domain}: ${count} 篇`);
    });
    
    // 获取GolfWRX文章
    console.log('\n🎯 获取GolfWRX最新文章...');
    const scraper = new GolfWRXScraper();
    const golfwrxUrls = await scraper.getRecentArticles(100);
    
    const unprocessed = golfwrxUrls.filter(url => {
        const cleanUrl = url.split('?')[0].replace(/\/$/, '');
        return !processedUrls.has(cleanUrl);
    });
    
    console.log('\n✅ GolfWRX统计:');
    console.log('  - 获取文章数:', golfwrxUrls.length);
    console.log('  - 已处理:', websiteStats['golfwrx.com'] || 0, '篇');
    console.log('  - 未处理:', unprocessed.length, '篇');
    
    // 保存结果
    const outputData = {
        timestamp: new Date().toISOString(),
        website: 'golfwrx.com',
        totalArticles: golfwrxUrls.length,
        processedCount: websiteStats['golfwrx.com'] || 0,
        unprocessedCount: unprocessed.length,
        unprocessedUrls: unprocessed
    };
    
    const outputFile = 'golfwrx_unprocessed.json';
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log('\n💾 未处理文章列表保存到:', outputFile);
    
    // 显示前10个未处理的文章
    if (unprocessed.length > 0) {
        console.log('\n📝 前10篇未处理文章:');
        unprocessed.slice(0, 10).forEach((url, i) => {
            console.log(`  ${i+1}. ${url}`);
        });
        
        if (unprocessed.length > 10) {
            console.log(`  ... 还有 ${unprocessed.length - 10} 篇`);
        }
    }
    
    // 询问是否立即处理
    console.log('\n💡 提示：运行以下命令处理这些文章:');
    console.log(`   node process_golfwrx_batch.js`);
    
    return outputData;
}

// 执行
if (require.main === module) {
    getUnprocessedGolfWRX()
        .then(() => {
            console.log('\n✅ 完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = getUnprocessedGolfWRX;