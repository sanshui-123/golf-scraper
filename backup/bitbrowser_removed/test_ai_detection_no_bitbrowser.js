#!/usr/bin/env node

/**
 * AI检测测试脚本 - 不使用BitBrowser的多种方案演示
 */

const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');
const SimpleAIDetector = require('./ai_detector_proxy_only');
const AlternativeAIDetector = require('./ai_detector_alternative');

async function testAllMethods() {
    const testText = `
        Golf swing fundamentals are essential for any player looking to improve their game. 
        The proper stance begins with feet shoulder-width apart, knees slightly bent, and 
        weight evenly distributed. The grip should be firm but not tense, allowing for 
        natural wrist movement throughout the swing. As you initiate the backswing, 
        rotate your shoulders while maintaining a stable lower body. The downswing 
        should be initiated by the hips, creating a powerful kinetic chain that 
        transfers energy through the body to the club head. Follow-through is equally 
        important, ensuring a complete and balanced finish to your swing.
    `;
    
    console.log('🏌️ AI检测测试 - 不使用BitBrowser的方案\n');
    console.log('📝 测试文本:', testText.substring(0, 100) + '...\n');
    console.log('=' * 60 + '\n');
    
    // 方案1：使用现有系统的代理模式
    console.log('📌 方案1：使用现有系统切换到代理模式');
    console.log('-' * 40);
    try {
        const enhancedDetector = new EnhancedAIContentDetector();
        enhancedDetector.detectionMode = 'proxy'; // 强制使用代理模式
        await enhancedDetector.initialize();
        
        const result1 = await enhancedDetector.detectText(testText);
        if (result1 !== null) {
            console.log(`✅ 检测成功: ${result1}% AI概率`);
        } else {
            console.log('❌ 检测失败');
        }
    } catch (error) {
        console.log('❌ 错误:', error.message);
    }
    
    console.log('\n' + '=' * 60 + '\n');
    
    // 方案2：使用简化版代理检测器
    console.log('📌 方案2：使用简化版代理检测器');
    console.log('-' * 40);
    try {
        const simpleDetector = new SimpleAIDetector();
        await simpleDetector.initialize();
        
        const result2 = await simpleDetector.detectText(testText);
        if (result2 !== null) {
            console.log(`✅ 检测成功: ${result2}% AI概率`);
        } else {
            console.log('❌ 检测失败（可能需要配置有效代理）');
        }
    } catch (error) {
        console.log('❌ 错误:', error.message);
    }
    
    console.log('\n' + '=' * 60 + '\n');
    
    // 方案3：使用替代检测服务
    console.log('📌 方案3：使用替代AI检测服务');
    console.log('-' * 40);
    try {
        const altDetector = new AlternativeAIDetector();
        
        // 基于规则的快速检测
        console.log('\n🤖 基于规则的检测:');
        const ruleResult = altDetector.simpleDetection(testText);
        console.log(`规则检测结果: ${ruleResult}% AI概率`);
        
        // 使用在线服务（需要浏览器）
        console.log('\n🌐 在线服务检测（可选）:');
        console.log('可用服务: ZeroGPT, GPTZero, Writer AI Detector, Copyleaks');
        console.log('注意：这些服务可能需要人机验证');
        
    } catch (error) {
        console.log('❌ 错误:', error.message);
    }
    
    console.log('\n' + '=' * 60 + '\n');
    
    // 总结和建议
    console.log('📊 总结和建议:\n');
    console.log('1. 代理模式方案:');
    console.log('   - 优点：与腾讯AI检测结果一致');
    console.log('   - 缺点：需要配置有效代理');
    console.log('   - 建议：使用本地代理软件（Clash/V2Ray）\n');
    
    console.log('2. 替代服务方案:');
    console.log('   - 优点：不需要代理，免费使用');
    console.log('   - 缺点：检测结果可能有差异');
    console.log('   - 建议：作为备用方案\n');
    
    console.log('3. 规则检测方案:');
    console.log('   - 优点：完全离线，速度快');
    console.log('   - 缺点：准确度较低');
    console.log('   - 建议：仅作为参考\n');
    
    console.log('💡 推荐配置:');
    console.log('   1. 安装本地代理软件（如Clash）');
    console.log('   2. 配置proxy_config.json使用本地代理');
    console.log('   3. 使用方案1或方案2进行检测');
}

// 快速测试函数
async function quickTest() {
    console.log('\n🚀 快速测试（仅使用规则检测）\n');
    
    const detector = new AlternativeAIDetector();
    const texts = [
        {
            name: 'AI风格文本',
            content: 'It is important to note that golf is a sport that requires precision. Furthermore, the mental aspect is crucial. Additionally, players must consider various factors. In conclusion, practice is essential.'
        },
        {
            name: '人类风格文本',
            content: 'I love playing golf! Yesterday was crazy - hit my best drive ever on the 10th hole. The wind was nuts but somehow I managed to keep it straight. Can\'t wait to play again tomorrow.'
        }
    ];
    
    for (const item of texts) {
        console.log(`\n测试: ${item.name}`);
        console.log('文本:', item.content.substring(0, 50) + '...');
        const score = detector.simpleDetection(item.content);
        console.log(`结果: ${score}% AI概率`);
    }
}

// 主函数
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        quickTest();
    } else {
        testAllMethods();
    }
}