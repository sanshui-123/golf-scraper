#!/usr/bin/env node

/**
 * 处理剩余的MyGolfSpy文章
 */

const BatchArticleProcessor = require('./batch_process_articles');

async function processRemainingMyGolfSpy() {
    console.log('🚀 处理剩余的MyGolfSpy文章\n');
    
    // 剩余的3篇MyGolfSpy文章
    const remainingUrls = [
        'https://mygolfspy.com/news-opinion/asked-on-reddit-whats-a-good-indicator-someone-is-good-at-golf/',
        'https://mygolfspy.com/news-opinion/instruction/the-most-common-golf-grip-mistakes-and-how-to-fix-them-fast/',
        'https://mygolfspy.com/news-opinion/which-holes-were-the-hardest-at-the-2025-open-championship-heres-the-full-breakdown/'
    ];
    
    console.log(`📋 准备处理 ${remainingUrls.length} 篇文章:\n`);
    remainingUrls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
    
    console.log('\n🔄 开始处理...\n');
    
    // 使用批处理器处理文章
    const processor = new BatchArticleProcessor();
    await processor.processMultipleUrls(remainingUrls);
    
    console.log('\n✅ 处理完成！');
}

// 执行主函数
processRemainingMyGolfSpy().catch(console.error);