const BatchArticleProcessor = require('./batch_process_articles');

async function testGolfWRXBatch() {
    console.log('🧪 测试 GolfWRX 批量处理...\n');
    
    const processor = new BatchArticleProcessor();
    
    // 测试单个GolfWRX文章
    const testUrls = ['https://www.golfwrx.com/759308/2025-best-irons-best-blades/'];
    
    try {
        console.log('📝 处理GolfWRX文章...');
        await processor.processArticles(testUrls);
        
        console.log('\n✅ 处理完成！');
        console.log('📁 查看结果目录: golf_content/');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testGolfWRXBatch();