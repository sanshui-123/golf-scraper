#!/usr/bin/env node

/**
 * 测试Golfweek图片抓取功能
 */

const { chromium } = require('playwright');
const fs = require('fs');

// 加载必要的模块
const websiteConfigs = JSON.parse(fs.readFileSync('./website_configs.json', 'utf-8'));
const SiteSpecificScrapers = require('./site_specific_scrapers');

async function testGolfweekImage() {
    console.log('🧪 测试Golfweek图片抓取功能');
    console.log('='.repeat(60));
    
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    try {
        const page = await browser.newPage();
        const testUrl = 'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-2025-streaming-tv-channel-where-to-watch/85610872007/';
        
        console.log(`\n📄 测试URL: ${testUrl}`);
        console.log('⏳ 正在加载页面...');
        
        await page.goto(testUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        
        // 检查是否应该使用特殊图片处理
        const domain = 'golfweek.usatoday.com';
        const siteConfig = websiteConfigs[domain];
        console.log(`\n🔍 网站配置:`, siteConfig);
        console.log(`useSpecialImageHandler: ${siteConfig?.useSpecialImageHandler}`);
        
        // 使用特定抓取器
        const scrapers = new SiteSpecificScrapers();
        
        console.log('\n🔧 使用Golfweek专用抓取器...');
        const result = await scrapers.scrapeGolfweekArticle(page);
        
        if (result) {
            console.log('\n✅ 抓取成功！');
            console.log(`📌 标题: ${result.title}`);
            console.log(`📝 内容长度: ${result.content.length} 字符`);
            console.log(`🖼️  图片数量: ${result.images.length}`);
            
            if (result.images.length > 0) {
                console.log('\n📸 找到的图片:');
                result.images.forEach((img, index) => {
                    console.log(`  ${index + 1}. URL: ${img.url}`);
                    console.log(`     描述: ${img.alt}`);
                });
            } else {
                console.log('\n⚠️  没有找到图片！');
            }
            
            // 保存结果以便查看
            fs.writeFileSync('test_golfweek_result.json', JSON.stringify(result, null, 2));
            console.log('\n💾 结果已保存到 test_golfweek_result.json');
            
        } else {
            console.log('\n❌ 抓取失败！');
        }
        
    } catch (error) {
        console.error('\n❌ 测试出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行测试
testGolfweekImage();