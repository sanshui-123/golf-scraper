#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');

async function processMGSandGWRX() {
    console.log('🎯 处理MyGolfSpy和GolfWRX文章...\n');
    
    const processor = new BatchArticleProcessor();
    
    // MyGolfSpy文章 - 从测试中获取的URL
    const mygolfspyUrls = [
        'https://mygolfspy.com/news-opinion/only-one-club-changed-in-scotties-bag-this-week/',
        'https://mygolfspy.com/news-opinion/are-these-funky-looking-putters-breakthroughs-in-putter-design/',
        'https://mygolfspy.com/buyers-guides/players-irons/top-3-most-accurate-players-irons-2025-2/',
        'https://mygolfspy.com/buyers-guides/all/best-golf-rangefinders-under-300/'
    ].filter(url => {
        // 过滤已处理的URL
        return !url.includes('were-seeing-the-best-golf-since-tiger') &&
               !url.includes('only-one-club-changed-in-scotties-bag');
    });
    
    // GolfWRX文章
    const golfwrxUrls = [
        'https://www.golfwrx.com/759308/2025-best-irons-best-blades/',
        'https://www.golfwrx.com/759446/best-golf-rangefinders-2025/',
        'https://www.golfwrx.com/759520/best-golf-shoes-2025/',
        'https://www.golfwrx.com/759612/best-putters-2025/'
    ];
    
    // 合并URL
    const allUrls = [...mygolfspyUrls, ...golfwrxUrls.slice(1, 4)]; // 第一个GolfWRX URL已处理
    
    console.log(`📊 准备处理 ${allUrls.length} 篇文章`);
    console.log('\n文章列表:');
    allUrls.forEach((url, index) => {
        const site = url.includes('mygolfspy') ? 'MyGolfSpy' : 'GolfWRX';
        console.log(`${index + 1}. [${site}] ${url}`);
    });
    
    console.log('\n🚀 开始批量处理...');
    
    try {
        await processor.processArticles(allUrls);
        console.log('\n✅ 处理完成！');
    } catch (error) {
        console.error('\n❌ 处理出错:', error.message);
    }
}

processMGSandGWRX().catch(console.error);