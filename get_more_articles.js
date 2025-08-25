#!/usr/bin/env node

const GolfComScraper = require('./golf_com_scraper');
const GolfMonthlyScraper = require('./golf_monthly_scraper');
const MyGolfSpyScraper = require('./mygolfspy_scraper');
const GolfWRXScraper = require('./golfwrx_scraper');
const BatchArticleProcessor = require('./batch_process_articles');

async function getMoreArticles() {
    console.log('🎯 获取更多未处理的文章...\n');
    
    const allUrls = [];
    
    // Golf.com - 获取更多文章
    console.log('📌 Golf.com...');
    try {
        const golfComScraper = new GolfComScraper();
        const golfComUrls = await golfComScraper.getRecentArticles(15);
        console.log(`  找到 ${golfComUrls.length} 篇文章`);
        // 跳过前10篇（可能已处理）
        allUrls.push(...golfComUrls.slice(10, 13));
    } catch (e) {
        console.error(`  ❌ 错误: ${e.message}`);
    }
    
    // Golf Monthly - 获取更多文章
    console.log('\n📌 Golf Monthly...');
    try {
        const golfMonthlyScraper = new GolfMonthlyScraper();
        const golfMonthlyUrls = await golfMonthlyScraper.getRecentArticles(10);
        console.log(`  找到 ${golfMonthlyUrls.length} 篇文章`);
        // 跳过前5篇（可能已处理）
        allUrls.push(...golfMonthlyUrls.slice(5, 7));
    } catch (e) {
        console.error(`  ❌ 错误: ${e.message}`);
    }
    
    // MyGolfSpy - 从RSS获取
    console.log('\n📌 MyGolfSpy (RSS)...');
    try {
        const Parser = require('rss-parser');
        const parser = new Parser();
        const feed = await parser.parseURL('https://mygolfspy.com/feed/');
        const mygolfspyUrls = feed.items.slice(2, 4).map(item => item.link);
        console.log(`  找到 ${mygolfspyUrls.length} 篇文章`);
        allUrls.push(...mygolfspyUrls);
    } catch (e) {
        console.error(`  ❌ 错误: ${e.message}`);
    }
    
    // GolfWRX - 获取更多文章
    console.log('\n📌 GolfWRX...');
    try {
        const golfWRXScraper = new GolfWRXScraper();
        const golfWRXUrls = await golfWRXScraper.getRecentArticles(3);
        console.log(`  找到 ${golfWRXUrls.length} 篇文章`);
        // 跳过第一篇（已处理）
        allUrls.push(...golfWRXUrls.slice(1, 3));
    } catch (e) {
        console.error(`  ❌ 错误: ${e.message}`);
    }
    
    console.log(`\n📊 总计收集 ${allUrls.length} 个URL`);
    
    if (allUrls.length > 0) {
        console.log('\n📝 准备处理的URL:');
        allUrls.forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
        
        const processor = new BatchArticleProcessor();
        console.log('\n🚀 开始批量处理...');
        await processor.processArticles(allUrls);
        
        console.log('\n✅ 处理完成！');
    } else {
        console.log('\n❌ 没有找到新的URL');
    }
}

getMoreArticles().catch(console.error);