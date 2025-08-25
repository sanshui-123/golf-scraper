#!/usr/bin/env node
const BatchProcessor = require('./batch_process_articles.js');

async function testMyGolfSpyOptimized() {
    console.log('🧪 测试MyGolfSpy极致优化...');
    
    const processor = new BatchProcessor();
    const testUrl = 'https://mygolfspy.com/buyers-guides/irons/top-3-longest-super-game-improvement-irons-2025/';
    
    try {
        // 手动设置选项
        const options = {
            skipDuplicateCheck: false
        };
        
        // 处理单个URL
        await processor.processArticles([testUrl], options);
        
        console.log('✅ 测试完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        process.exit(0);
    }
}

testMyGolfSpyOptimized();