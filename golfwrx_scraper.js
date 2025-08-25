const { chromium } = require('playwright');

class GolfWRXScraper {
    constructor() {
        this.baseUrl = 'https://www.golfwrx.com';
        this.retryLimit = 3;
        this.cloudflareRetryDelay = 15000; // Cloudflare等待时间增加到15秒
        this.pageLoadTimeout = 60000; // 页面加载超时时间
        this.cloudflareMaxWait = 45000; // Cloudflare最大等待时间
        
        // 专注于新闻页面的入口点
        this.entryPoints = [
            '/news/',
            '/news/equipment/',
            '/news/tour/',
            '/news/instruction/',
            '/news/page/2/',
            '/news/page/3/',
            '/category/news/',
            '/category/equipment/equipment-news/'
        ];
        
        // 多个用户代理轮换
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
    }

    /**
     * 从页面提取文章列表（专注于新闻内容）
     * @param {Page} page - Playwright页面对象
     * @returns {Array} 文章数组
     */
    async extractArticlesFromPage(page) {
        return await page.evaluate(() => {
            const items = [];
            const processedUrls = new Set();
            
            // 专门针对新闻页面的选择器 - 根据您的puppeteer测试优化
            const newsSelectors = [
                // 更通用的选择器策略
                'a[href]', // 先获取所有链接，然后过滤
                // 新闻特定选择器
                'article .entry-title a',
                '.post-title a',
                '.news-item h2 a',
                '.news-item h3 a',
                '.entry-header h1 a',
                '.entry-header h2 a',
                '.post-header h2 a',
                'h2.entry-title a',
                'h3.entry-title a',
                '.content-area article h2 a',
                '.content-area article h3 a',
                // MVP主题选择器
                '.mvp-blog-story-text h2 a',
                '.mvp-widget-home-title a',
                // TD主题选择器
                '.td-module-title a',
                '.td_module_wrap h3 a',
                // 包含class的选择器
                '[class*="post"] a',
                '[class*="article"] a',
                '[class*="news"] a'
            ];
            
            // 遍历所有选择器
            for (const selector of newsSelectors) {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent.trim();
                    
                    // 更宽松的过滤条件 - 基于您的puppeteer测试
                    if (url && title && 
                        url.includes('golfwrx.com') &&
                        !url.includes('/page/') && 
                        !url.includes('/category/') &&
                        !url.includes('/tag/') &&
                        !url.includes('/author/') &&
                        !url.includes('#') &&
                        !url.includes('javascript:') &&
                        !url.includes('forum') &&
                        !url.includes('/wp-admin/') &&
                        !url.includes('/wp-content/') &&
                        title.length > 5 && // 降低标题长度要求
                        !processedUrls.has(url) &&
                        // 确保是文章链接（包含数字ID或news关键词）
                        (url.match(/\/\d{6,}\//) || url.includes('/news/') || 
                         url.includes('/article/') || url.includes('/post/'))) {
                        
                        processedUrls.add(url);
                        
                        // 查找时间信息
                        let timeText = '';
                        const parent = link.closest('article, .post, .news-item, .td_module_wrap, .mvp-blog-story-wrap');
                        if (parent) {
                            const timeElement = parent.querySelector('time, .date, .post-date, .td-post-date, .mvp-cd-date');
                            if (timeElement) {
                                timeText = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
                            }
                        }
                        
                        items.push({
                            url,
                            title,
                            time: timeText,
                            category: 'news'
                        });
                    }
                });
            }

            return items;
        });
    }

    /**
     * 模拟人类行为
     * @param {Page} page - Playwright页面对象
     */
    async simulateHumanBehavior(page) {
        try {
            // 随机滚动
            const scrollTimes = Math.floor(Math.random() * 3) + 2;
            for (let i = 0; i < scrollTimes; i++) {
                await page.mouse.wheel(0, Math.random() * 300 + 100);
                await page.waitForTimeout(Math.random() * 1500 + 500);
            }
            
            // 随机鼠标移动
            const moveTimes = Math.floor(Math.random() * 5) + 3;
            for (let i = 0; i < moveTimes; i++) {
                const x = Math.floor(Math.random() * 800) + 100;
                const y = Math.floor(Math.random() * 600) + 100;
                await page.mouse.move(x, y);
                await page.waitForTimeout(Math.random() * 300 + 100);
            }
        } catch (e) {
            console.log('[GolfWRX] 人类行为模拟出错:', e.message);
        }
    }
    
    /**
     * 从分类页面获取更多文章
     * @param {Page} page - Playwright页面对象
     * @param {number} limit - 文章数量限制
     * @returns {Array} 文章数组
     */
    async getArticlesFromCategories(page, limit) {
        const allArticles = [];
        const processedUrls = new Set();
        
        // 使用更多的入口点
        for (const entryPoint of this.entryPoints) {
            if (allArticles.length >= limit) break;
            
            try {
                console.log(`[GolfWRX] 尝试访问: ${entryPoint || '首页'}`);
                
                // 设置资源拦截以加快加载速度（更细致的控制）
                await page.route('**/*', route => {
                    const resourceType = route.request().resourceType();
                    const url = route.request().url();
                    
                    // 拦截不必要的资源
                    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                        route.abort();
                    } else if (url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });
                
                await page.goto(this.baseUrl + entryPoint, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                
                // 等待更长时间确保页面加载
                await page.waitForTimeout(8000);
                await this.simulateHumanBehavior(page);
                
                // 调试信息
                const pageTitle = await page.title();
                console.log(`[GolfWRX] 页面标题: ${pageTitle}`);
                
                // 提取文章
                let articles = await this.extractArticlesFromPage(page);
                
                // 如果没找到文章，使用备用方法
                if (articles.length === 0) {
                    console.log(`[GolfWRX] 使用备用方法查找文章...`);
                    articles = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a[href]'));
                        const found = [];
                        const seen = new Set();
                        
                        links.forEach(link => {
                            const url = link.href;
                            const text = (link.textContent || '').trim();
                            
                            if (url && text && 
                                url.includes('golfwrx.com') &&
                                text.length > 10 &&
                                !seen.has(url) &&
                                url.match(/\/\d{5,}\//)) {
                                
                                seen.add(url);
                                found.push({
                                    url: url,
                                    title: text,
                                    source: 'GolfWRX'
                                });
                            }
                        });
                        
                        return found;
                    });
                }
                
                // 添加未重复的文章
                articles.forEach(article => {
                    if (!processedUrls.has(article.url) && allArticles.length < limit) {
                        processedUrls.add(article.url);
                        allArticles.push(article);
                    }
                });
                
                console.log(`[GolfWRX] 从${entryPoint || '首页'}获取到 ${articles.length} 篇文章`);
                
                // 随机延迟避免被检测
                await page.waitForTimeout(Math.random() * 5000 + 3000);
                
            } catch (e) {
                console.log(`[GolfWRX] 访问${entryPoint}失败: ${e.message}`);
            }
        }
        
        return allArticles;
    }
    
    /**
     * 获取最新文章列表
     * @param {number} limit - 获取文章数量限制
     * @returns {Array} 文章URL数组
     */
    async getRecentArticles(limit = 20) {
        console.log('[GolfWRX] 开始获取文章列表...');
        
        // 随机选择用户代理
        const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        
        const browser = await chromium.launch({
            headless: true,  // 使用headless模式，后台运行
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--start-maximized',
                `--user-agent=${userAgent}`,
                '--disable-infobars',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--disable-prompt-on-repost',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--no-first-run',
                '--no-zygote',
                '--disable-features=VizDisplayCompositor'
            ],
            slowMo: 100 // 减慢操作速度，更像人类行为
        });

        try {
            const context = await browser.newContext({
                userAgent: userAgent,
                viewport: { width: 1920, height: 1080 },
                ignoreHTTPSErrors: true,
                javaScriptEnabled: true,
                bypassCSP: true,
                locale: 'en-US',
                timezoneId: 'America/New_York',
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: false,
                permissions: ['geolocation']
            });
            
            const page = await context.newPage();
            
            // 添加更强的stealth模式相关的JavaScript注入
            await page.addInitScript(() => {
                // 隐藏webdriver属性
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                
                // 修改插件数量
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                // 修改语言
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en']
                });
                
                // 添加完整的chrome对象
                window.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                };
                
                // 修改权限API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // 隐藏自动化痕迹
                delete navigator.__proto__.webdriver;
                
                // 隐藏Playwright特有的属性
                const originalQuery2 = window.document.querySelector;
                window.document.querySelector = function(selector) {
                    if (selector === 'img[src*="data:image/png;base64"]') {
                        return null;
                    }
                    return originalQuery2.apply(this, arguments);
                };
            });
            
            // 设置额外的请求头
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            });

            let attempt = 0;
            let articles = [];

            while (attempt < this.retryLimit && articles.length === 0) {
                attempt++;
                console.log(`[GolfWRX] 尝试访问网站 (第${attempt}/${this.retryLimit}次)...`);
                
                try {
                    // 使用更长的超时时间和更灵活的等待策略
                    await page.goto(this.baseUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: this.pageLoadTimeout
                    });

                    // 等待页面加载
                    await page.waitForTimeout(3000);

                    // 智能检测和处理Cloudflare挑战
                    const pageContent = await page.content();
                    const hasCloudflare = pageContent.includes('Cloudflare') || 
                                        pageContent.includes('Checking your browser') || 
                                        pageContent.includes('Please wait') || 
                                        pageContent.includes('cf-browser-verification') ||
                                        pageContent.includes('Just a moment');
                    
                    if (hasCloudflare) {
                        console.log('[GolfWRX] 检测到Cloudflare保护，智能等待通过...');
                        
                        try {
                            // 使用更智能的等待策略
                            let waitTime = 0;
                            const checkInterval = 2000;
                            let lastContentLength = 0;
                            let stableCount = 0;
                            
                            while (waitTime < this.cloudflareMaxWait) {
                                await page.waitForTimeout(checkInterval);
                                waitTime += checkInterval;
                                
                                // 获取当前页面内容
                                const currentContent = await page.content();
                                const currentUrl = page.url();
                                
                                // 检查内容是否稳定（连续3次内容长度不变表示页面稳定）
                                if (currentContent.length === lastContentLength) {
                                    stableCount++;
                                } else {
                                    stableCount = 0;
                                    lastContentLength = currentContent.length;
                                }
                                
                                // 多重检查条件
                                const cloudflareGone = !currentContent.includes('Cloudflare') && 
                                                     !currentContent.includes('cf-browser-verification');
                                const hasArticleContent = await page.evaluate(() => {
                                    // 检查是否有文章相关元素
                                    return document.querySelector('a[href*="/20"]') !== null ||
                                           document.querySelector('.mvp-flex-story-wrap') !== null ||
                                           document.querySelector('.td_module_wrap') !== null ||
                                           document.querySelector('article') !== null;
                                });
                                
                                // 判断是否通过Cloudflare
                                if ((cloudflareGone && hasArticleContent) || stableCount >= 3) {
                                    console.log('[GolfWRX] Cloudflare验证已通过');
                                    break;
                                }
                                
                                console.log(`[GolfWRX] 等待Cloudflare验证... (${waitTime/1000}/${this.cloudflareMaxWait/1000}秒)`);
                            }
                            
                            // 额外等待确保页面完全稳定
                            await page.waitForTimeout(5000);
                            
                        } catch (e) {
                            console.log('[GolfWRX] Cloudflare处理出错:', e.message);
                        }
                    } else {
                        // 即使没检测到Cloudflare，也等待更长时间确保页面加载完成
                        console.log('[GolfWRX] 等待页面完全加载...');
                        await page.waitForTimeout(8000);
                    }

                    // 获取文章列表
                    articles = await this.extractArticlesFromPage(page);

                    // 如果第一次没找到文章，尝试更通用的方法
                    if (articles.length === 0) {
                        console.log('[GolfWRX] 使用备用方法查找文章...');
                        articles = await page.evaluate(() => {
                            const allLinks = Array.from(document.querySelectorAll('a[href]'));
                            const articleLinks = [];
                            const seen = new Set();
                            
                            allLinks.forEach(link => {
                                const url = link.href;
                                const text = link.textContent?.trim() || '';
                                
                                if (url && text && 
                                    url.includes('golfwrx.com') &&
                                    text.length > 10 &&
                                    !url.includes('/page/') &&
                                    !url.includes('#') &&
                                    !seen.has(url) &&
                                    // 查找包含数字ID的URL（典型的WordPress文章格式）
                                    url.match(/\/\d{5,}\//)) {
                                    
                                    seen.add(url);
                                    articleLinks.push({
                                        url: url,
                                        title: text,
                                        source: 'GolfWRX'
                                    });
                                }
                            });
                            
                            return articleLinks.slice(0, 20);
                        });
                    }

                    if (articles.length > 0) {
                        console.log(`[GolfWRX] 从首页找到 ${articles.length} 篇文章`);
                        
                        // 如果文章数量不够，尝试从新闻页面获取更多
                        if (articles.length < limit) {
                            console.log(`[GolfWRX] 新闻文章数量不足，尝试从新闻页面获取更多...`);
                            const moreArticles = await this.getArticlesFromCategories(page, limit);
                            
                            // 合并文章，去重
                            const urlSet = new Set(articles.map(a => a.url));
                            moreArticles.forEach(article => {
                                if (!urlSet.has(article.url) && articles.length < limit) {
                                    urlSet.add(article.url);
                                    articles.push(article);
                                }
                            });
                            
                            console.log(`[GolfWRX] 总共获取到 ${articles.length} 篇新闻文章`);
                        }
                        break;
                    } else {
                        console.log('[GolfWRX] 首页未找到新闻，尝试新闻页面...');
                        articles = await this.getArticlesFromCategories(page, limit);
                        if (articles.length > 0) {
                            console.log(`[GolfWRX] 从新闻页面获取到 ${articles.length} 篇文章`);
                            break;
                        }
                    }

                } catch (error) {
                    console.error(`[GolfWRX] 访问失败:`, error.message);
                    
                    // 智能错误处理和备用策略
                    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
                        console.log('[GolfWRX] 检测到超时，尝试多种备用策略...');
                        
                        // 备用策略1: 尝试设备新闻页面
                        const backupUrls = [
                            '/category/equipment/',
                            '/category/equipment/equipment-news/',
                            '/category/news/',
                            '/category/instruction/'
                        ];
                        
                        for (const backupUrl of backupUrls) {
                            try {
                                console.log(`[GolfWRX] 尝试备用URL: ${backupUrl}`);
                                await page.goto(this.baseUrl + backupUrl, {
                                    waitUntil: 'domcontentloaded',
                                    timeout: 30000
                                });
                                await page.waitForTimeout(5000);
                                
                                // 再次尝试获取文章
                                articles = await this.extractArticlesFromPage(page);
                                if (articles.length > 0) {
                                    console.log(`[GolfWRX] 通过备用策略找到 ${articles.length} 篇文章`);
                                    break;
                                }
                            } catch (e) {
                                console.log(`[GolfWRX] 备用URL ${backupUrl} 失败`);
                            }
                        }
                    }
                    
                    if (attempt < this.retryLimit) {
                        const retryDelay = attempt * 5000; // 递增等待时间
                        console.log(`[GolfWRX] 等待${retryDelay/1000}秒后重试...`);
                        await page.waitForTimeout(retryDelay);
                    }
                }
            }

            // 限制返回数量
            const limitedArticles = articles.slice(0, limit);
            
            // 只返回URL数组
            return limitedArticles.map(article => article.url);

        } catch (error) {
            console.error('[GolfWRX] 抓取失败:', error);
            return [];
        } finally {
            await browser.close();
        }
    }
}

module.exports = GolfWRXScraper;

// 如果直接运行此文件
if (require.main === module) {
    const scraper = new GolfWRXScraper();
    
    (async () => {
        console.log('测试 GolfWRX 抓取器...\n');
        
        // 获取文章
        const articles = await scraper.getRecentArticles(10);
        
        console.log('\n获取到的文章URL:');
        articles.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
    })();
}