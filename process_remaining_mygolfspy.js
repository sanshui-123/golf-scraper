#!/usr/bin/env node

/**
 * 处理剩余的MyGolfSpy文章
 */

const BatchProcessor = require('./batch_process_articles');

async function processRemainingMyGolfSpy() {
    console.log('🏌️ 处理剩余的MyGolfSpy文章...\n');
    
    // 定义需要处理的MyGolfSpy文章
    const remainingUrls = [
        'https://mygolfspy.com/buyers-guide/top-10-straightest-drivers-of-2025/',
        'https://mygolfspy.com/news-opinion/instruction/wedge-ball-position-explained-and-why-it-changes-by-shot-type/'
    ];
    
    console.log(`📊 准备处理 ${remainingUrls.length} 篇MyGolfSpy文章\n`);
    
    // 使用批量处理器
    const processor = new BatchProcessor();
    
    try {
        await processor.processArticles(remainingUrls, 'mygolfspy.com');
        console.log('\n✅ 处理完成！');
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
    }
}

// 运行
if (require.main === module) {
    processRemainingMyGolfSpy().catch(console.error);
}