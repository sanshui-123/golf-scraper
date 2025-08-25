#!/usr/bin/env node

/**
 * 交互式AI检测测试脚本
 * 用于测试和调试AI检测功能的完整流程
 */

const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// 创建命令行接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 辅助函数：提问
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// 测试文本样本
const testSamples = {
    short: "The golf swing is a complex motion that requires coordination.",
    medium: `The modern golf swing has evolved significantly over the past century. 
From the classic swings of Bobby Jones and Ben Hogan to the power-focused 
techniques of today's long drivers, the fundamentals remain constant: grip, 
stance, alignment, and tempo. Understanding these basics is crucial for any 
golfer looking to improve their game and achieve more consistent results.`,
    long: `Golf course architecture has undergone a remarkable transformation since 
the sport's early days in Scotland. The original links courses, shaped by nature 
and grazing sheep, gave way to purposefully designed layouts that challenge 
players while preserving the natural beauty of the landscape. Modern architects 
like Pete Dye, Jack Nicklaus, and Tom Doak have pushed the boundaries of design, 
creating courses that test every aspect of a player's game. From strategic 
bunkering to undulating greens, water hazards to risk-reward scenarios, today's 
courses offer a mental and physical challenge that keeps the game endlessly 
fascinating. The best designs seamlessly blend aesthetics with playability, 
ensuring that golfers of all skill levels can enjoy the experience while still 
being tested by the layout.`
};

