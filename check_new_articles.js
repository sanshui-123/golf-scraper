#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GolfWRXScraper = require('./golfwrx_scraper');

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

async function checkNewArticles() {
    console.log('🔍 检查各网站是否有新文章...\n');
    
    const processedUrls = getProcessedUrls();
    const websiteStats = {};
    
    // 统计各网站已处理数量
    processedUrls.forEach(url => {
        const domain = new URL(url).hostname.replace('www.', '');
        websiteStats[domain] = (websiteStats[domain] || 0) + 1;
    });
    
    console.log('📊 已处理文章统计:');
    Object.entries(websiteStats).forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} 篇`);
    });
    console.log();
    
    // 1. 检查GolfWRX
    console.log('🎯 检查GolfWRX...');
    try {
        const golfwrxScraper = new GolfWRXScraper();
        const golfwrxUrls = await golfwrxScraper.getRecentArticles(30);
        
        const unprocessedGolfwrx = golfwrxUrls.filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        
        console.log(`✅ 获取到 ${golfwrxUrls.length} 篇文章`);
        console.log(`🆕 未处理: ${unprocessedGolfwrx.length} 篇`);
        
        if (unprocessedGolfwrx.length > 0) {
            console.log('\n未处理的GolfWRX文章:');
            unprocessedGolfwrx.slice(0, 10).forEach((url, i) => {
                console.log(`${i+1}. ${url}`);
            });
            if (unprocessedGolfwrx.length > 10) {
                console.log(`... 还有 ${unprocessedGolfwrx.length - 10} 篇`);
            }
            
            // 保存到文件
            fs.writeFileSync('new_golfwrx_articles.txt', unprocessedGolfwrx.join('\n'));
            console.log('\n💾 已保存到: new_golfwrx_articles.txt');
        }
    } catch (error) {
        console.error('❌ GolfWRX检查失败:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 2. 使用scrape_three_sites_fixed.js检查其他网站
    console.log('🔍 使用scrape_three_sites_fixed.js检查其他网站...\n');
    console.log('请运行: node scrape_three_sites_fixed.js');
    console.log('这将显示Golf.com、Golf Monthly和MyGolfSpy的新文章');
}

// 执行
if (require.main === module) {
    checkNewArticles()
        .then(() => {
            console.log('\n✅ 检查完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = checkNewArticles;