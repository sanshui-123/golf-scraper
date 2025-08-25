#!/usr/bin/env node

/**
 * 直接测试Golfweek专用抓取器的图片功能
 */

const { chromium } = require('playwright');
const SiteSpecificScrapers = require('./site_specific_scrapers');
const fs = require('fs');

async function testGolfweekDirect() {
    console.log('🧪 直接测试Golfweek专用抓取器');
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
        
        // 使用专用抓取器
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
                    console.log(`     描述: ${img.alt || '无描述'}`);
                    console.log(`     来源: ${img.src || '未知'}`);
                });
                
                console.log('\n✅ Golfweek专用抓取器能够成功抓取图片！');
                
                // 检查配置
                const websiteConfigs = JSON.parse(fs.readFileSync('./website_configs.json', 'utf-8'));
                const golfweekConfig = websiteConfigs['golfweek.usatoday.com'];
                
                console.log('\n🔍 Golfweek配置:');
                console.log(`  useSpecialImageHandler: ${golfweekConfig?.useSpecialImageHandler}`);
                console.log(`  名称: ${golfweekConfig?.name}`);
                
                if (golfweekConfig?.useSpecialImageHandler) {
                    console.log('\n✅ 配置正确！useSpecialImageHandler已设置为true');
                    console.log('💡 批处理器应该会自动使用专用抓取器');
                } else {
                    console.log('\n❌ 配置问题！useSpecialImageHandler未设置');
                }
                
            } else {
                console.log('\n❌ 专用抓取器也没有找到图片！');
                console.log('🔍 可能需要检查页面结构或选择器');
                
                // 尝试查看页面上是否有图片
                const pageImages = await page.$$eval('img', imgs => 
                    imgs.map(img => ({
                        src: img.src,
                        alt: img.alt,
                        class: img.className
                    }))
                );
                
                console.log(`\n📄 页面上的所有图片数量: ${pageImages.length}`);
                if (pageImages.length > 0) {
                    console.log('前5个图片:');
                    pageImages.slice(0, 5).forEach((img, i) => {
                        console.log(`  ${i + 1}. ${img.src}`);
                        console.log(`     class: ${img.class}`);
                    });
                }
            }
            
            // 保存结果
            fs.writeFileSync('test_golfweek_direct_result.json', JSON.stringify(result, null, 2));
            console.log('\n💾 结果已保存到 test_golfweek_direct_result.json');
            
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
testGolfweekDirect();