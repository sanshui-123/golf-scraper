#!/usr/bin/env node

/**
 * 快速AI检测测试脚本
 * 用于快速验证AI检测功能是否正常工作
 */

const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function quickTest() {
    console.log('\n🚀 快速AI检测测试\n');
    
    // 测试文本
    const testText = `Golf technology has advanced significantly in recent years. 
Modern drivers feature adjustable weights, lofts, and face angles that allow 
golfers to customize their equipment for optimal performance. The use of 
materials like carbon fiber and titanium has made clubs lighter yet stronger, 
enabling faster swing speeds and greater distance.`;
    
    // 启用调试模式
    process.env.AI_DETECTOR_DEBUG = 'true';
    
    // 创建检测器
    const detector = new EnhancedAIContentDetector();
    
    try {
        console.log('1️⃣ 初始化检测器...');
        await detector.initialize();
        console.log('   ✅ 初始化成功\n');
        
        console.log('2️⃣ 测试BitBrowser模式...');
        detector.setDetectionMode('bitbrowser');
        const bitbrowserResult = await detector.detectText(testText);
        
        if (bitbrowserResult !== null) {
            console.log(`   ✅ BitBrowser检测成功: ${bitbrowserResult}%\n`);
        } else {
            console.log('   ❌ BitBrowser检测失败\n');
            
            console.log('3️⃣ 测试演示模式...');
            process.env.AI_DETECTOR_DEMO = 'true';
            const demoResult = await detector.detectText(testText);
            console.log(`   ✅ 演示模式结果: ${demoResult}%\n`);
        }
        
        // 显示统计
        detector.showStatistics();
        
        console.log('\n💡 测试完成！');
        console.log('   • 调试截图保存在: ai_detection_debug/');
        console.log('   • 如需交互式测试: node test_ai_detection_interactive.js');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
    } finally {
        await detector.cleanup();
    }
}

// 执行测试
quickTest();