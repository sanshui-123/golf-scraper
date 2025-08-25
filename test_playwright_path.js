#!/usr/bin/env node

const { chromium } = require('playwright');

async function testWithPath() {
    console.log('测试 Playwright 使用指定路径...\n');
    
    const paths = [
        '~/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        '~/Library/Caches/ms-playwright/chromium_headless_shell-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    
    for (const pathStr of paths) {
        const expandedPath = pathStr.replace('~', process.env.HOME);
        console.log(`\n测试路径: ${expandedPath}`);
        
        try {
            const browser = await chromium.launch({
                headless: false,  // 使用有头模式测试
                executablePath: expandedPath,
                args: ['--no-sandbox']
            });
            
            console.log('✅ 浏览器启动成功');
            
            const page = await browser.newPage();
            console.log('✅ 页面创建成功');
            
            await page.goto('https://www.google.com');
            console.log('✅ 访问网页成功');
            
            await page.close();
            await browser.close();
            
            console.log(`\n🎉 找到可用路径: ${expandedPath}`);
            break;
            
        } catch (error) {
            console.error(`❌ 失败: ${error.message}`);
        }
    }
}

testWithPath();