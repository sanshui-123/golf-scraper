#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const BatchArticleProcessor = require('./batch_process_articles');

async function processUnrewrittenArticles() {
    console.log('🔍 查找未改写的文章...\n');
    
    // 定义4个网站的RSS feeds和抓取器
    const websites = [
        {
            name: 'Golf.com',
            domain: 'golf.com',
            rssFeed: 'https://golf.com/feed/',
            scraper: require('./golf_com_scraper')
        },
        {
            name: 'Golf Monthly',
            domain: 'golfmonthly.com',
            scraper: require('./golf_monthly_scraper')
        },
        {
            name: 'MyGolfSpy',
            domain: 'mygolfspy.com',
            scraper: require('./mygolfspy_scraper')
        },
        {
            name: 'GolfWRX',
            domain: 'golfwrx.com',
            scraper: require('./golfwrx_scraper')
        }
    ];
    
    const processor = new BatchArticleProcessor();
    const allUnprocessedUrls = [];
    
    // 收集每个网站的最新文章
    for (const site of websites) {
        console.log(`\n📌 检查 ${site.name}...`);
        
        try {
            let urls = [];
            
            // MyGolfSpy 使用 RSS
            if (site.domain === 'mygolfspy.com') {
                const rssProcessor = require('./process_mygolfspy_rss');
                // 获取RSS文章但不处理
                const rssUrls = await new Promise((resolve) => {
                    const originalProcess = rssProcessor.processArticles;
                    rssProcessor.processArticles = async function(urls) {
                        resolve(urls);
                        return [];
                    };
                    rssProcessor.main().catch(() => resolve([]));
                });
                urls = rssUrls.slice(0, 5); // 最新5篇
            } else {
                // 其他网站使用各自的scraper
                const scraper = new site.scraper();
                urls = await scraper.getRecentArticles(5);
            }
            
            console.log(`  找到 ${urls.length} 篇文章`);
            
            // 检查哪些还没有被处理
            const unprocessedUrls = [];
            for (const url of urls) {
                // 简单检查：看URL是否已经在今天的article_urls.json中
                const todayUrlsFile = `golf_content/2025-07-21/article_urls.json`;
                if (fs.existsSync(todayUrlsFile)) {
                    const existingUrls = JSON.parse(fs.readFileSync(todayUrlsFile, 'utf8'));
                    const urlValues = Object.values(existingUrls);
                    if (!urlValues.includes(url)) {
                        unprocessedUrls.push(url);
                    }
                }
            }
            
            console.log(`  ✨ ${unprocessedUrls.length} 篇未处理`);
            allUnprocessedUrls.push(...unprocessedUrls);
            
        } catch (error) {
            console.error(`  ❌ 错误: ${error.message}`);
        }
    }
    
    console.log(`\n📊 总计找到 ${allUnprocessedUrls.length} 篇未处理文章`);
    
    if (allUnprocessedUrls.length > 0) {
        console.log('\n🚀 开始批量处理...');
        console.log('📝 URL列表:');
        allUnprocessedUrls.forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
        
        // 批量处理所有未处理的文章
        await processor.processArticles(allUnprocessedUrls);
        
        console.log('\n✅ 处理完成！');
    } else {
        console.log('\n✅ 所有文章都已处理完成！');
    }
}

// 执行主函数
processUnrewrittenArticles().catch(console.error);