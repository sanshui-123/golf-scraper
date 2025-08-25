#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');

async function scrapeRemainingSites() {
    console.log('🎯 抓取MyGolfSpy和GolfWRX的更多文章...\n');
    
    const processor = new BatchArticleProcessor();
    
    // MyGolfSpy RSS文章
    console.log('📌 获取MyGolfSpy RSS文章...');
    const Parser = require('rss-parser');
    const parser = new Parser();
    
    try {
        const feed = await parser.parseURL('https://mygolfspy.com/feed/');
        const mygolfspyUrls = feed.items
            .slice(0, 8)  // 获取前8篇
            .map(item => item.link)
            .filter(url => {
                // 过滤掉已经处理过的
                return !url.includes('were-seeing-the-best-golf-since-tiger') &&
                       !url.includes('open-championship-prize-money-2025');
            });
        
        console.log(`  找到 ${mygolfspyUrls.length} 篇新文章`);
        
        // GolfWRX文章
        console.log('\n📌 获取GolfWRX文章...');
        const GolfWRXScraper = require('./golfwrx_scraper');
        const golfwrxScraper = new GolfWRXScraper();
        const golfwrxUrls = await golfwrxScraper.getRecentArticles(5);
        
        // 过滤掉已处理的
        const newGolfwrxUrls = golfwrxUrls.filter(url => 
            !url.includes('759308/2025-best-irons-best-blades')
        );
        
        console.log(`  找到 ${newGolfwrxUrls.length} 篇新文章`);
        
        // 合并所有URL
        const allUrls = [...mygolfspyUrls.slice(0, 4), ...newGolfwrxUrls.slice(0, 4)];
        
        if (allUrls.length > 0) {
            console.log(`\n📊 准备处理 ${allUrls.length} 篇文章:`);
            allUrls.forEach((url, index) => {
                console.log(`  ${index + 1}. ${url}`);
            });
            
            console.log('\n🚀 开始批量处理...');
            await processor.processArticles(allUrls);
            
            console.log('\n✅ 处理完成！');
        } else {
            console.log('\n❌ 没有找到新文章');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

scrapeRemainingSites().catch(console.error);