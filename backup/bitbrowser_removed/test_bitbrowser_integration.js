#!/usr/bin/env node

/**
 * 比特浏览器集成测试脚本
 * 用于验证比特浏览器与AI检测系统的集成是否正常工作
 */

const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');
const BitBrowserManager = require('./bitbrowser_manager');

// 测试文本
const testTexts = [
    {
        id: 'test1',
        text: '人工智能（Artificial Intelligence），英文缩写为AI。它是研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统的一门新的技术科学。',
        description: 'AI相关技术文本'
    },
    {
        id: 'test2',
        text: '今天天气真好，阳光明媚，适合出去散步。公园里的花都开了，有红色的玫瑰，黄色的菊花，还有白色的茉莉花，香气扑鼻。',
        description: '日常描述文本'
    },
    {
        id: 'test3',
        text: 'The implementation of machine learning algorithms has revolutionized data analysis across industries, enabling predictive analytics and automated decision-making processes.',
        description: '英文技术文本'
    }
];

async function testBitBrowserManager() {
    console.log('🧪 测试比特浏览器管理器...\n');
    
    const manager = new BitBrowserManager();
    
    try {
        // 1. 测试初始化
        console.log('1️⃣ 测试初始化...');
        await manager.initialize();
        console.log('✅ 初始化成功\n');
        
        // 2. 测试获取配置文件列表
        console.log('2️⃣ 测试获取配置文件...');
        const stats = await manager.getStatistics();
        console.log(`   总配置文件数: ${stats.totalProfiles}`);
        console.log(`   健康配置数: ${stats.healthyProfiles}`);
        console.log(`   今日剩余配额: ${stats.remainingQuotaToday}\n`);
        
        if (stats.totalProfiles === 0) {
            console.error('❌ 没有找到配置文件，请先在比特浏览器中创建配置文件');
            return false;
        }
        
        // 3. 测试获取最优配置
        console.log('3️⃣ 测试获取最优配置...');
        const profile = await manager.getOptimalProfile();
        if (profile) {
            console.log(`✅ 获取到配置: ${profile.name} (ID: ${profile.id})\n`);
        } else {
            console.error('❌ 无法获取配置文件');
            return false;
        }
        
        // 4. 测试启动浏览器
        console.log('4️⃣ 测试启动浏览器...');
        const browserInfo = await manager.launchBrowser(profile.id);
        console.log(`✅ 浏览器启动成功`);
        console.log(`   IP: ${browserInfo.ip || '未知'}\n`);
        
        // 5. 测试连接Playwright
        console.log('5️⃣ 测试Playwright连接...');
        const { browser, context } = await manager.connectBrowser(browserInfo.wsEndpoint);
        console.log('✅ Playwright连接成功\n');
        
        // 6. 测试页面访问
        console.log('6️⃣ 测试页面访问...');
        const page = await context.newPage();
        await page.goto('https://www.baidu.com');
        const title = await page.title();
        console.log(`✅ 页面访问成功: ${title}\n`);
        
        // 清理
        await page.close();
        await browser.close();
        await manager.closeBrowser(profile.id);
        
        return true;
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return false;
    }
}

async function testAIDetection() {
    console.log('🤖 测试AI检测功能...\n');
    
    const detector = new EnhancedAIContentDetector();
    
    try {
        // 测试不同模式
        const modes = ['hybrid', 'bitbrowser', 'proxy'];
        
        for (const mode of modes) {
            console.log(`\n📋 测试 ${mode} 模式:`);
            console.log('='.repeat(50));
            
            detector.setDetectionMode(mode);
            await detector.initialize();
            
            // 测试单个文本
            const testText = testTexts[0];
            console.log(`\n检测: ${testText.description}`);
            console.log(`文本: ${testText.text.substring(0, 50)}...`);
            
            const probability = await detector.detectText(testText.text);
            
            if (probability !== null) {
                console.log(`✅ 检测成功: AI概率 ${probability}%`);
                
                // 根据概率显示风险等级
                let risk = '';
                if (probability >= 80) {
                    risk = '🔴 高风险';
                } else if (probability >= 50) {
                    risk = '🟡 中风险';
                } else {
                    risk = '🟢 低风险';
                }
                console.log(`   风险等级: ${risk}`);
            } else {
                console.log('❌ 检测失败');
                
                // 如果是必需模式失败，跳过后续测试
                if (mode === 'bitbrowser') {
                    console.log('⚠️ 比特浏览器模式失败，可能未安装或未启动客户端');
                }
            }
            
            // 显示统计信息
            detector.showStatistics();
            
            // 延迟避免过快
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // 测试批量检测
        console.log('\n\n📋 测试批量检测:');
        console.log('='.repeat(50));
        
        detector.setDetectionMode('hybrid');
        const results = await detector.batchDetect(testTexts);
        
        console.log('\n批量检测结果:');
        results.forEach((result, index) => {
            const test = testTexts[index];
            console.log(`${test.id} (${test.description}): ${
                result.probability !== null ? result.probability + '%' : '失败'
            }`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ AI检测测试失败:', error.message);
        return false;
    } finally {
        await detector.cleanup();
    }
}

async function runAllTests() {
    console.log('🚀 开始比特浏览器集成测试\n');
    console.log('='.repeat(60));
    
    // 测试比特浏览器管理器
    console.log('\n第一部分：比特浏览器管理器测试');
    console.log('='.repeat(60));
    const bitBrowserOk = await testBitBrowserManager();
    
    if (!bitBrowserOk) {
        console.log('\n⚠️ 比特浏览器测试失败，请检查：');
        console.log('1. 比特浏览器客户端是否已安装并启动');
        console.log('2. 是否已创建浏览器配置文件');
        console.log('3. API端口是否正确（默认54345）\n');
    }
    
    // 测试AI检测
    console.log('\n第二部分：AI检测功能测试');
    console.log('='.repeat(60));
    const aiDetectionOk = await testAIDetection();
    
    // 总结
    console.log('\n\n📊 测试总结');
    console.log('='.repeat(60));
    console.log(`比特浏览器管理器: ${bitBrowserOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`AI检测功能: ${aiDetectionOk ? '✅ 通过' : '❌ 失败'}`);
    
    if (bitBrowserOk && aiDetectionOk) {
        console.log('\n🎉 所有测试通过！系统已准备就绪。');
        console.log('\n下一步：');
        console.log('1. 在比特浏览器中创建更多配置文件（建议10个以上）');
        console.log('2. 为每个配置文件设置不同的代理');
        console.log('3. 运行 node ai_content_detector_enhanced.js 开始使用');
    } else {
        console.log('\n❌ 部分测试失败，请根据错误信息进行排查。');
    }
}

// 运行测试
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('测试过程出错:', error);
        process.exit(1);
    });
}