const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const SiteSpecificScrapers = require('./site_specific_scrapers');

class RecentArticleDiscoverer {
    constructor() {
        this.existingUrls = this.loadExistingUrls();
        this.serverCheckUrl = 'http://localhost:8080/api/check-urls';
        this.siteSpecificScrapers = new SiteSpecificScrapers();
    }

    /**
     * 加载所有已处理的文章URL
     */
    loadExistingUrls() {
        const urls = new Set();
        const golfContentDir = './golf_content';
        
        if (fs.existsSync(golfContentDir)) {
            const dateDirs = fs.readdirSync(golfContentDir)
                .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
            
            for (const dateDir of dateDirs) {
                const urlsFile = path.join(golfContentDir, dateDir, 'article_urls.json');
                if (fs.existsSync(urlsFile)) {
                    try {
                        const urlMap = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                        Object.values(urlMap).forEach(url => urls.add(url));
                    } catch (e) {
                        console.error(`加载URL文件失败 ${urlsFile}:`, e.message);
                    }
                }
            }
        }
        
        return urls;
    }

    /**
     * 从服务器API检查URL是否已存在
     */
    async checkUrlsWithServer(urls) {
        try {
            const response = await axios.post(this.serverCheckUrl, { urls });
            return response.data;
        } catch (error) {
            console.log('⚠️  无法连接到服务器API，使用本地检查');
            return urls.map(url => ({
                url,
                exists: this.existingUrls.has(url)
            }));
        }
    }

