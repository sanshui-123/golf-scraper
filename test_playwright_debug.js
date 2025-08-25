#!/usr/bin/env node

const { chromium } = require('playwright');

async function debugPlaywright() {
    console.log('🔍 诊断 Playwright 问题...\n');
    
    try {
        console.log('1. 检查 Playwright 版本...');
        const pwVersion = require('playwright/package.json').version;
        console.log(`Playwright 版本: ${pwVersion}`);
        
        console.log('\n2. 尝试启动浏览器（详细日志）...');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            logger: {
                isEnabled: () => true,
                log: (name, severity, message) => console.log(`[${severity}] ${name}: ${message}`)
            }
        });
        
        console.log('✅ 浏览器启动成功');
        
        console.log('\n3. 尝试创建多个页面...');
        const pages = [];
        for (let i = 0; i < 3; i++) {
            try {
                console.log(`创建页面 ${i + 1}...`);
                const page = await browser.newPage();
                pages.push(page);
                console.log(`✅ 页面 ${i + 1} 创建成功`);
            } catch (pageError) {
                console.error(`❌ 页面 ${i + 1} 创建失败:`, pageError.message);
            }
        }
        
        console.log(`\n成功创建 ${pages.length} 个页面`);
        
        // 关闭所有页面
        for (const page of pages) {
            await page.close();
        }
        
        await browser.close();
        console.log('\n✅ 测试完成');
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error('堆栈:', error.stack);
    }
}

debugPlaywright();