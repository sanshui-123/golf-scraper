#!/usr/bin/env node

/**
 * AI检测演示 - 证明不用BitBrowser也能检测文章AI率
 */

const fs = require('fs').promises;
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');
const SimpleAIDetector = require('./ai_detector_proxy_only');

// 带颜色的控制台输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorLog(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function demonstrateAIDetection() {
    colorLog('cyan', '\n🎯 AI检测演示 - 不使用BitBrowser\n');
    colorLog('bright', '=' .repeat(60));
    
    try {
        // 读取测试文章
        const articlePath = path.join(__dirname, 'test_article.txt');
        const articleContent = await fs.readFile(articlePath, 'utf8');
        
        colorLog('blue', '\n📄 测试文章内容：');
        console.log(articleContent.substring(0, 200) + '...\n');
        colorLog('bright', '-' .repeat(60));
        
        // 方案1：使用现有系统的代理模式
        colorLog('green', '\n✅ 方案1：使用系统代理模式（与腾讯AI检测一致）');
        console.log('说明：这使用的是同样的腾讯AI检测服务，结果最准确\n');
        
        try {
            const enhancedDetector = new EnhancedAIContentDetector();
            enhancedDetector.detectionMode = 'proxy'; // 强制代理模式
            await enhancedDetector.initialize();
            
            console.log('⏳ 正在检测，请稍候...');
            const startTime = Date.now();
            const result1 = await enhancedDetector.detectText(articleContent);
            const endTime = Date.now();
            
            if (result1 !== null) {
                colorLog('green', `\n🎊 检测成功！`);
                colorLog('yellow', `📊 AI检测率: ${result1}%`);
                console.log(`⏱️  检测用时: ${(endTime - startTime) / 1000}秒`);
                
                // 判断是否需要重写
                if (result1 > 50) {
                    colorLog('red', '⚠️  AI率超过50%，建议重写文章');
                } else {
                    colorLog('green', '✅ AI率低于50%，文章质量合格');
                }
                
                // 保存结果（模拟实际使用）
                const resultData = {
                    ai_detection: result1,
                    detection_time: new Date().toISOString(),
                    detection_mode: 'proxy',
                    need_rewrite: result1 > 50
                };
                
                const resultPath = path.join(__dirname, 'test_article_ai_detection.json');
                await fs.writeFile(resultPath, JSON.stringify(resultData, null, 2));
                console.log(`\n💾 结果已保存到: ${resultPath}`);
                
            } else {
                colorLog('red', '❌ 检测失败（可能需要配置代理）');
                console.log('提示：请确保 proxy_config.json 中配置了有效代理');
            }
        } catch (error) {
            colorLog('red', `❌ 错误: ${error.message}`);
        }
        
        colorLog('bright', '\n' + '-' .repeat(60));
        
        // 方案2：快速规则检测（备用）
        colorLog('cyan', '\n🚀 方案2：快速规则检测（离线备用方案）');
        console.log('说明：基于文本特征的快速检测，不需要网络\n');
        
        const AlternativeDetector = require('./ai_detector_alternative');
        const altDetector = new AlternativeDetector();
        const ruleResult = altDetector.simpleDetection(articleContent);
        
        colorLog('yellow', `📊 规则检测结果: ${ruleResult}%`);
        console.log('注意：规则检测仅供参考，准确度较低');
        
        // 总结
        colorLog('bright', '\n' + '=' .repeat(60));
        colorLog('magenta', '\n📋 总结：');
        console.log('\n1. ✅ 不使用BitBrowser完全可以检测AI率');
        console.log('2. ✅ 代理模式使用同样的腾讯AI检测，结果准确');
        console.log('3. ✅ 可以正常保存检测结果，用于后续处理');
        console.log('4. ✅ 支持根据AI率决定是否重写文章');
        
        colorLog('green', '\n💡 使用建议：');
        console.log('- 配置本地代理（如Clash）获得最佳体验');
        console.log('- 运行 ./switch_to_proxy_mode.sh 切换到代理模式');
        console.log('- 然后正常使用批处理功能即可');
        
    } catch (error) {
        colorLog('red', `\n❌ 演示出错: ${error.message}`);
    }
}

// 显示如何在批处理中使用
async function showBatchUsage() {
    colorLog('bright', '\n\n' + '=' .repeat(60));
    colorLog('cyan', '🔧 在批处理中使用：');
    console.log(`
// 在 batch_process_articles.js 中已经集成
// 只需切换到代理模式：

1. 运行切换脚本：
   ./switch_to_proxy_mode.sh

2. 正常运行批处理：
   node batch_process_articles.js deep_urls_*.txt

3. 系统会自动：
   - 检测每篇文章的AI率
   - AI率>50%时自动重写（最多2次）
   - 保存检测结果到 _ai_detection.json 文件
   - 在MD文件开头添加AI检测注释
`);
}

// 主函数
if (require.main === module) {
    (async () => {
        await demonstrateAIDetection();
        await showBatchUsage();
        console.log('\n');
    })();
}

module.exports = { demonstrateAIDetection };