#!/usr/bin/env node

/**
 * 处理特定的Golf Digest文章
 */

const BatchProcessor = require('./batch_process_articles');

async function processSpecificGolfDigest() {
    console.log('🏌️ 处理特定的Golf Digest文章...\n');
    
    // 定义需要处理的特定Golf Digest文章URL（从之前的记录中获取）
    const specificUrls = [
        'https://www.golfdigest.com/story/british-open-2025-scottie-scheffler-first-thing-noticed-on-claret-jug-youll-never-guess-video',
        'https://www.golfdigest.com/story/ryder-cup-2025-us-team-stock-watch-post-british-open'
    ];
    
    console.log(`📊 准备处理 ${specificUrls.length} 篇文章\n`);
    
    // 使用批量处理器
    const processor = new BatchProcessor();
    
    try {
        await processor.processArticles(specificUrls, 'golfdigest.com');
        console.log('\n✅ 处理完成！');
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
    }
}

// 运行
if (require.main === module) {
    processSpecificGolfDigest().catch(console.error);
}