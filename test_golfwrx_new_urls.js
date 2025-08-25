#!/usr/bin/env node

/**
 * 测试新的GolfWRX URL以验证图片修复效果
 */

const BatchProcessor = require('./batch_process_articles');

async function testNewGolfWRXUrls() {
    console.log('🧪 测试GolfWRX图片抓取修复（使用新URL）...\n');
    
    // 使用还未处理过的GolfWRX文章
    const testUrls = [
        'https://www.golfwrx.com/764696/golfwrx-members-choice-presented-by-2nd-swing-best-blade-putter-of-2025/',
        'https://www.golfwrx.com/764718/club-junkie-building-the-craziest-most-expensive-wedge-set-ever/'
    ];
    
    const processor = new BatchProcessor();
    
    console.log('📝 将测试以下新文章:');
    testUrls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
    console.log('\n');
    
    // 处理文章
    await processor.processArticles(testUrls);
    
    console.log('\n✅ 测试完成！');
    console.log('\n📊 请检查生成的文章中的图片数量：');
    console.log('- 第一篇是推杆评测文章，应该有多张产品图片');
    console.log('- 第二篇是楔杆制作文章，应该有制作过程的图片');
    console.log('\n📁 文章位置: golf_content/' + new Date().toISOString().split('T')[0] + '/wechat_ready/');
}

// 运行测试
testNewGolfWRXUrls().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});