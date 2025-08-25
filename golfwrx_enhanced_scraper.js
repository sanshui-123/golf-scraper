const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class GolfWRXEnhancedScraper {
    constructor() {
        this.baseUrl = 'https://www.golfwrx.com';
        this.retryLimit = 3;
    }

    /**
     * 从GolfWRX首页获取文章列表
     */
    async getArticlesFromHomepage() {
        console.log('[GolfWRX Enhanced] 开始获取文章列表...');
        
        const browser = await chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ]
        });

        try {
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'en-US',
                permissions: ['geolocation']
            });
            
            const page = await context.newPage();
            
            // 注入反检测脚本
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                
                // 修改插件数量
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                // 修改权限API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            });
            
            console.log('[GolfWRX Enhanced] 访问首页...');
            await page.goto(this.baseUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // 处理Cloudflare
            console.log('[GolfWRX Enhanced] 等待页面完全加载...');
            let waitTime = 0;
            const maxWaitTime = 30000;
            const checkInterval = 2000;
            
            while (waitTime < maxWaitTime) {
                await page.waitForTimeout(checkInterval);
                waitTime += checkInterval;
                
                const pageContent = await page.content();
                
                // 检查是否还在Cloudflare页面
                if (!pageContent.includes('Cloudflare') && 
                    !pageContent.includes('cf-browser-verification')) {
                    
                    // 检查是否有文章内容
                    const hasContent = await page.evaluate(() => {
                        return document.querySelector('a[href*="/20"]') !== null ||
                               document.querySelector('.mvp-flex-story-wrap') !== null;
                    });
                    
                    if (hasContent) {
                        console.log('[GolfWRX Enhanced] 页面加载完成');
                        break;
                    }
                }
                
                console.log(`[GolfWRX Enhanced] 等待页面... (${waitTime/1000}秒)`);
            }
            
            // 额外等待确保稳定
            await page.waitForTimeout(3000);
            
            // 提取文章
            const articles = await page.evaluate(() => {
                const items = [];
                
                // 查找所有包含年份的链接（GolfWRX的文章URL都包含年份）
                const links = document.querySelectorAll('a[href*="/20"]');
                const processedUrls = new Set();
                
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent.trim();
                    
                    // 过滤掉非文章链接
                    if (url && title && 
                        !url.includes('/page/') && 
                        !url.includes('/category/') &&
                        !url.includes('/tag/') &&
                        !url.includes('/author/') &&
                        url.includes('golfwrx.com') &&
                        title.length > 10 &&
                        !processedUrls.has(url)) {
                        
                        processedUrls.add(url);
                        
                        // 尝试查找时间信息
                        let timeText = '';
                        const parent = link.closest('.mvp-flex-story-wrap, .mvp-blog-story-wrap, article, .post');
                        if (parent) {
                            const timeElement = parent.querySelector('time, .mvp-cd-date, .post-date');
                            if (timeElement) {
                                timeText = timeElement.textContent.trim();
                            }
                        }
                        
                        items.push({
                            url,
                            title,
                            time: timeText
                        });
                    }
                });
                
                return items;
            });
            
            console.log(`[GolfWRX Enhanced] 找到 ${articles.length} 篇文章`);
            
            // 保存截图用于调试
            await page.screenshot({ 
                path: 'golfwrx_enhanced_screenshot.png', 
                fullPage: false 
            });
            
            return articles;
            
        } catch (error) {
            console.error('[GolfWRX Enhanced] 错误:', error.message);
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * 获取最新文章URL列表
     * @param {number} limit - 限制数量
     * @returns {Array} URL数组
     */
    async getRecentArticles(limit = 10) {
        const articles = await this.getArticlesFromHomepage();
        
        if (articles.length === 0) {
            console.log('[GolfWRX Enhanced] 尝试备用方案...');
            // 可以在这里添加备用方案，如访问特定分类页面
        }
        
        // 限制返回数量
        const limitedArticles = articles.slice(0, limit);
        
        // 打印文章信息
        console.log('\n[GolfWRX Enhanced] 获取到的文章:');
        limitedArticles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   URL: ${article.url}`);
            if (article.time) {
                console.log(`   时间: ${article.time}`);
            }
            console.log('');
        });
        
        // 只返回URL数组
        return limitedArticles.map(article => article.url);
    }
}

module.exports = GolfWRXEnhancedScraper;

// 如果直接运行此文件
if (require.main === module) {
    const scraper = new GolfWRXEnhancedScraper();
    
    (async () => {
        console.log('测试 GolfWRX Enhanced 抓取器...\n');
        
        // 获取文章
        const urls = await scraper.getRecentArticles(5);
        
        console.log('\n获取到的文章URL:');
        urls.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
    })();
}