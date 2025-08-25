const BatchArticleProcessor = require('./batch_process_articles');

async function testGolfWRXForce() {
    console.log('🧪 强制测试 GolfWRX 批量处理（跳过实时报道检测）...\n');
    
    const processor = new BatchArticleProcessor();
    
    // 临时修改处理器以跳过实时报道检测
    const originalProcessArticles = processor.processArticles;
    processor.processArticles = async function(urls, options = {}) {
        // 在处理前临时修改检测逻辑
        const oldRewriter = this.rewriter.rewriteArticle;
        this.rewriter.rewriteArticle = async function(title, content, url, options = {}) {
            // 强制不是实时报道
            console.log('  🔧 强制处理文章（跳过实时报道检测）');
            return oldRewriter.call(this, title, content, url, { ...options, forceProcess: true });
        };
        
        const result = await originalProcessArticles.call(this, urls, options);
        
        // 恢复原始方法
        this.rewriter.rewriteArticle = oldRewriter;
        
        return result;
    };
    
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

testGolfWRXForce();