    /**
     * 发现最近24小时的新文章
     * @param {string} homepageUrl - 主页URL
     * @param {Object} options - 可选参数
     * @param {boolean} options.fetchDetailTime - 是否从详情页获取时间（默认false）
     * @param {boolean} options.ignoreTime - 是否忽略时间过滤，获取所有文章（默认false）
     * @param {boolean} options.showDebug - 是否显示调试信息（默认false）
     */
    async discoverRecentArticles(homepageUrl, options = {}) {
        if (options.ignoreTime) {
            console.log('\n🔍 开始扫描所有文章（忽略时间）...');
        } else {
            console.log('\n🔍 开始扫描最近24小时的新文章...');
        }
        console.log(`📍 主页: ${homepageUrl}`);
        
        const browser = await chromium.launch({
            headless: true,
            executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            timeout: 60000 // 增加浏览器启动超时到60秒
        });

        // 读取稳定性配置
        let stabilityConfig = {
            network: { pageLoadTimeout: { default: 30000, retry: 45000, maxAttempts: 3, retryDelay: 3000 } }
        };
        try {
            stabilityConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'stability_config.json'), 'utf8'));
        } catch (e) {
            console.log('⚠️ 使用默认超时配置');
        }
        
        let page;
        let attempt = 0;
        const maxAttempts = stabilityConfig.network.pageLoadTimeout.maxAttempts || 3;
        const urlObj = new URL(homepageUrl);
        const isGolfCom = urlObj.hostname.includes('golf.com');
        const isGolfWRX = urlObj.hostname.includes('golfwrx.com');
        
        // 重试机制
        while (attempt < maxAttempts) {
            try {
                attempt++;
                page = await browser.newPage();
                
                // 使用最稳定的策略 - 所有网站都用domcontentloaded
                // 之前两天一直正常工作的配置
                const waitStrategy = 'domcontentloaded';
                
                // Golf.com需要更长的超时时间
                let timeout;
                if (isGolfCom) {
                    timeout = attempt === 1 ? 45000 : 60000; // Golf.com: 45秒/60秒
                } else {
                    timeout = attempt === 1 ? 
                        stabilityConfig.network.pageLoadTimeout.default : 
                        stabilityConfig.network.pageLoadTimeout.retry;
                }
                
                console.log(`⏳ 尝试加载页面 (第${attempt}/${maxAttempts}次, 超时: ${timeout/1000}秒, 策略: ${waitStrategy})`);
                
                await page.goto(homepageUrl, { 
                    waitUntil: waitStrategy, 
                    timeout: timeout 
                });
                
                // 特定网站需要额外等待
                if (isGolfCom) {
                    console.log('⏳ Golf.com特殊等待：等待动态内容加载...');
                    await page.waitForTimeout(5000);
                } else if (isGolfWRX) {
                    console.log('⏳ GolfWRX特殊等待：可能有Cloudflare保护...');
                    await page.waitForTimeout(8000);
                    // 检查是否有Cloudflare挑战
                    const pageContent = await page.content();
                    if (pageContent.includes('Cloudflare') && pageContent.includes('Checking your browser')) {
                        console.log('🔄 检测到Cloudflare，继续等待...');
                        await page.waitForTimeout(5000);
                    }
                } else {
                    await page.waitForTimeout(3000);
                }
                
                // 成功加载，跳出重试循环
                break;
                
            } catch (error) {
                console.error(`⚠️ 第${attempt}次加载失败: ${error.message}`);
                if (page) {
                    await page.close().catch(() => {});
                }
                
                if (attempt < maxAttempts) {
                    const delay = stabilityConfig.network.pageLoadTimeout.retryDelay || 3000;
                    console.log(`⏳ ${delay/1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Golf.com特殊处理 - 如果全部失败，尝试最后一次简单加载
                    if (isGolfCom && error.message.includes('Timeout')) {
                        console.log('🔧 Golf.com特殊处理：尝试快速加载模式...');
                        try {
                            page = await browser.newPage();
                            // 设置更短的超时，只等待初始响应
                            await page.goto(homepageUrl, { 
                                waitUntil: 'commit', 
                                timeout: 15000 
                            });
                            // 手动等待一些内容加载
                            await page.waitForTimeout(5000);
                            console.log('✅ Golf.com快速加载成功');
                            break; // 成功了，继续处理
                        } catch (quickError) {
                            if (page) await page.close().catch(() => {});
                            throw new Error(`Golf.com页面无法访问: ${quickError.message}`);
                        }
                    } else {
                        throw new Error(`页面加载失败，已尝试${maxAttempts}次: ${error.message}`);
                    }
                }
            }
        }
        
        try {
            
            // 滚动页面以加载更多文章
            console.log('📜 滚动页面以加载更多文章...');
            
            // 不同网站需要不同的滚动策略
            const scrollCount = isGolfCom ? 8 : (isGolfWRX ? 5 : 3);
            const scrollDelay = isGolfCom ? 2000 : (isGolfWRX ? 1800 : 1500);
            
            // 分步滚动，每次滚动一屏
            for (let i = 0; i < scrollCount; i++) {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
                await page.waitForTimeout(scrollDelay);
                
                if (isGolfCom && i % 2 === 0) {
                    console.log(`  滚动进度: ${i + 1}/${scrollCount}`);
                }
            }
            
            // 最后滚动到页面底部
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            // Golf.com可能需要额外等待内容渲染
            if (isGolfCom) {
                console.log('⏳ 等待Golf.com内容完全渲染...');
                await page.waitForTimeout(5000);  // 增加等待时间
            }
            
            // 检查是否有"加载更多"按钮
            try {
                const loadMoreButton = await page.$('button[class*="load-more"], button[class*="loadmore"], a[class*="load-more"], .load-more-button');
                if (loadMoreButton) {
                    console.log('🔘 找到"加载更多"按钮，点击加载...');
                    await loadMoreButton.click();
                    await page.waitForTimeout(3000);
                }
            } catch (e) {
                // 忽略错误
            }
            
            // 调试：截图查看页面
            // await page.screenshot({ path: 'debug_homepage.png' });
            
            // 获取网站配置
            let siteConfig = null;
            try {
                const urlObj = new URL(homepageUrl);
                const domain = urlObj.hostname.replace('www.', '');
                const websiteConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, 'website_configs.json'), 'utf8'));
                siteConfig = websiteConfigs[domain];
            } catch (e) {
                // 使用默认配置
            }
            
            // 获取所有文章链接和时间
            const articles = await page.evaluate((config) => {
                const articleData = [];
                const seenUrls = new Set(); // 用于去重
                const debug = {
                    selectors: [],
                    linksFound: 0,
                    duplicatesRemoved: 0
                };
                
                // 使用网站配置的选择器，如果没有配置则使用默认
                const containerSelector = config?.articleListSelectors?.container || 
                    '.listing__item, .article-listing__item, .listing-item, .content-card, .card';
                
                let articleContainers = document.querySelectorAll(containerSelector);
                debug.selectors.push({selector: '.listing__item等', count: articleContainers.length});
                
                // 如果第一批选择器没找到，尝试更多可能的选择器
                if (articleContainers.length === 0) {
                    articleContainers = document.querySelectorAll('[class*="listing-item"], [class*="article-item"], [class*="post-item"], article');
                    debug.selectors.push({selector: '[class*="listing-item"]等', count: articleContainers.length});
                }
                
                // 如果还是没找到，使用基于链接的方法
                if (articleContainers.length === 0) {
                    // 动态构建选择器，支持不同网站
                    const hostname = window.location.hostname;
                    let linkSelector = `a[href*="${hostname}/news/"], a[href*="${hostname}/tips/"], a[href*="${hostname}/features/"], a[href*="${hostname}/buying-advice/"]`;
                    
                    // 如果有配置的文章模式，使用它们
                    if (config?.articlePatterns) {
                        linkSelector = config.articlePatterns
                            .map(pattern => `a[href*="${hostname}${pattern}"]`)
                            .join(', ');
                    }
                    
                    const allLinks = document.querySelectorAll(linkSelector);
                    debug.linksFound = allLinks.length;
                    const containerMap = new Map();
                    
                    allLinks.forEach(link => {
                        // 避免重复处理相同的URL
                        if (containerMap.has(link.href)) return;
                        
                        // 过滤掉首页/分类页URL，只保留具体文章URL
                        const url = link.href;
                        const urlObj = new URL(url);
                        const pathname = urlObj.pathname;
                        
                        // 排除分类页面和过短的URL
                        const segments = pathname.split('/').filter(segment => segment.length > 0);
                        const lastSegment = segments[segments.length - 1];
                        
                        // 排除明显的分类页面
                        const categoryNames = ['news', 'tips', 'features', 'buying-advice', 'instruction', 
                                               'gear', 'travel', 'lifestyle', 'fairway-woods', 'golf-accessories',
                                               'approach-shots', 'bunker-shots', 'celebrities', 'accessories'];
                        
                        if (categoryNames.includes(lastSegment) || segments.length < 2) {
                            return; // 跳过分类页面和过短的路径
                        }
                        
                        // 确保URL包含具体的文章slug（至少有3个字符）
                        if (lastSegment.length < 3 || lastSegment.match(/^\d+$/)) {
                            return; // 跳过过短或纯数字的slug
                        }
                        
                        // 向上查找包含时间信息的容器
                        let parent = link.parentElement;
                        let depth = 0;
                        
                        while (parent && depth < 5) {
                            // 使用配置的时间选择器，如果没有则使用默认
                            const timeSelector = config?.articleListSelectors?.time || 
                                'time, .date, [datetime], .publish-date, .article-date';
                            
                            // 检查是否包含时间元素或相对时间文本
                            const hasTime = parent.querySelector(timeSelector) || 
                                          parent.textContent.match(/(?:Published\s+)?\d{1,2}\s+(hour|day|min)/i);
                            
                            // 检查是否是合理的容器（包含标题和时间）
                            if (hasTime && (parent.querySelector('h2, h3, h4, .title') || link.querySelector('h2, h3, h4'))) {
                                containerMap.set(link.href, parent);
                                break;
                            }
                            
                            parent = parent.parentElement;
                            depth++;
                        }
                    });
                    
                    articleContainers = Array.from(containerMap.values());
                }
                
                articleContainers.forEach(container => {
                    // 查找链接
                    const linkElement = container.querySelector('a[href*="/news/"], a[href*="/tips/"], a[href*="/features/"], a[href*="/buying-advice/"]');
                    if (!linkElement) return;
                    
                    const url = linkElement.href;
                    
                    // 过滤掉首页/分类页URL，只保留具体文章URL
                    try {
                        const urlObj = new URL(url);
                        const pathname = urlObj.pathname;
                        
                        // 排除分类页面和过短的URL
                        const segments = pathname.split('/').filter(segment => segment.length > 0);
                        const lastSegment = segments[segments.length - 1];
                        
                        // 排除明显的分类页面
                        const categoryNames = ['news', 'tips', 'features', 'buying-advice', 'instruction', 
                                               'gear', 'travel', 'lifestyle', 'fairway-woods', 'golf-accessories',
                                               'approach-shots', 'bunker-shots', 'celebrities', 'accessories'];
                        
                        if (categoryNames.includes(lastSegment) || segments.length < 2) {
                            return; // 跳过分类页面和过短的路径
                        }
                        
                        // 确保URL包含具体的文章slug（至少有3个字符）
                        if (lastSegment.length < 3 || lastSegment.match(/^\d+$/)) {
                            return; // 跳过过短或纯数字的slug
                        }
                    } catch (e) {
                        // 如果URL无效，跳过
                        return;
                    }
                    
                    // 查找时间元素 - 增强版
                    let publishTime = null;
                    
                    // 0. 如果有网站配置，先尝试配置的时间选择器
                    if (config?.articleListSelectors?.time) {
                        const configTimeElements = container.querySelectorAll(config.articleListSelectors.time);
                        for (const elem of configTimeElements) {
                            // 尝试获取datetime属性
                            if (elem.getAttribute && elem.getAttribute(config.articleListSelectors.timeAttribute || 'datetime')) {
                                publishTime = elem.getAttribute(config.articleListSelectors.timeAttribute || 'datetime');
                                break;
                            }
                            // 或者获取文本内容
                            const text = elem.textContent.trim();
                            if (text && (text.match(/ago/i) || text.match(/\d{4}/) || text.match(/\d{1,2}\s+(hours?|days?)/i))) {
                                publishTime = text;
                                break;
                            }
                        }
                    }
                    
                    // 1. 如果配置方式没找到，使用通用方法（保持原有逻辑）
                    if (!publishTime) {
                        // Golf Monthly的时间通常在.listing__meta或类似位置
                        const metaElements = container.querySelectorAll('.listing__meta, .article-meta, .entry-meta, .post-meta, .content-meta');
                        for (const meta of metaElements) {
                            const timeMatch = meta.textContent.match(/(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i);
                            if (timeMatch) {
                                publishTime = timeMatch[0];
                                break;
                            }
                        }
                    }
                    
                    // 2. 查找带datetime属性的time元素
                    if (!publishTime) {
                        const timeElements = container.querySelectorAll('time[datetime], [data-publish-date], [data-date]');
                        for (const elem of timeElements) {
                            if (elem.getAttribute('datetime')) {
                                publishTime = elem.getAttribute('datetime');
                                break;
                            } else if (elem.getAttribute('data-publish-date')) {
                                publishTime = elem.getAttribute('data-publish-date');
                                break;
                            }
                        }
                    }
                    
                    // 3. 查找包含日期的文本元素（扩展选择器）
                    if (!publishTime) {
                        const dateElements = container.querySelectorAll('.date, .publish-date, .article-date, .meta-date, .entry-date, .post-date, .timestamp, .time-ago, [class*="date"], [class*="time"]');
                        for (const elem of dateElements) {
                            const text = elem.textContent.trim();
                            if (text && (text.match(/ago/i) || text.match(/\d{4}/) || text.match(/\d{1,2}\s+(hours?|days?)/i))) {
                                publishTime = text;
                                break;
                            }
                        }
                    }
                    
                    // 4. 从整个容器HTML中查找（不仅是textContent）
                    if (!publishTime) {
                        const containerHTML = container.innerHTML;
                        // 查找被标签分隔的时间信息
                        const htmlTimeMatch = containerHTML.match(/(?:Published|Posted|Updated)[\s\S]{0,50}?(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i);
                        if (htmlTimeMatch) {
                            publishTime = htmlTimeMatch[1] + ' ' + htmlTimeMatch[2] + ' ago';
                        }
                    }
                    
                    // 5. 从文本中查找相对时间（改进的模式）
                    if (!publishTime) {
                        const textContent = container.textContent;
                        // 更灵活的匹配模式
                        const patterns = [
                            /(?:Published|Posted|Updated)\s+(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i,
                            /(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago(?:\s+by)?/i,
                            /(?:By\s+[^•]+?[•·]\s*)?(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i
                        ];
                        
                        for (const pattern of patterns) {
                            const match = textContent.match(pattern);
                            if (match) {
                                publishTime = match[0].match(/(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i)[0];
                                break;
                            }
                        }
                    }
                    
                    // 6. 查找包含"By"作者信息附近的时间（改进版）
                    if (!publishTime) {
                        // 匹配 "By Author • X hours ago" 或 "By Author Published X hours ago"
                        const bylinePatterns = [
                            /By\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*[•·]?\s*(?:Published|Posted)?\s*(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i,
                            /By\s+.+?\s+(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i
                        ];
                        
                        for (const pattern of bylinePatterns) {
                            const match = container.textContent.match(pattern);
                            if (match) {
                                publishTime = match[1] + ' ' + match[2] + ' ago';
                                break;
                            }
                        }
                    }
                    
                    // 如果还是没找到，尝试从文章元数据中查找
                    if (!publishTime) {
                        const metaTime = container.querySelector('[data-publish-date], [data-date]');
                        if (metaTime) {
                            publishTime = metaTime.getAttribute('data-publish-date') || metaTime.getAttribute('data-date');
                        }
                    }
                    
                    // 获取更准确的标题（可能在h2, h3等元素中）
                    let title = linkElement.textContent.trim();
                    const titleElement = container.querySelector('h2, h3, h4, .title, .article-title');
                    if (titleElement) {
                        title = titleElement.textContent.trim();
                    }
                    
                    // 检查URL是否已经存在，避免重复
                    if (!seenUrls.has(url)) {
                        seenUrls.add(url);
                        articleData.push({
                            url,
                            publishTime,
                            title,
                            // 添加调试信息
                            debugInfo: !publishTime ? '未找到时间元素' : null
                        });
                    } else {
                        debug.duplicatesRemoved++;
                    }
                });
                
                // 统计时间查找情况
                const foundTimeCount = articleData.filter(a => a.publishTime).length;
                debug.timeFoundRate = `${foundTimeCount}/${articleData.length} (${Math.round(foundTimeCount/articleData.length*100)}%)`;
                
                // 返回数据和调试信息
                return {
                    articles: articleData,
                    debug: debug
                };
            }, siteConfig);
            
            // 输出调试信息
            if (articles.debug) {
                console.log('\n🔍 调试信息:');
                articles.debug.selectors.forEach(s => {
                    console.log(`  选择器 "${s.selector}" 找到 ${s.count} 个元素`);
                });
                if (articles.debug.linksFound > 0) {
                    console.log(`  基于链接方法找到 ${articles.debug.linksFound} 个链接`);
                }
                if (articles.debug.timeFoundRate) {
                    console.log(`  时间识别率: ${articles.debug.timeFoundRate}`);
                }
                if (articles.debug.duplicatesRemoved > 0) {
                    console.log(`  去除重复文章: ${articles.debug.duplicatesRemoved} 篇`);
                }
            }
            
            let articleList = articles.articles || articles;
            console.log(`\n📊 发现 ${articleList.length} 篇文章`);
            
            // 如果通用抓取失败，尝试网站特定抓取
            if (articleList.length === 0 && siteConfig) {
                console.log('⚠️  通用抓取未找到文章，尝试网站特定抓取...');
                
                try {
                    const urlObj = new URL(homepageUrl);
                    const domain = urlObj.hostname.replace('www.', '');
                    const specificScraper = this.siteSpecificScrapers.getScraper(domain);
                    
                    if (specificScraper) {
                        console.log(`🔧 使用 ${domain} 特定抓取器...`);
                        articleList = await specificScraper(page);
                        console.log(`✅ 网站特定抓取发现 ${articleList.length} 篇文章`);
                    }
                } catch (error) {
                    console.error('❌ 网站特定抓取失败:', error.message);
                }
            }
            
            // 分析是否可能遗漏文章
            if (options.showDebug) {
                console.log('\n🔍 文章URL列表:');
                articleList.forEach((article, index) => {
                    console.log(`${index + 1}. ${article.url}`);
                });
            }
            
            // 如果启用了从详情页获取时间，处理没有时间的文章
            if (options.fetchDetailTime) {
                console.log('\n⏳ 正在从详情页获取缺失的时间信息...');
                const articlesWithoutTime = articleList.filter(a => !a.publishTime);
                
                // 顺序处理每个文章，避免并发问题
                let processedCount = 0;
                for (const article of articlesWithoutTime) {
                    processedCount++;
                    console.log(`  [${processedCount}/${articlesWithoutTime.length}] 正在获取: ${article.title.substring(0, 40)}...`);
                    
                    let detailPage;
                    try {
                        detailPage = await browser.newPage();
                        // 增加超时时间到30秒，使用domcontentloaded以提高速度
                        await detailPage.goto(article.url, { 
                            waitUntil: 'domcontentloaded', 
                            timeout: 30000 
                        });
                        
                        // 在详情页查找时间 - 增强版选择器
                        const detailTime = await detailPage.evaluate(() => {
                            // 1. 优先查找带datetime属性的元素
                            const datetimeElem = document.querySelector('time[datetime], [data-publish-date], [data-date-published]');
                            if (datetimeElem) {
                                return datetimeElem.getAttribute('datetime') || 
                                       datetimeElem.getAttribute('data-publish-date') || 
                                       datetimeElem.getAttribute('data-date-published');
                            }
                            
                            // 2. 查找特定的时间元素
                            const timeSelectors = [
                                '.publish-date',
                                '.article-date',
                                '.entry-date',
                                '.post-date',
                                '.meta-date',
                                '.article-meta time',
                                '.entry-meta time',
                                '.article-header time',
                                '[class*="publish"][class*="date"]',
                                '[class*="article"][class*="date"]'
                            ];
                            
                            for (const selector of timeSelectors) {
                                const elem = document.querySelector(selector);
                                if (elem && elem.textContent.trim()) {
                                    return elem.textContent.trim();
                                }
                            }
                            
                            // 3. 从文章元信息中查找
                            const metaPatterns = [
                                /(?:Published|Posted|Updated)[\s\S]{0,50}?(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i,
                                /By\s+[^•]+[•·]\s*(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i,
                                /(\d{1,2})\s+(hours?|days?)\s+ago/i
                            ];
                            
                            // 优先在文章头部查找
                            const articleHeader = document.querySelector('.article-header, .entry-header, header, [class*="header"]');
                            if (articleHeader) {
                                const headerText = articleHeader.textContent;
                                for (const pattern of metaPatterns) {
                                    const match = headerText.match(pattern);
                                    if (match) {
                                        return match[0];
                                    }
                                }
                            }
                            
                            // 在全文中查找
                            const bodyText = document.body.textContent;
                            for (const pattern of metaPatterns) {
                                const match = bodyText.match(pattern);
                                if (match) {
                                    return match[0];
                                }
                            }
                            
                            return null;
                        });
                        
                        if (detailTime) {
                            article.publishTime = detailTime;
                            console.log(`  ✅ 获取到时间: ${article.title.substring(0, 50)}...`);
                        } else {
                            console.log(`  ⚠️  未找到时间: ${article.title.substring(0, 50)}...`);
                        }
                        
                    } catch (e) {
                        console.log(`  ❌ 无法访问: ${article.title.substring(0, 40)}... (${e.message})`);
                        // 如果是超时错误，给出提示
                        if (e.message.includes('timeout')) {
                            console.log(`     💡 提示: 页面加载超时，可能是网络问题或网站响应慢`);
                        }
                    } finally {
                        if (detailPage) {
                            await detailPage.close();
                        }
                    }
                    
                    // 避免请求过快，每个请求间隔2-3秒
                    if (processedCount < articlesWithoutTime.length) {
                        const delay = 2000 + Math.random() * 1000; // 2-3秒随机延迟
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                // 更新时间识别率
                const updatedFoundTimeCount = articleList.filter(a => a.publishTime).length;
                console.log(`\n📊 时间识别率提升至: ${updatedFoundTimeCount}/${articleList.length} (${Math.round(updatedFoundTimeCount/articleList.length*100)}%)`);
            }
            
            // 根据选项决定是否过滤时间
            let recentArticles;
            
            if (options.ignoreTime) {
                // 忽略时间，返回所有文章
                recentArticles = articleList;
                console.log(`\n📅 所有文章: ${recentArticles.length} 篇（忽略时间过滤）`);
                
                // 仍然显示时间信息（如果有）
                recentArticles.forEach(article => {
                    if (article.publishTime) {
                        console.log(`  📄 ${article.title.substring(0, 50)}... - ${article.publishTime}`);
                    } else {
                        console.log(`  📄 ${article.title.substring(0, 50)}... - 无时间信息`);
                    }
                });
            } else {
                // 过滤24小时内的文章
                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                
                recentArticles = articleList.filter(article => {
                    if (!article.publishTime) {
                        console.log(`⚠️  文章无发布时间: ${article.title}`);
                        return false;
                    }
                    
                    try {
                        let publishDate;
                        
                        // 处理相对时间格式 (e.g., "2 hours ago", "1 day ago", "Published 2 hours ago")
                        const relativeMatch = article.publishTime.match(/(?:Published|Posted)?\s*(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i);
                        if (relativeMatch) {
                            const amount = parseInt(relativeMatch[1]);
                            const unit = relativeMatch[2].toLowerCase();
                            
                            publishDate = new Date(now);
                            if (unit.includes('min')) {
                                publishDate.setMinutes(publishDate.getMinutes() - amount);
                            } else if (unit.includes('hour')) {
                                publishDate.setHours(publishDate.getHours() - amount);
                            } else if (unit.includes('day')) {
                                publishDate.setDate(publishDate.getDate() - amount);
                            }
                        } else {
                            // 尝试直接解析日期
                            publishDate = new Date(article.publishTime);
                        }
                        
                        const isRecent = publishDate >= oneDayAgo;
                        
                        if (isRecent) {
                            const hoursAgo = Math.floor((now - publishDate) / (1000 * 60 * 60));
                            console.log(`✅ ${hoursAgo}小时前: ${article.title}`);
                        }
                        
                        return isRecent;
                    } catch (e) {
                        console.log(`⚠️  无法解析时间 "${article.publishTime}": ${article.title}`);
                        return false;
                    }
                });
                
                console.log(`\n📅 过去24小时内的文章: ${recentArticles.length} 篇`);
            }
            
            // 检查哪些是新文章
            const urls = recentArticles.map(a => a.url);
            const checkResults = await this.checkUrlsWithServer(urls);
            
            const newArticles = [];
            // 确保checkResults是数组
            if (Array.isArray(checkResults)) {
                checkResults.forEach((result, index) => {
                    if (!result.exists) {
                        newArticles.push(recentArticles[index]);
                    }
                });
            } else {
                // 如果服务器返回格式不正确，假设所有文章都是新的
                console.log('⚠️  服务器响应格式异常，跳过重复检查');
                newArticles.push(...recentArticles);
            }
            
            console.log(`\n🆕 新文章: ${newArticles.length} 篇`);
            
            return {
                total: articleList.length,
                recent: recentArticles.length,
                new: newArticles.length,
                newArticles: newArticles
            };
            
        } finally {
            await browser.close();
        }
    }

    /**
     * 处理发现的新文章
     */
    async processNewArticles(newArticles) {
        if (newArticles.length === 0) {
            console.log('\n✅ 没有新文章需要处理');
            return;
        }
        
        console.log(`\n🚀 开始处理 ${newArticles.length} 篇新文章...`);
        
        // 使用现有的批处理器
        const BatchProcessor = require('./batch_process_articles');
        const processor = new BatchProcessor();
        
        const urls = newArticles.map(article => article.url);
        
        try {
            await processor.processArticles(urls);
            console.log('\n✅ 新文章处理完成！');
        } catch (error) {
            console.error('\n❌ 处理新文章时出错:', error);
        }
    }

    /**
     * 直接处理提供的URL列表（无需每次创建新脚本）
     * @param {Array} urls - URL数组
     * @param {Object} options - 处理选项
     */
    async processProvidedUrls(urls, options = {}) {
        if (!urls || urls.length === 0) {
            console.log('\n❌ 没有提供URL列表');
            return;
        }

        // 过滤掉无效的URL
        const validUrls = urls.filter(url => {
            if (typeof url !== 'string' || !url.trim()) {
                return false;
            }
            // 排除测试URL
            if (url.includes('example.com') || url.startsWith('url')) {
                console.log(`⏭️  跳过测试URL: ${url}`);
                return false;
            }
            return true;
        });

        if (validUrls.length === 0) {
            console.log('\n❌ 没有有效的URL需要处理');
            return;
        }

        console.log(`\n📋 准备处理 ${validUrls.length} 个URL...`);
        
        // 按类型分类显示
        const equipmentUrls = validUrls.filter(url => 
            url.includes('buying-advice') || 
            url.includes('best-') ||
            url.includes('gear') ||
            url.includes('equipment') ||
            url.includes('prime-day') ||
            url.includes('amazon')
        );
        const newsUrls = validUrls.filter(url => url.includes('/news/'));
        const tipsUrls = validUrls.filter(url => url.includes('/tips/'));
        const featuresUrls = validUrls.filter(url => url.includes('/features/'));
        const otherUrls = validUrls.filter(url => 
            !equipmentUrls.includes(url) && 
            !newsUrls.includes(url) && 
            !tipsUrls.includes(url) && 
            !featuresUrls.includes(url)
        );

        if (equipmentUrls.length > 0) console.log(`🛍️ 装备类文章: ${equipmentUrls.length} 篇`);
        if (newsUrls.length > 0) console.log(`📰 新闻文章: ${newsUrls.length} 篇`);
        if (tipsUrls.length > 0) console.log(`💡 技巧文章: ${tipsUrls.length} 篇`);
        if (featuresUrls.length > 0) console.log(`📝 专题文章: ${featuresUrls.length} 篇`);
        if (otherUrls.length > 0) console.log(`🔄 其他文章: ${otherUrls.length} 篇`);
        
        // 使用现有的批处理器
        const BatchProcessor = require('./batch_process_articles');
        const processor = new BatchProcessor();
        
        try {
            await processor.processArticles(validUrls);
            console.log('\n✅ URL列表处理完成！');
            console.log('📱 访问 http://localhost:8080 查看内容');
        } catch (error) {
            console.error('\n❌ 处理URL列表时出错:', error);
        }
    }

    /**
     * 处理失败重试的文章（从failed_articles.json读取）
     */
    async processFailedRetryArticles() {
        console.log('📋 开始处理失败重试的文章...\n');
        
        try {
            const failedFile = path.join(__dirname, 'failed_articles.json');
            if (!fs.existsSync(failedFile)) {
                console.log('❌ 未找到失败文章记录文件');
                return;
            }
            
            const failedData = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
            
            // 筛选需要重试的真实文章
            const retryUrls = [];
            for (const [url, info] of Object.entries(failedData)) {
                if (info.status === 'pending_retry' && 
                    url.includes('golfmonthly.com') && 
                    !url.includes('example.com') && 
                    !url.startsWith('url')) {
                    retryUrls.push(url);
                }
            }
            
            console.log(`📊 发现 ${retryUrls.length} 篇需要重试的文章`);
            
            if (retryUrls.length === 0) {
                console.log('✅ 没有需要重试的文章！');
                return;
            }
            
            // 直接调用统一的处理方法
            await this.processProvidedUrls(retryUrls);
            
        } catch (error) {
            console.error('\n❌ 处理失败重试文章时出错:', error);
        }
    }
}

module.exports = RecentArticleDiscoverer;

// 如果直接运行此文件
if (require.main === module) {
    const discoverer = new RecentArticleDiscoverer();
    const args = process.argv.slice(2);
    
    // 主函数（异步）
    (async () => {
    
    // 检查是否是处理失败重试文章
    if (args.includes('--retry-failed')) {
        console.log('🔄 处理失败重试的文章模式');
        discoverer.processFailedRetryArticles().catch(error => {
            console.error('处理失败重试文章时出错:', error);
        });
        return;
    }
    
    // 检查是否是直接处理URL列表
    const urlsFlag = args.findIndex(arg => arg === '--urls');
    if (urlsFlag !== -1) {
        console.log('📋 直接处理URL列表模式');
        const urls = args.slice(urlsFlag + 1).filter(url => !url.startsWith('--'));
        if (urls.length === 0) {
            console.log('❌ 没有提供URL列表');
            console.log('💡 用法: node discover_recent_articles.js --urls <url1> <url2> <url3>...');
            return;
        }
        
        console.log(`📊 接收到 ${urls.length} 个URL:`);
        urls.forEach((url, index) => {
            console.log(`${index + 1}. ${url.substring(url.lastIndexOf('/') + 1)}`);
        });
        
        discoverer.processProvidedUrls(urls).catch(error => {
            console.error('处理URL列表时出错:', error);
        });
        return;
    }
    
    // 原有的发现新文章模式
    const fetchDetailTime = args.includes('--fetch-detail-time');
    const showDebug = args.includes('--show-debug');
    const ignoreTime = args.includes('--ignore-time');
    const urlsOnly = args.includes('--urls-only');
    const autoProcess = args.includes('--auto-process');
    
    // 过滤掉选项参数，获取URL
    const urlArg = args.find(arg => !arg.startsWith('--'));
    const homepageUrl = urlArg || 'https://www.golfmonthly.com/';
    
    // 如果是--all-sites参数，处理所有配置的网站
    if (args.includes('--all-sites')) {
        const websiteConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, 'website_configs.json'), 'utf8'));
        console.log('🌐 扫描所有配置的网站...\n');
        
        const allNewArticles = [];
        
        for (const [domain, config] of Object.entries(websiteConfigs)) {
            console.log(`\n📍 正在扫描 ${config.name} (${domain})...`);
            const siteUrl = config.homepage || `https://www.${domain}/`;
            
            try {
                const result = await discoverer.discoverRecentArticles(siteUrl, { fetchDetailTime, showDebug, ignoreTime });
                console.log(`✅ ${config.name}: 发现 ${result.new} 篇新文章`);
                allNewArticles.push(...result.newArticles);
            } catch (error) {
                console.error(`❌ ${config.name} 扫描失败:`, error.message);
            }
        }
        
        console.log(`\n📊 总计发现 ${allNewArticles.length} 篇新文章`);
        
        if (allNewArticles.length > 0) {
            console.log('\n🆕 所有新文章列表:');
            allNewArticles.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
                console.log(`   ${article.url}`);
            });
            
            if (autoProcess) {
                console.log('\n🚀 自动处理模式：直接开始处理文章...');
                await discoverer.processNewArticles(allNewArticles);
                await discoverer.close();
            } else {
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                rl.question('\n是否处理这些新文章？(y/n): ', async (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        await discoverer.processNewArticles(allNewArticles);
                    } else {
                        console.log('已取消处理');
                    }
                    rl.close();
                    await discoverer.close();
                });
            }
        } else {
            await discoverer.close();
        }
        
        return;
    }
    
    // 如果是--urls-only模式，不输出调试信息
    if (!urlsOnly) {
        console.log('🔍 发现新文章模式');
        if (fetchDetailTime) {
            console.log('💡 已启用从详情页获取时间（可能需要更长时间）');
        }
        if (ignoreTime) {
            console.log('⚡ 已启用忽略时间模式（获取所有文章）');
        }
    }
    
    discoverer.discoverRecentArticles(homepageUrl, { fetchDetailTime, showDebug, ignoreTime }).then(async result => {
        if (urlsOnly) {
            // --urls-only模式：只输出URL，每行一个
            if (ignoreTime) {
                // 忽略时间模式：输出所有发现的文章URL
                result.newArticles.forEach(article => {
                    console.log(article.url);
                });
            } else {
                // 正常模式：只输出新文章URL
                result.newArticles.forEach(article => {
                    console.log(article.url);
                });
            }
            return; // 直接返回，不进行交互
        }
        
        // 原有的交互式输出
        console.log('\n📊 扫描结果汇总:');
        console.log(`  - 总文章数: ${result.total}`);
        if (ignoreTime) {
            console.log(`  - 待检查文章: ${result.recent}`);
        } else {
            console.log(`  - 24小时内: ${result.recent}`);
        }
        console.log(`  - 新文章数: ${result.new}`);
        
        if (result.newArticles.length > 0) {
            console.log('\n🆕 新文章列表:');
            result.newArticles.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
                console.log(`   ${article.url}`);
            });
            
            if (autoProcess) {
                console.log('\n🚀 自动处理模式：直接开始处理文章...');
                await discoverer.processNewArticles(result.newArticles);
            } else {
                // 询问是否处理
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                rl.question('\n是否处理这些新文章？(y/n): ', async (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        await discoverer.processNewArticles(result.newArticles);
                    } else {
                        console.log('已取消处理');
                    }
                    rl.close();
                });
            }
        }
    }).catch(error => {
        console.error('发现文章时出错:', error);
        
        // 在--urls-only模式下，如果失败则输出备用URL
        if (urlsOnly) {
            console.error('⚠️ 使用备用URL...');
            const backupUrls = {
                'golfmonthly.com': [
                    'https://www.golfmonthly.com/news/gareth-bale-shares-thoughts-on-jon-rahm-playing-less-golf',
                    'https://www.golfmonthly.com/news/tiger-woods-sun-day-red-trademark-dispute'
                ],
                'todays-golfer.com': [
                    'https://www.todays-golfer.com/news-and-events/golf-news/2024/january/best-golf-courses-in-the-world/'
                ],
                // 可根据需要添加更多网站的备用URL
            };
            
            // 从URL中提取域名
            const domain = homepageUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
            const backupUrlsForSite = backupUrls[domain] || [];
            
            if (backupUrlsForSite.length > 0) {
                backupUrlsForSite.forEach(url => console.log(url));
            } else {
                // 如果没有备用URL，至少输出一个主页URL
                console.log(homepageUrl);
            }
        }
    });
    
    })(); // 结束异步主函数
}