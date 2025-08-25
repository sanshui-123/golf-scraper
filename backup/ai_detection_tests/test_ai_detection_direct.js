#!/usr/bin/env node

/**
 * 直接测试AI检测功能
 */

const { chromium } = require('playwright');

async function testAIDetectionDirect() {
    console.log('🧪 直接测试AI检测（绕过BitBrowser）\n');
    
    let browser;
    try {
        // 1. 使用Playwright直接启动浏览器
        console.log('1️⃣ 启动浏览器...');
        browser = await chromium.launch({
            headless: false, // 设置为false以便观察
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=site-per-process'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        const page = await context.newPage();
        
        // 2. 访问腾讯AI检测平台
        console.log('2️⃣ 访问腾讯AI检测平台...');
        await page.goto('https://matrix.tencent.com/ai-detect/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('✅ 成功访问AI检测平台');
        
        // 3. 等待页面加载
        await page.waitForTimeout(3000);
        
        // 4. 查找输入框
        console.log('3️⃣ 查找输入框...');
        const textareaSelector = 'textarea';
        const textarea = await page.$(textareaSelector);
        
        if (textarea) {
            console.log('✅ 找到输入框');
            
            // 5. 输入测试文本
            const testText = '这是一段测试文本，用于验证AI检测功能是否正常工作。';
            await textarea.fill(testText);
            console.log('✅ 已输入测试文本');
            
            // 6. 查找并点击检测按钮
            console.log('4️⃣ 查找检测按钮...');
            const buttonSelector = 'button:has-text("开始检测"), button:has-text("检测")';
            const button = await page.$(buttonSelector);
            
            if (button) {
                console.log('✅ 找到检测按钮');
                await button.click();
                
                // 7. 等待结果
                console.log('5️⃣ 等待检测结果...');
                await page.waitForTimeout(5000);
                
                // 8. 获取结果
                const resultSelector = '.result, .percentage, [class*="result"]';
                const result = await page.$(resultSelector);
                
                if (result) {
                    const resultText = await result.textContent();
                    console.log('✅ 检测结果:', resultText);
                } else {
                    console.log('⚠️ 未找到结果元素');
                }
            } else {
                console.log('❌ 未找到检测按钮');
            }
        } else {
            console.log('❌ 未找到输入框');
        }
        
        // 保持浏览器打开10秒以便观察
        console.log('\n⏳ 保持浏览器打开10秒...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔚 浏览器已关闭');
        }
    }
}

// 运行测试
if (require.main === module) {
    testAIDetectionDirect().catch(console.error);
}

module.exports = testAIDetectionDirect;