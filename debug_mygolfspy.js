#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugMyGolfSpy() {
    const url = 'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/';
    
    console.log('🔍 调试 MyGolfSpy 抓取问题...\n');
    
    const browser = await chromium.launch({
        headless: true,
        executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    const page = await browser.newPage();
    
    // 尝试加载 cookies
    try {
        const cookieFile = path.join(__dirname, 'cookies', 'mygolfspy_cookies.json');
        const cookieData = fs.readFileSync(cookieFile, 'utf8');
        const cookies = JSON.parse(cookieData);
        await page.context().addCookies(cookies);
        console.log('✅ 已加载 cookies');
    } catch (e) {
        console.log('❌ 无法加载 cookies');
    }
    
    console.log('⏳ 导航到页面...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 等待一下
    await page.waitForTimeout(3000);
    
    // 截图查看当前状态
    await page.screenshot({ path: 'debug_before_popup.png' });
    console.log('📸 截图已保存: debug_before_popup.png');
    
    // 获取页面标题和URL
    const pageInfo = await page.evaluate(() => {
        return {
            title: document.title,
            url: window.location.href,
            h1: document.querySelector('h1')?.innerText || '无H1',
            bodyText: document.body.innerText.substring(0, 200)
        };
    });
    
    console.log('\n📊 页面信息:');
    console.log(`标题: ${pageInfo.title}`);
    console.log(`URL: ${pageInfo.url}`);
    console.log(`H1: ${pageInfo.h1}`);
    console.log(`内容预览: ${pageInfo.bodyText}...`);
    
    // 尝试关闭弹窗
    console.log('\n🔍 尝试关闭弹窗...');
    const popupSelectors = [
        'button[aria-label*="close"]',
        'button[aria-label*="Close"]', 
        'button.close',
        '.close-button',
        '[class*="close"]',
        '[class*="dismiss"]',
        'button:has-text("×")',
        'button:has-text("X")'
    ];
    
    let foundPopup = false;
    for (const selector of popupSelectors) {
        try {
            const elements = await page.locator(selector).all();
            console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
            
            if (elements.length > 0) {
                const element = elements[0];
                if (await element.isVisible()) {
                    await element.click();
                    console.log(`✅ 点击了: ${selector}`);
                    foundPopup = true;
                    await page.waitForTimeout(2000);
                    break;
                }
            }
        } catch (e) {
            // 继续
        }
    }
    
    if (!foundPopup) {
        console.log('❌ 未找到弹窗关闭按钮');
    }
    
    // 再次截图
    await page.screenshot({ path: 'debug_after_popup.png' });
    console.log('\n📸 截图已保存: debug_after_popup.png');
    
    // 再次获取内容
    const finalContent = await page.evaluate(() => {
        const selectors = {
            title: 'h1.entry-title, h1',
            article: '.entry-content, article',
            content: 'p, h2, h3'
        };
        
        const title = document.querySelector(selectors.title)?.innerText || '未找到标题';
        const article = document.querySelector(selectors.article);
        
        if (!article) {
            return { title, content: '未找到文章容器', hasArticle: false };
        }
        
        const paragraphs = Array.from(article.querySelectorAll(selectors.content))
            .map(p => p.innerText.trim())
            .filter(text => text.length > 20)
            .slice(0, 5);
        
        return {
            title,
            content: paragraphs.join('\n\n'),
            hasArticle: true,
            articleClasses: article.className
        };
    });
    
    console.log('\n📊 最终抓取结果:');
    console.log(`标题: ${finalContent.title}`);
    console.log(`找到文章容器: ${finalContent.hasArticle}`);
    console.log(`文章容器类: ${finalContent.articleClasses}`);
    console.log(`\n内容:\n${finalContent.content}`);
    
    await browser.close();
}

if (require.main === module) {
    debugMyGolfSpy().catch(console.error);
}