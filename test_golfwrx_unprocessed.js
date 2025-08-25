#!/usr/bin/env node

/**
 * 测试未处理的GolfWRX URL以验证图片修复效果
 */

const BatchProcessor = require('./batch_process_articles');

async function testUnprocessedGolfWRXUrls() {
    console.log('🧪 测试GolfWRX图片抓取修复（使用未处理的URL）...\n');
    
    // 使用完全未处理过的GolfWRX文章
    const testUrls = [
        'https://www.golfwrx.com/764610/tommy-fleetwood-witb-2025-august/',
        'https://www.golfwrx.com/764594/golfwrx-members-choice-presented-by-2nd-swing-best-graphite-wood-shaft-of-2025/'
    ];
    
    const processor = new BatchProcessor();
    
    console.log('📝 将测试以下未处理的文章:');
    console.log('1. Tommy Fleetwood WITB - WITB文章通常有多张装备图片');
    console.log('2. 最佳木杆杆身评选 - 产品评测文章应该有产品图片');
    console.log('\n');
    
    // 处理文章
    await processor.processArticles(testUrls);
    
    console.log('\n✅ 测试完成！');
    console.log('\n🔍 修复效果说明：');
    console.log('- 移除了imageCounter >= 2的限制（原来只能抓取2张图片）');
    console.log('- 放宽了图片尺寸要求（从400px降到200px）');
    console.log('- 移除了过于严格的URL过滤条件');
    console.log('- 现在应该能抓取到文章中的所有符合条件的图片');
}

// 运行测试
testUnprocessedGolfWRXUrls().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});