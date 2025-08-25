#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs').promises;

/**
 * MyGolfSpy URL生成器 - 只抓取主页文章URL
 * 增强反爬虫处理，不抓取其他分类页面
 */
async function fetchRSSUrls() {
    try {
        const Parser = require('rss-parser');
        const parser = new Parser();
        const feed = await parser.parseURL('https://mygolfspy.com/feed/');
        
        const urls = feed.items.map(item => item.link).filter(url => url);
        console.log(`📰 从RSS获取到 ${urls.length} 个URL`);
        return urls;
    } catch (error) {
        console.log('⚠️ RSS获取失败，使用页面抓取:', error.message);
        return [];
    }
}

async function generateMyGolfSpyUrls() {
    console.log('🎯 MyGolfSpy URL生成器启动');
    console.log('📊 目标：获取最新文章URL');
    
    // 先尝试RSS
    const rssUrls = await fetchRSSUrls();
    if (rssUrls.length > 20) {
        // 保存到文件
        const urlContent = rssUrls.join('\n') + '\n';
        await fs.writeFile('deep_urls_mygolfspy_com.txt', urlContent);
        console.log('✅ URL已保存到: deep_urls_mygolfspy_com.txt (来自RSS)');
        
        if (process.argv.includes('--urls-only')) {
            console.log(urlContent);
        }
        
        // 关闭浏览器资源
        process.exit(0);
    }
    
    // RSS失败或数量不足，使用页面抓取
    console.log('📄 使用页面抓取模式...');
    
    const browser = await chromium.launch({
        headless: false, // 使用有头模式
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        ]
    });

    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York'
        });

        const page = await context.newPage();

        // 反检测脚本
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });

        // 只抓取主页
        const pagesToScrape = [
            'https://mygolfspy.com/'
        ];

        const allUrls = new Set();

        for (const url of pagesToScrape) {
            console.log(`\n🔍 抓取页面: ${url}`);
            try {
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 60000 
                });

                // 等待页面稳定
                await page.waitForTimeout(3000);
                
                // 处理弹窗
                const popupSelectors = [
                    '[class*="modal-close"]',
                    '[aria-label="Close"]',
                    'button[class*="close"]',
                    '[class*="lightbox"] [class*="close"]',
                    '.modal button.close',
                    '.close-btn'
                ];
                
                console.log('🔍 查找并关闭弹窗...');
                for (const selector of popupSelectors) {
                    try {
                        const closeBtn = await page.$(selector);
                        if (closeBtn && await closeBtn.isVisible()) {
                            console.log(`✅ 找到弹窗关闭按钮: ${selector}`);
                            await closeBtn.click();
                            await page.waitForTimeout(2000);
                            break;
                        }
                    } catch (e) {}
                }

                // 滚动加载更多内容 - 优化为5次，减少等待时间
                for (let i = 0; i < 5; i++) {
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await page.waitForTimeout(1000);
                }

                // 提取所有文章链接
                const urls = await page.evaluate(() => {
                    const links = new Set();
                    
                    // 更精确的选择器策略
                    const selectors = [
                        'article h2 a[href]',
                        'article h3 a[href]',
                        '.post-title a[href]',
                        '.entry-title a[href]',
                        'h2 a[href*="/news-opinion/"]',
                        'h2 a[href*="/reviews/"]',
                        'h2 a[href*="/buyers-guides/"]',
                        'h3 a[href*="/labs/"]',
                        'h3 a[href*="/we-tried-it/"]',
                        'a[href*="/uncategorized/"]'
                    ];

                    selectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(link => {
                            const href = link.href;
                            const urlPath = href.replace('https://mygolfspy.com/', '');
                            const segments = urlPath.split('/').filter(s => s);
                            
                            // 只保留具体文章（URL深度>=3或有具体标题）
                            const isArticle = (
                                segments.length >= 3 || // 例如: /news-opinion/instruction/article-title/
                                (segments.length === 2 && segments[1].length > 20) // 例如: /labs/long-article-title-here/
                            );
                            
                            // 排除分类页面
                            const isCategory = (
                                urlPath.match(/^(reviews|buyers-guides|news-opinion|golf-travel)\/(drivers|irons|fairway-woods|hybrids|golf-wedges|putters|golf-balls|golf-bags|golf-technology|golf-gloves|golf-shoes|golf-apparel|golf-accessories)\/$/) ||
                                urlPath.endsWith('/reviews/') ||
                                urlPath.endsWith('/buyers-guides/') ||
                                urlPath.endsWith('/news-opinion/') ||
                                urlPath.endsWith('/instruction/') ||
                                urlPath.endsWith('/golf-travel/')
                            );
                            
                            if (href && 
                                href.includes('mygolfspy.com') &&
                                isArticle &&
                                !isCategory &&
                                !href.includes('#') &&
                                !href.includes('category') &&
                                !href.includes('tag') &&
                                !href.includes('author') &&
                                !href.includes('page/') &&
                                !href.includes('forum.mygolfspy.com')) {
                                links.add(href);
                            }
                        });
                    });

                    return Array.from(links);
                });

                urls.forEach(url => allUrls.add(url));
                console.log(`✅ 找到 ${urls.length} 个URL`);

            } catch (e) {
                console.log(`❌ 错误: ${e.message}`);
            }
        }

        // 不再添加额外的URL，只使用从主页抓取的

        const finalUrls = Array.from(allUrls);
        console.log(`\n📊 总共找到 ${finalUrls.length} 个独特URL`);

        // 保存到文件
        const urlContent = finalUrls.join('\n') + '\n';
        await fs.writeFile('deep_urls_mygolfspy_com.txt', urlContent);
        console.log('✅ URL已保存到: deep_urls_mygolfspy_com.txt');

        // 如果是--urls-only模式，直接输出
        if (process.argv.includes('--urls-only')) {
            console.log(urlContent);
        }

        return finalUrls;

    } catch (error) {
        console.error('❌ 错误:', error);
        return [];
    } finally {
        await browser.close();
    }
}

// 执行
if (require.main === module) {
    generateMyGolfSpyUrls().catch(console.error);
}

module.exports = generateMyGolfSpyUrls;