async function main() {
    console.log('\n🤖 交互式AI检测测试工具\n');
    console.log('===================================\n');
    
    try {
        // 选择检测模式
        console.log('请选择检测模式:');
        console.log('1. BitBrowser模式 (需要BitBrowser客户端)');
        console.log('2. 代理模式');
        console.log('3. 混合模式 (推荐)');
        console.log('4. 演示模式 (模拟检测)');
        
        const modeChoice = await question('\n选择 (1-4): ');
        const modes = ['bitbrowser', 'proxy', 'hybrid', 'demo'];
        const selectedMode = modes[parseInt(modeChoice) - 1] || 'hybrid';
        
        // 是否启用调试模式
        const debugChoice = await question('\n是否启用调试模式？(y/n): ');
        if (debugChoice.toLowerCase() === 'y') {
            process.env.AI_DETECTOR_DEBUG = 'true';
            console.log('✅ 调试模式已启用，将保存截图到 ai_detection_debug 目录');
        }
        
        // 如果选择演示模式
        if (selectedMode === 'demo') {
            process.env.AI_DETECTOR_DEMO = 'true';
            console.log('🎭 演示模式已启用，将返回模拟结果');
        }
        
        // 创建检测器实例
        const detector = new EnhancedAIContentDetector();
        if (selectedMode !== 'demo') {
            detector.setDetectionMode(selectedMode === 'demo' ? 'hybrid' : selectedMode);
        }
        
        console.log(`\n🎯 检测模式: ${selectedMode}`);
        console.log('正在初始化检测器...\n');
        
        await detector.initialize();
        
        // 选择测试内容
        console.log('\n请选择测试内容:');
        console.log('1. 使用预设的短文本');
        console.log('2. 使用预设的中等文本');
        console.log('3. 使用预设的长文本');
        console.log('4. 输入自定义文本');
        console.log('5. 从文件读取');
        console.log('6. 批量测试所有预设文本');
        
        const contentChoice = await question('\n选择 (1-6): ');
        
        let testContent = null;
        let testItems = [];
        
        switch (contentChoice) {
            case '1':
                testContent = testSamples.short;
                break;
            case '2':
                testContent = testSamples.medium;
                break;
            case '3':
                testContent = testSamples.long;
                break;
            case '4':
                console.log('\n请输入要检测的文本 (输入END结束):');
                let customText = '';
                let line;
                while ((line = await question('')) !== 'END') {
                    customText += line + '\n';
                }
                testContent = customText.trim();
                break;
            case '5':
                const filePath = await question('\n请输入文件路径: ');
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    // 提取文章正文（去除元数据）
                    const bodyMatch = fileContent.match(/---[\s\S]*?---\s*([\s\S]*)/);
                    testContent = bodyMatch ? bodyMatch[1] : fileContent;
                } catch (error) {
                    console.error('❌ 读取文件失败:', error.message);
                    process.exit(1);
                }
                break;
            case '6':
                // 批量测试
                testItems = Object.entries(testSamples).map(([key, text]) => ({
                    id: key,
                    text: text
                }));
                break;
            default:
                testContent = testSamples.medium;
        }
        
        // 执行检测
        console.log('\n🔍 开始检测...\n');
        
        if (testItems.length > 0) {
            // 批量检测
            const results = await detector.batchDetect(testItems);
            
            console.log('\n📊 批量检测结果:\n');
            console.log('样本类型    |  AI概率  |  状态');
            console.log('-----------|----------|--------');
            
            results.forEach(result => {
                const status = result.probability !== null ? '成功' : '失败';
                const probability = result.probability !== null ? `${result.probability}%` : 'N/A';
                console.log(`${result.id.padEnd(10)} | ${probability.padEnd(8)} | ${status}`);
            });
            
        } else if (testContent) {
            // 单个检测
            console.log('文本预览:');
            console.log('---');
            console.log(testContent.substring(0, 200) + (testContent.length > 200 ? '...' : ''));
            console.log('---\n');
            
            const startTime = Date.now();
            const probability = await detector.detectText(testContent);
            const duration = Date.now() - startTime;
            
            console.log('\n📊 检测结果:\n');
            if (probability !== null) {
                console.log(`✅ AI生成概率: ${probability}%`);
                console.log(`⏱️  检测耗时: ${(duration / 1000).toFixed(2)}秒`);
                
                // 根据概率给出建议
                if (probability > 70) {
                    console.log('⚠️  警告: 高AI生成概率，建议重新改写');
                } else if (probability > 40) {
                    console.log('📝 提示: 中等AI生成概率，可以考虑优化');
                } else {
                    console.log('✨ 良好: 低AI生成概率，内容质量较好');
                }
            } else {
                console.log('❌ 检测失败');
                console.log(`⏱️  耗时: ${(duration / 1000).toFixed(2)}秒`);
                
                if (process.env.AI_DETECTOR_DEBUG === 'true') {
                    console.log('\n💡 调试提示:');
                    console.log('1. 检查 ai_detection_debug 目录中的截图');
                    console.log('2. 确认网络连接正常');
                    console.log('3. 如果使用BitBrowser，确认客户端已启动');
                    console.log('4. 尝试使用演示模式测试流程');
                }
            }
        }
        
        // 显示统计信息
        detector.showStatistics();
        
        // 询问是否继续测试
        const continueChoice = await question('\n是否继续测试？(y/n): ');
        if (continueChoice.toLowerCase() === 'y') {
            console.clear();
            await detector.cleanup();
            return main(); // 递归调用继续测试
        }
        
        // 清理资源
        await detector.cleanup();
        rl.close();
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
        
        rl.close();
        process.exit(1);
    }
}

// 处理退出信号
process.on('SIGINT', () => {
    console.log('\n\n👋 测试已中断');
    rl.close();
    process.exit(0);
});

// 显示使用说明
console.log('🎯 AI检测交互式测试工具');
console.log('');
console.log('功能特性:');
console.log('  • 支持多种检测模式 (BitBrowser/代理/混合/演示)');
console.log('  • 调试模式下保存检测过程截图');
console.log('  • 支持自定义文本和文件输入');
console.log('  • 批量测试功能');
console.log('  • 详细的检测结果和建议');
console.log('');
console.log('快速开始:');
console.log('  node test_ai_detection_interactive.js');
console.log('');

// 启动主程序
main();