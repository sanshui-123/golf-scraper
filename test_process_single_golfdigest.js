const BatchProcessor = require('./batch_process_articles');

async function testSingleArticle() {
    const processor = new BatchProcessor(false);
    
    try {
        const url = 'https://www.golfdigest.com/story/what-is-naturally-clumsy-charley-hulls-latest-injury-involves-curb-in-parking-lot-2025';
        
        console.log('🔧 直接处理Golf Digest文章...');
        console.log('📄 URL:', url);
        
        await processor.init();
        
        // 强制处理单个文章
        const result = await processor.processArticle(url, 972); // 使用新编号972
        
        if (result.success) {
            console.log('\n✅ 处理成功！');
            console.log(`📊 图片数量: ${result.images?.length || 0}`);
            console.log(`📁 保存位置: golf_content/2025-08-08/wechat_ready/wechat_article_972.md`);
        } else {
            console.log('\n❌ 处理失败:', result.error);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await processor.cleanup();
    }
}

testSingleArticle();