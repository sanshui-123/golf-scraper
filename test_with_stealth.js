#!/usr/bin/env node

const { chromium } = require('playwright');

async function testWithStealth(url) {
    console.log('\n🔍 使用增强模式测试...');
    
    const browser = await chromium.launch({
        headless: false,  // 使用有头模式
        executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log('⏳ 导航到页面...');
        await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 60000 
        });
        
        console.log('⏳ 等待内容加载...');
        
        // 检查是否有Cloudflare验证
        const hasCloudflare = await page.locator('text=Verifying you are human').count() > 0 ||
                             await page.locator('text=正在验证您是否是真人').count() > 0;
        
        if (hasCloudflare) {
            console.log('⚠️ 检测到 Cloudflare 验证，等待通过...');
            await page.waitForTimeout(10000);  // 等待10秒
        }
        
        // 等待真实内容
        await page.waitForSelector('h1', { timeout: 30000 });
        
        // 获取标题
        const title = await page.locator('h1').first().textContent();
        console.log(`\n📌 标题: ${title}`);
        
        // 获取内容预览
        const paragraphs = await page.locator('p').all();
        console.log(`📝 找到 ${paragraphs.length} 个段落`);
        
        // 获取前3段内容
        console.log('\n📄 内容预览:');
        for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
            const text = await paragraphs[i].textContent();
            if (text && text.trim().length > 20) {
                console.log(`${i + 1}. ${text.substring(0, 100)}...`);
            }
        }
        
        // 截图保存
        await page.screenshot({ 
            path: `test_results/screenshot_${Date.now()}.png`,
            fullPage: false 
        });
        console.log('\n📸 已保存截图');
        
        console.log('\n⏳ 保持浏览器打开30秒，您可以手动操作...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    const url = process.argv[2] || 'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/';
    testWithStealth(url).catch(console.error);
}