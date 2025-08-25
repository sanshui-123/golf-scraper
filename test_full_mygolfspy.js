#!/usr/bin/env node

const { chromium } = require('playwright');
const SiteSpecificScrapers = require('./site_specific_scrapers');

async function testFullMyGolfSpy() {
    const browser = await chromium.launch({
        headless: true,  // 使用无头模式，像实际运行一样
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const page = await browser.newPage();
    const scrapers = new SiteSpecificScrapers();
    
    try {
        const url = 'https://mygolfspy.com/news-opinion/pxg-launches-a-hellcat-at-the-zero-torque-putter-competition/';
        console.log('访问页面:', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        console.log('使用MyGolfSpy专用抓取器...');
        const content = await scrapers.scrapeMyGolfSpyArticle(page);
        
        if (content) {
            console.log('\n✅ 抓取成功!');
            console.log('标题:', content.title);
            console.log('内容长度:', content.content.length);
            console.log('图片数量:', content.images.length);
            
            console.log('\n图片详情:');
            content.images.forEach((img, i) => {
                console.log(`${i+1}. ${img.url}`);
                console.log(`   Alt: ${img.alt}`);
            });
        } else {
            console.log('❌ 抓取失败：返回null');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error('堆栈:', error.stack);
    } finally {
        await browser.close();
    }
}

testFullMyGolfSpy();