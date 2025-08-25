#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const COOKIE_FILE = path.join(__dirname, 'cookies', 'mygolfspy_cookies.json');

async function ensureCookieDir() {
    const cookieDir = path.dirname(COOKIE_FILE);
    try {
        await fs.mkdir(cookieDir, { recursive: true });
    } catch (e) {}
}

async function loadCookies(context) {
    try {
        const cookieData = await fs.readFile(COOKIE_FILE, 'utf8');
        const cookies = JSON.parse(cookieData);
        await context.addCookies(cookies);
        console.log('✅ 已加载保存的 cookies');
        return true;
    } catch (e) {
        console.log('📌 没有找到保存的 cookies');
        return false;
    }
}

async function saveCookies(context) {
    const cookies = await context.cookies();
    await fs.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log('💾 已保存 cookies');
}

async function handleMyGolfSpy(url) {
    console.log('\n🏌️ 处理 MyGolfSpy 网站...');
    
    await ensureCookieDir();
    
    const browser = await chromium.launch({
        headless: false,  // 先用有头模式看看弹窗
        executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        args: ['--no-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    // 尝试加载 cookies
    const hasCookies = await loadCookies(context);
    
    const page = await context.newPage();
    
    try {
        console.log('⏳ 导航到页面...');
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        console.log('⏳ 等待页面稳定...');
        await page.waitForTimeout(3000);
        
        // 尝试检测和关闭常见的弹窗
        const popupSelectors = [
            // 常见的弹窗关闭按钮
            'button[aria-label*="close"]',
            'button[aria-label*="Close"]',
            'button.close',
            'button.modal-close',
            'button.popup-close',
            '.close-button',
            '[class*="close"]',
            '[class*="dismiss"]',
            // 具体的文本
            'text=No thanks',
            'text=Maybe later',
            'text=Not now',
            'text=×',  // X 符号
            'text=X'
        ];
        
        console.log('🔍 检查是否有弹窗...');
        
        for (const selector of popupSelectors) {
            try {
                const closeBtn = await page.locator(selector).first();
                if (await closeBtn.isVisible({ timeout: 1000 })) {
                    console.log(`✅ 找到弹窗关闭按钮: ${selector}`);
                    await closeBtn.click();
                    console.log('✅ 已关闭弹窗');
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个选择器
            }
        }
        
        // 保存 cookies
        if (!hasCookies) {
            await saveCookies(context);
        }
        
        // 现在尝试获取内容
        console.log('\n📊 获取文章内容...');
        
        const title = await page.locator('h1').first().textContent();
        console.log(`📌 标题: ${title}`);
        
        const content = await page.evaluate(() => {
            const article = document.querySelector('.entry-content, article, main');
            if (!article) return '未找到文章内容';
            
            const paragraphs = Array.from(article.querySelectorAll('p'))
                .map(p => p.innerText.trim())
                .filter(text => text.length > 20)
                .slice(0, 5);
                
            return paragraphs.join('\n\n');
        });
        
        console.log('\n📄 内容预览:');
        console.log(content.substring(0, 300) + '...');
        
        // 获取图片
        const images = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('.entry-content img, article img'));
            return imgs
                .filter(img => img.width > 200)
                .slice(0, 5)
                .map(img => ({
                    src: img.src,
                    alt: img.alt || '无描述'
                }));
        });
        
        console.log(`\n🖼️ 找到 ${images.length} 张图片`);
        
        // 保存测试结果
        const result = {
            url,
            title,
            contentPreview: content.substring(0, 500),
            imageCount: images.length,
            images: images.slice(0, 3),
            success: true,
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(
            `test_results/mygolfspy_test_${Date.now()}.json`,
            JSON.stringify(result, null, 2)
        );
        
        console.log('\n✅ 测试完成！');
        console.log('💡 提示: cookies 已保存，下次访问应该不会再有弹窗');
        
        // 保持浏览器打开一会儿
        console.log('\n⏳ 浏览器将在10秒后关闭...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

// 主函数
async function main() {
    const url = process.argv[2] || 'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/';
    
    console.log('🚀 MyGolfSpy 弹窗处理工具');
    console.log('========================\n');
    
    if (process.argv.includes('--clear-cookies')) {
        try {
            await fs.unlink(COOKIE_FILE);
            console.log('✅ 已清除保存的 cookies');
        } catch (e) {}
        return;
    }
    
    await handleMyGolfSpy(url);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { handleMyGolfSpy, loadCookies, saveCookies };