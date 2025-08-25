#!/usr/bin/env node

/**
 * 演示模式AI检测测试
 * 使用模拟结果测试AI检测流程
 */

const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function testDemoMode() {
    console.log('\n🎭 AI检测演示模式测试\n');
    
    // 启用演示模式
    process.env.AI_DETECTOR_DEMO = 'true';
    
    // 测试文本
    const testText = `The perfect golf grip is fundamental to a consistent swing. 
Many golfers struggle with grip pressure, often holding the club too tightly. 
The ideal grip should be firm enough to control the club but relaxed enough 
to allow natural wrist hinge and release through impact.`;
    
    const detector = new EnhancedAIContentDetector();
    
    try {
        console.log('1️⃣ 初始化检测器（演示模式）...');
        detector.setDetectionMode('hybrid');
        await detector.initialize();
        console.log('   ✅ 初始化成功\n');
        
        console.log('2️⃣ 执行AI检测（模拟）...');
        console.log('   📝 文本长度:', testText.length, '字符');
        
        const startTime = Date.now();
        const result = await detector.detectText(testText);
        const duration = Date.now() - startTime;
        
        console.log(`   ✅ 检测完成: ${result}% (耗时: ${(duration / 1000).toFixed(2)}秒)\n`);
        
        console.log('3️⃣ 测试批量检测...');
        const batchItems = [
            { id: 'article1', text: 'Short golf tip about putting.' },
            { id: 'article2', text: testText },
            { id: 'article3', text: 'Golf course management is key to lower scores.' }
        ];
        
        const batchResults = await detector.batchDetect(batchItems);
        
        console.log('\n📊 批量检测结果:');
        batchResults.forEach(r => {
            console.log(`   ${r.id}: ${r.probability}%`);
        });
        
        // 显示统计
        detector.showStatistics();
        
        console.log('\n✅ 演示测试成功！');
        console.log('\n💡 说明:');
        console.log('   • 演示模式返回模拟的AI检测结果（10-50%随机值）');
        console.log('   • 实际使用时需要能访问腾讯AI检测平台');
        console.log('   • 可能需要使用中国IP的代理或BitBrowser');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    } finally {
        await detector.cleanup();
    }
}

// 执行测试
testDemoMode();