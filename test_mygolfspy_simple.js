#!/usr/bin/env node
const { chromium } = require('playwright');

async function testMyGolfSpySimple() {
    console.log('🧪 MyGolfSpy简单测试...');
    
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome'
    });

    try {
        const page = await browser.newPage();
        
        console.log('📄 访问文章页面...');
        await page.goto('https://mygolfspy.com/buyers-guides/irons/top-3-longest-super-game-improvement-irons-2025/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        console.log('✅ 页面加载成功！');
        
        // 等待一下
        await page.waitForTimeout(3000);
        
        // 处理弹窗
        console.log('🔍 查找弹窗...');
        const popupSelectors = [
            '[class*="modal-close"]',
            '[aria-label="Close"]',
            'button[class*="close"]',
            '[class*="lightbox"] [class*="close"]'
        ];
        
        for (const selector of popupSelectors) {
            try {
                const btn = await page.$(selector);
                if (btn && await btn.isVisible()) {
                    console.log(`✅ 找到弹窗关闭按钮: ${selector}`);
                    await btn.click();
                    await page.waitForTimeout(2000);
                    console.log('✅ 弹窗已关闭');
                    break;
                }
            } catch (e) {}
        }
        
        // 检查标题
        try {
            const title = await page.$('h1');
            if (title) {
                const text = await title.textContent();
                console.log(`📄 文章标题: ${text}`);
            }
        } catch (e) {
            console.log('❌ 无法获取标题');
        }
        
        // 截图
        await page.screenshot({ path: 'mygolfspy_simple_test.png' });
        console.log('📸 已保存截图');
        
        // 保持打开10秒
        console.log('⏰ 保持浏览器打开10秒...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

testMyGolfSpySimple();