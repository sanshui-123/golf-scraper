#!/usr/bin/env node

const { chromium } = require('playwright');

async function testGolfWRXPage() {
    console.log('🔍 测试GolfWRX页面内容...\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });
    
    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        // 添加stealth模式
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        console.log('📍 访问GolfWRX首页...');
        await page.goto('https://www.golfwrx.com', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // 等待Cloudflare
        await page.waitForTimeout(15000);
        
        // 检查页面内容
        const pageContent = await page.evaluate(() => {
            const info = {
                title: document.title,
                url: location.href,
                hasCloudflare: document.body.innerHTML.includes('Cloudflare'),
                articleSelectors: {},
                foundArticles: []
            };
            
            // 测试各种可能的文章选择器
            const selectorsToTest = [
                'article a[href]',
                '.entry-title a',
                '.post-title a',
                'h2 a[href*="/20"]',
                'h3 a[href*="/20"]',
                'a[href*="/news/"]',
                '.mvp-blog-story-text a',
                '.td-module-title a',
                '.td_module_wrap a',
                '.post h2 a',
                '.post h3 a',
                '.content-area a[href*="/20"]',
                '.main-content a[href*="/20"]',
                '#content a[href*="/20"]'
            ];
            
            selectorsToTest.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                info.articleSelectors[selector] = elements.length;
                
                // 收集前3个链接作为示例
                if (elements.length > 0) {
                    Array.from(elements).slice(0, 3).forEach(el => {
                        const url = el.href;
                        const text = el.textContent.trim();
                        if (url && text && url.includes('golfwrx.com') && 
                            !url.includes('/page/') && !url.includes('/category/')) {
                            info.foundArticles.push({
                                selector: selector,
                                url: url,
                                text: text.substring(0, 100)
                            });
                        }
                    });
                }
            });
            
            // 检查页面主要内容区域
            info.contentAreas = {
                hasMainContent: !!document.querySelector('.main-content, #main, .content-area'),
                hasSidebar: !!document.querySelector('.sidebar, aside'),
                hasArticles: !!document.querySelector('article'),
                hasPosts: !!document.querySelector('.post')
            };
            
            return info;
        });
        
        console.log('\n📊 页面分析结果:');
        console.log('标题:', pageContent.title);
        console.log('URL:', pageContent.url);
        console.log('Cloudflare状态:', pageContent.hasCloudflare ? '仍有Cloudflare' : '已通过');
        
        console.log('\n📋 内容区域检查:');
        Object.entries(pageContent.contentAreas).forEach(([key, value]) => {
            console.log(`  ${key}: ${value ? '✅' : '❌'}`);
        });
        
        console.log('\n🔍 文章选择器测试结果:');
        Object.entries(pageContent.articleSelectors)
            .filter(([_, count]) => count > 0)
            .forEach(([selector, count]) => {
                console.log(`  "${selector}": 找到 ${count} 个元素`);
            });
        
        if (pageContent.foundArticles.length > 0) {
            console.log('\n📰 找到的文章示例:');
            pageContent.foundArticles.forEach((article, i) => {
                console.log(`\n  ${i + 1}. [${article.selector}]`);
                console.log(`     标题: ${article.text}`);
                console.log(`     URL: ${article.url}`);
            });
        } else {
            console.log('\n❌ 没有找到文章链接');
        }
        
        // 测试新闻页面
        console.log('\n\n📍 访问GolfWRX新闻页面...');
        await page.goto('https://www.golfwrx.com/news/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        await page.waitForTimeout(10000);
        
        const newsPageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: location.href,
                articleCount: document.querySelectorAll('a[href*="/20"]').length,
                hasContent: document.body.textContent.length > 1000
            };
        });
        
        console.log('\n📰 新闻页面信息:');
        console.log('标题:', newsPageInfo.title);
        console.log('URL:', newsPageInfo.url);
        console.log('文章链接数:', newsPageInfo.articleCount);
        console.log('有内容:', newsPageInfo.hasContent ? '是' : '否');
        
        // 截图保存
        await page.screenshot({ path: 'golfwrx_test_screenshot.png', fullPage: true });
        console.log('\n📸 已保存截图: golfwrx_test_screenshot.png');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        console.log('\n⏸️ 10秒后关闭浏览器...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
    }
}

testGolfWRXPage().catch(console.error);