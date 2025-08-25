#!/usr/bin/env node

const MyGolfSpySeleniumScraper = require('./mygolfspy_selenium_scraper');

async function testSelenium() {
    console.log('🧪 测试MyGolfSpy Selenium抓取器\n');
    
    const testUrl = 'https://mygolfspy.com/reviews/mizuno-jpx925-hot-metal-irons-review/';
    
    const scraper = new MyGolfSpySeleniumScraper();
    
    console.log(`📄 测试抓取文章: ${testUrl}`);
    
    try {
        const result = await scraper.scrapeArticle(testUrl);
        
        console.log('\n✅ 抓取成功！');
        console.log(`📰 标题: ${result.title}`);
        console.log(`📝 内容长度: ${result.content.length} 字符`);
        console.log(`🖼️  图片数量: ${result.images.length}`);
        
        // 显示前500个字符
        console.log('\n📄 内容预览:');
        console.log('------------------------');
        console.log(result.content.substring(0, 500) + '...');
        console.log('------------------------');
        
        // 显示图片URL
        if (result.images.length > 0) {
            console.log('\n🖼️  图片列表:');
            result.images.slice(0, 5).forEach((img, idx) => {
                console.log(`  ${idx + 1}. ${img.alt}: ${img.url}`);
            });
            if (result.images.length > 5) {
                console.log(`  ... 还有 ${result.images.length - 5} 张图片`);
            }
        }
        
        console.log('\n🎉 Selenium抓取成功！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error);
    }
}

// 运行测试
testSelenium().catch(console.error);