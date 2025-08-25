#!/usr/bin/env node

const MyGolfSpyFlareSolverrScraper = require('./mygolfspy_flaresolverr_scraper');

async function testFlareSolverr() {
    console.log('🧪 测试MyGolfSpy FlareSolverr抓取器\n');
    
    const testUrls = [
        'https://mygolfspy.com/news-opinion/insights-and-opinion/cobra-2025-drivers-fairway-woods/',
        'https://mygolfspy.com/reviews/mizuno-jpx925-hot-metal-irons-review/',
        'https://mygolfspy.com/buyers-guides/best-golf-drivers-2025/'
    ];
    
    const scraper = new MyGolfSpyFlareSolverrScraper();
    
    // 首先检查FlareSolverr服务
    console.log('🔍 检查FlareSolverr服务状态...');
    const serviceAvailable = await scraper.checkFlareSolverr();
    
    if (!serviceAvailable) {
        console.log('❌ FlareSolverr服务未运行！');
        console.log('\n请先运行: ./start_flaresolverr.sh');
        process.exit(1);
    }
    
    console.log('✅ FlareSolverr服务正常\n');
    
    // 测试抓取一篇文章
    const testUrl = testUrls[0];
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
        
        // 清理会话
        await scraper.destroySession();
        
        console.log('\n🎉 测试完成！FlareSolverr集成正常工作。');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 提示: FlareSolverr服务未运行');
            console.log('请运行: ./start_flaresolverr.sh');
        }
    }
}

// 运行测试
testFlareSolverr().catch(console.error);