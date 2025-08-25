#!/usr/bin/env node

/**
 * 测试GolfWRX图片抓取修复效果
 */

const BatchProcessor = require('./batch_process_articles');

async function testGolfWRXImages() {
    console.log('🧪 测试GolfWRX图片抓取修复...\n');
    
    const testUrls = [
        'https://www.golfwrx.com/764751/blades-brown-witb-2025-august/',
        'https://www.golfwrx.com/764741/ian-poulter-blasts-himself-on-social-media-as-he-has-one-last-chance-to-avoid-liv-relegation/'
    ];
    
    const processor = new BatchProcessor();
    
    console.log('📝 测试以下文章:');
    testUrls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
    console.log('\n');
    
    // 处理文章
    await processor.processArticles(testUrls);
    
    console.log('\n✅ 测试完成！请检查生成的文章中的图片数量。');
    console.log('📁 文章位置: golf_content/' + new Date().toISOString().split('T')[0] + '/');
}

// 运行测试
testGolfWRXImages().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});