#!/usr/bin/env node

/**
 * 测试MyGolfSpy弹窗处理
 */

const { chromium } = require('playwright');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');

async function testPopupHandling() {
    console.log('🔍 测试MyGolfSpy弹窗处理');
    console.log('═'.repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        const myGolfSpyHandler = new MyGolfSpyImageHandler();
        
        // 加载cookies
        try {
            await myGolfSpyHandler.loadCookies(context);
            console.log('🍪 已加载保存的cookies');
        } catch (e) {
            console.log('📝 没有找到保存的cookies');
        }
        
        console.log('\n📍 访问MyGolfSpy网站...');
        await page.goto('https://mygolfspy.com/', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // 等待页面加载
        console.log('⏳ 等待页面加载...');
        await page.waitForTimeout(3000);
        
        // 检查弹窗状态（处理前）
        const hasPopupBefore = await page.evaluate(() => {
            const popups = document.querySelectorAll('[class*="modal"]:not([style*="display: none"]), [class*="popup"]:not([style*="display: none"])');
            const enterToWin = Array.from(document.querySelectorAll('*')).some(el => 
                el.textContent && el.textContent.includes('ENTER TO WIN')
            );
            return popups.length > 0 || enterToWin;
        });
        
        console.log(`\n📊 弹窗检测（处理前）: ${hasPopupBefore ? '发现弹窗' : '未发现弹窗'}`);
        
        // 处理弹窗
        console.log('\n🔧 开始处理弹窗...');
        const result = await myGolfSpyHandler.handlePopups(page);
        
        // 保存cookies
        await myGolfSpyHandler.saveCookies(context);
        
        // 检查弹窗状态（处理后）
        await page.waitForTimeout(2000);
        const hasPopupAfter = await page.evaluate(() => {
            const popups = document.querySelectorAll('[class*="modal"]:not([style*="display: none"]), [class*="popup"]:not([style*="display: none"])');
            const enterToWin = Array.from(document.querySelectorAll('*')).some(el => {
                const style = window.getComputedStyle(el);
                return el.textContent && 
                       el.textContent.includes('ENTER TO WIN') && 
                       style.display !== 'none' &&
                       style.visibility !== 'hidden';
            });
            return popups.length > 0 || enterToWin;
        });
        
        console.log(`\n📊 弹窗检测（处理后）: ${hasPopupAfter ? '仍有弹窗' : '弹窗已清除'}`);
        console.log(`🔧 处理结果: ${result ? '成功处理弹窗' : '未检测到弹窗或处理失败'}`);
        
        // 测试页面是否可以正常滚动
        console.log('\n📜 测试页面滚动...');
        const canScroll = await page.evaluate(() => {
            const beforeScroll = window.pageYOffset;
            window.scrollTo(0, 500);
            const afterScroll = window.pageYOffset;
            window.scrollTo(0, 0);
            return afterScroll > beforeScroll;
        });
        
        console.log(`页面滚动: ${canScroll ? '✅ 正常' : '❌ 被阻止'}`);
        
        // 截图
        await page.screenshot({ 
            path: 'mygolfspy_popup_test.png',
            fullPage: false 
        });
        console.log('\n📸 已保存截图: mygolfspy_popup_test.png');
        
        // 尝试访问一个文章页面
        console.log('\n🔍 测试访问文章页面...');
        const testUrl = 'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/';
        await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
        
        // 再次处理可能的弹窗
        await page.waitForTimeout(2000);
        await myGolfSpyHandler.handlePopups(page);
        
        // 检查内容是否可见
        const hasContent = await page.evaluate(() => {
            const content = document.querySelector('.entry-content, .post-content, article');
            return content && content.textContent.length > 100;
        });
        
        console.log(`文章内容: ${hasContent ? '✅ 可访问' : '❌ 无法访问'}`);
        
        if (hasContent) {
            // 提取文章标题
            const title = await page.evaluate(() => {
                const titleEl = document.querySelector('h1');
                return titleEl ? titleEl.textContent.trim() : null;
            });
            console.log(`文章标题: ${title || '未找到'}`);
        }
        
    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        console.log('\n按回车键关闭浏览器...');
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });
        
        await browser.close();
    }
}

// 运行测试
console.log('启动MyGolfSpy弹窗处理测试...\n');
testPopupHandling().catch(console.error);