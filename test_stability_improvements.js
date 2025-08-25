#!/usr/bin/env node

/**
 * 测试稳定性改进效果
 * 测试单个URL的处理，查看改进是否生效
 */

const BatchProcessor = require('./batch_process_articles');

async function testStability() {
    console.log('🧪 测试稳定性改进...\n');
    
    // 测试URL - 选择一个之前失败的URL
    const testUrls = [
        'https://mygolfspy.com/news-opinion/this-sun-mountain-x-marucci-baseball-collab-is-cool-but-is-it-2k-cool/'
    ];
    
    const processor = new BatchProcessor();
    
    console.log('📊 测试配置:');
    console.log('- 增强的超时处理（可延长超时）');
    console.log('- 页面加载重试机制（最多3次）');
    console.log('- Claude调用限流（最小间隔3秒）');
    console.log('- 增加的重试次数（2次）\n');
    
    try {
        await processor.processArticles(testUrls);
        console.log('\n✅ 测试完成！');
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    }
}

// 运行测试
if (require.main === module) {
    testStability().catch(console.error);
}