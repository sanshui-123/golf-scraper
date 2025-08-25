const MyGolfSpyRSSScraper = require('./mygolfspy_rss_scraper');
const playwright = require('playwright');

/**
 * MyGolfSpy混合抓取器
 * 结合RSS和网页抓取，以获取更多文章
 */
class MyGolfSpyHybridScraper {
    constructor() {
        this.rssScraper = new MyGolfSpyRSSScraper();
        this.baseUrl = 'https://mygolfspy.com';
        this.categoryPages = [
            '/news-opinion/',
            '/reviews/',
            '/instruction/'
        ];
    }

    /**
     * 获取指定数量的文章URL
     * @param {number} limit - 需要的文章数量
     * @returns {Promise<Array>} URL数组
     */
    async getArticleUrls(limit = 15) {
        console.log(`[MyGolfSpy Hybrid] 开始获取 ${limit} 篇文章...`);
        
        // 首先通过RSS获取
        const rssUrls = await this.rssScraper.getLatestArticleUrls(Math.min(limit, 10));
        console.log(`[MyGolfSpy Hybrid] RSS获取了 ${rssUrls.length} 篇文章`);
        
        if (rssUrls.length >= limit) {
            return rssUrls.slice(0, limit);
        }
        
        // 如果需要更多，通过网页抓取补充
        const additionalNeeded = limit - rssUrls.length;
        console.log(`[MyGolfSpy Hybrid] 需要额外获取 ${additionalNeeded} 篇文章`);
        
        const webUrls = await this.getWebArticleUrls(additionalNeeded * 2, rssUrls); // 获取2倍数量以便去重
        
        // 合并并去重
        const allUrls = [...new Set([...rssUrls, ...webUrls])];
        
        console.log(`[MyGolfSpy Hybrid] 总共获取了 ${allUrls.length} 篇不重复的文章`);
        return allUrls.slice(0, limit);
    }

    /**
     * 从网页获取文章URL
     * @param {number} count - 需要的数量
     * @param {Array} excludeUrls - 需要排除的URL（避免重复）
     * @returns {Promise<Array>} URL数组
     */
    async getWebArticleUrls(count, excludeUrls = []) {
        let browser;
        try {
            browser = await playwright.chromium.launch({ headless: true });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();
            
            const collectedUrls = [];
            const excludeSet = new Set(excludeUrls);
            
            // 从各个分类页面收集URL
            for (const categoryPath of this.categoryPages) {
                if (collectedUrls.length >= count) break;
                
                console.log(`[MyGolfSpy Hybrid] 扫描分类页面: ${categoryPath}`);
                await page.goto(this.baseUrl + categoryPath, {
                    waitUntil: 'networkidle',
                    timeout: 30000
                });
                
                // 等待文章列表加载
                await page.waitForTimeout(3000);
                
                // 滚动页面以加载更多内容
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await page.waitForTimeout(1000);
                
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });
                await page.waitForTimeout(1000);
                
                // 获取文章链接
                const links = await page.evaluate(() => {
                    const articleLinks = [];
                    // 更新选择器以匹配MyGolfSpy的实际结构
                    const selectors = [
                        'a[href*="/news-opinion/"][href$="/"]',
                        'a[href*="/reviews/"][href$="/"]',
                        'a[href*="/instruction/"][href$="/"]',
                        'article a[href*="mygolfspy.com"]',
                        '.post-item a[href*="mygolfspy.com"]',
                        '.article-title a',
                        '.post-title a',
                        '.entry-title a',
                        'h2 a[href*="mygolfspy.com"]',
                        'h3 a[href*="mygolfspy.com"]',
                        '[class*="post"] a[href*="mygolfspy.com"]',
                        '[class*="article"] a[href*="mygolfspy.com"]'
                    ];
                    
                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            const href = el.href;
                            if (href && href.includes('mygolfspy.com') && 
                                !href.includes('/category/') && 
                                !href.includes('/tag/') &&
                                !href.includes('/page/')) {
                                articleLinks.push(href);
                            }
                        });
                    }
                    
                    return [...new Set(articleLinks)]; // 去重
                });
                
                console.log(`[MyGolfSpy Hybrid] 从 ${categoryPath} 找到 ${links.length} 个链接`);
                
                // 过滤并添加新URL
                let newUrlsAdded = 0;
                for (const url of links) {
                    if (!excludeSet.has(url) && !collectedUrls.includes(url)) {
                        collectedUrls.push(url);
                        newUrlsAdded++;
                        if (collectedUrls.length >= count) break;
                    }
                }
                console.log(`[MyGolfSpy Hybrid] 新增 ${newUrlsAdded} 个不重复的URL`);
                
                // 如果没有找到新URL，尝试直接访问文章列表页
                if (newUrlsAdded === 0 && collectedUrls.length < count) {
                    console.log(`[MyGolfSpy Hybrid] 尝试从主页获取更多文章...`);
                    await page.goto(this.baseUrl, {
                        waitUntil: 'networkidle',
                        timeout: 30000
                    });
                    await page.waitForTimeout(3000);
                    
                    const homeLinks = await page.evaluate(() => {
                        const links = [];
                        document.querySelectorAll('a[href*="mygolfspy.com"]').forEach(el => {
                            const href = el.href;
                            if (href && 
                                (href.includes('/news-opinion/') || 
                                 href.includes('/reviews/') || 
                                 href.includes('/instruction/')) &&
                                href.endsWith('/') &&
                                !href.includes('/category/') && 
                                !href.includes('/tag/')) {
                                links.push(href);
                            }
                        });
                        return [...new Set(links)];
                    });
                    
                    console.log(`[MyGolfSpy Hybrid] 从主页找到 ${homeLinks.length} 个链接`);
                    for (const url of homeLinks) {
                        if (!excludeSet.has(url) && !collectedUrls.includes(url)) {
                            collectedUrls.push(url);
                            if (collectedUrls.length >= count) break;
                        }
                    }
                }
            }
            
            return collectedUrls;
            
        } catch (error) {
            console.error('[MyGolfSpy Hybrid] 网页抓取失败:', error.message);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }
}

// 导出供其他模块使用
module.exports = MyGolfSpyHybridScraper;

// 如果直接运行
if (require.main === module) {
    const scraper = new MyGolfSpyHybridScraper();
    const limit = parseInt(process.argv[2]) || 15;
    
    scraper.getArticleUrls(limit)
        .then(urls => {
            console.log(`\n📋 获取到 ${urls.length} 个URL:`);
            urls.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
        })
        .catch(error => console.error('❌ 失败:', error));
}