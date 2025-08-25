#!/usr/bin/env node

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

async function processRemainingArticles() {
    console.log('🚀 开始处理剩余的未处理文章...\n');
    
    const processedUrls = getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}\n`);
    
    // 定义要处理的URL
    const urlsToProcess = [
        // Golf.com
        'https://golf.com/news/sights-sounds-open-championship-thursday/',
        'https://golf.com/news/phil-mickelson-open-championship-lead-sleeping/',
        
        // Golf Monthly
        'https://www.golfmonthly.com/news/live/the-open-championship-2025-leaderboard-scores',
        'https://www.golfmonthly.com/news/early-late-vs-late-early-is-there-a-draw-advantage-at-the-open-championship-this-year',
        'https://www.golfmonthly.com/news/what-did-we-learn-from-mark-darbons-slick-first-open-press-conference',
        'https://www.golfmonthly.com/news/wyndham-clark-banned-from-oakmont-after-us-open-incident',
        
        // MyGolfSpy
        'https://mygolfspy.com/news-opinion/instruction/putting-from-off-the-green-5-things-you-need-to-know/',
        'https://mygolfspy.com/news-opinion/instruction/golf-driver-stance-101-how-to-set-up-for-success-off-the-tee/',
        
        // GolfWRX - 从首页获取的最新文章
        'https://www.golfwrx.com/763729/watch-scenes-from-portrush-and-custom-gear-at-the-open-championship/',
        'https://www.golfwrx.com/763739/the-boring-way-scottie-scheffler-destroys-golf-courses-and-how-you-can-too/',
        'https://www.golfwrx.com/763711/tour-caddie-shoots-202-in-u-s-am-qualifier-and-gets-dqd-after-the-event/',
        'https://www.golfwrx.com/763717/equipment-changes-come-full-circle-for-choi/',
        'https://www.golfwrx.com/763669/xander-schauffele-left-handed-double-eagle-troon/',
        'https://www.golfwrx.com/763695/instruction-only-change-the-things-that-need-to-be-changed/',
        'https://www.golfwrx.com/763721/scottie-scheffler-uses-special-putter-grip-at-open-championship/',
        'https://www.golfwrx.com/763705/whats-in-the-bag-open-championship-leader-billy-horschel/',
        'https://www.golfwrx.com/763689/justin-thomas-caught-on-hot-mic-dropping-f-bomb-at-open-championship/',
        'https://www.golfwrx.com/763675/check-out-the-prize-money-payout-for-the-2025-open-championship/'
    ];
    
    // 过滤未处理的URL
    const unprocessedUrls = urlsToProcess.filter(url => {
        const cleanUrl = url.split('?')[0].replace(/\/$/, '');
        return !processedUrls.has(cleanUrl);
    });
    
    console.log(`📊 找到 ${unprocessedUrls.length} 篇未处理文章\n`);
    
    if (unprocessedUrls.length === 0) {
        console.log('✅ 没有未处理的文章！');
        return;
    }
    
    // 按网站分组
    const urlsByWebsite = {};
    unprocessedUrls.forEach(url => {
        let website = '';
        if (url.includes('golf.com')) website = 'golf.com';
        else if (url.includes('golfmonthly.com')) website = 'golfmonthly.com';
        else if (url.includes('mygolfspy.com')) website = 'mygolfspy.com';
        else if (url.includes('golfwrx.com')) website = 'golfwrx.com';
        
        if (!urlsByWebsite[website]) urlsByWebsite[website] = [];
        urlsByWebsite[website].push(url);
    });
    
    // 显示按网站分组的统计
    console.log('📊 按网站分组:');
    Object.entries(urlsByWebsite).forEach(([website, urls]) => {
        console.log(`   ${website}: ${urls.length} 篇`);
    });
    console.log();
    
    const processor = new BatchArticleProcessor();
    
    // 处理所有文章
    try {
        await processor.processArticles(unprocessedUrls);
        console.log('\n✅ 所有文章处理完成！');
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
    }
}

// 执行
if (require.main === module) {
    processRemainingArticles()
        .then(() => {
            console.log('\n✅ 完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = processRemainingArticles;