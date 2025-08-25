#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * Today's Golfer 专用文章抓取器
 * 使用Playwright绕过可能的反爬虫机制
 */
class TodaysGolferDiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 100;
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
    }

    async checkRSSFeed() {
        try {
            const Parser = require('rss-parser');
            const parser = new Parser();
            const feed = await parser.parseURL('https://www.todays-golfer.com/feed/');
            
            const urls = feed.items.map(item => item.link).filter(url => url);
            console.log(`📰 从RSS获取到 ${urls.length} 个URL`);
            return urls;
        } catch (error) {
            console.log('⚠️ RSS获取失败，使用页面抓取:', error.message);
            return [];
        }
    }

    async discover() {
        console.log("🏌️ Today's Golfer 文章发现器 (优化版)");
        console.log("=".repeat(60));
        
        // 首先尝试RSS
        const rssUrls = await this.checkRSSFeed();
        if (rssUrls.length >= 20) {
            console.log('✅ 使用RSS获取的URL');
            if (this.urlsOnly) {
                rssUrls.slice(0, this.maxArticles).forEach(url => console.log(url));
            }
            const outputFile = path.join(__dirname, 'deep_urls_todays_golfer_com.txt');
            await fs.writeFile(outputFile, rssUrls.slice(0, this.maxArticles).join('\n') + '\n');
            console.log(`✅ URL列表已保存到: ${outputFile}`);
            return rssUrls.slice(0, this.maxArticles);
        }
        
        let browser;
        const maxRetries = 3;
        let retryCount = 0;
        
        // 备用URL机制 - 最新的真实文章URL（包含最新的LIV Golf文章）
        const fallbackUrls = [
            'https://www.todays-golfer.com/news-and-events/tour-news/6-players-relegated-from-liv-golf-league-2025/',
            'https://www.todays-golfer.com/news-and-events/tour-news/liv-golf-indy-prize-money-2025/',
            'https://www.todays-golfer.com/news-and-events/tour-news/gary-player-calls-jordan-spieth-a-tragedy/',
            'https://www.todays-golfer.com/equipment/golf-clubs/wedges/taylormade-mg5-wedge-review/',
            'https://www.todays-golfer.com/news-and-events/equipment-news/scottie-scheffler-training-aid/'
        ];
        
        while (retryCount < maxRetries) {
            try {
                browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--disable-blink-features=AutomationControlled',
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process'
                    ],
                    timeout: 60000 // 60秒超时
                });

                const context = await browser.newContext({
                    viewport: { width: 1920, height: 1080 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    ignoreHTTPSErrors: true
                });

                const page = await context.newPage();
                
                // 设置更长的超时时间
                page.setDefaultTimeout(45000);
                
                // 尝试多个页面以获取更多URL
                const urlsToTry = [
                    'https://www.todays-golfer.com/',
                    'https://www.todays-golfer.com/news-and-events/',
                    'https://www.todays-golfer.com/equipment/',
                    'https://www.todays-golfer.com/tips-and-tuition/'
                ];

                let allArticles = [];
            
                for (const url of urlsToTry) {
                    console.log(`\n🔍 尝试页面: ${url}`);
                    try {
                        const response = await page.goto(url, { 
                            waitUntil: 'domcontentloaded',  // 恢复为domcontentloaded避免超时
                            timeout: 45000  // 恢复原超时时间
                        });
                        
                        // 检查响应状态
                        if (!response || response.status() >= 400) {
                            console.log(`⚠️ 页面响应异常: ${response?.status()}`);
                            continue;
                        }
                        
                        // 等待内容加载 - 减少等待时间
                        await page.waitForTimeout(2000);

                        // 优化滚动策略 - 减少滚动次数和等待时间
                        for (let i = 0; i < 3; i++) {  // 减少到3次
                            await page.evaluate(() => {
                                window.scrollBy(0, window.innerHeight);
                                // 触发懒加载
                                const lazyImages = document.querySelectorAll('img[loading="lazy"]');
                                lazyImages.forEach(img => {
                                    if (img.getBoundingClientRect().top < window.innerHeight * 2) {
                                        img.loading = 'eager';
                                    }
                                });
                            });
                            await page.waitForTimeout(500);  // 减少到500ms
                        }

                    // 尝试多种选择器
                    const articles = await page.evaluate(() => {
                        const articleData = [];
                        
                        // 选择器组合 - 增加更多选择器
                        const selectors = [
                            'article a[href*="/news/"]',
                            'article a[href*="/features/"]',
                            'article a[href*="/equipment/"]',
                            'article a[href*="/instruction/"]',
                            '.article-item a',
                            '.post-item a',
                            '.news-item a',
                            '.content-item a',
                            '[class*="article"] a[href]',
                            '[class*="post"] a[href]',
                            '[class*="news"] a[href]',
                            'a[href*="todays-golfer.com/"][href*="/20"]', // 包含年份的链接
                            // 新增选择器
                            '.card a[href]',
                            '.entry-title a',
                            '.post-title a',
                            'h2 a[href]',
                            'h3 a[href]',
                            '.item-content a',
                            '.media-body a',
                            '.listing-item a',
                            'main a[href*="todays-golfer.com/"]'
                        ];

                        const foundUrls = new Set();
                        
                        selectors.forEach(selector => {
                            const elements = document.querySelectorAll(selector);
                            elements.forEach(elem => {
                                const href = elem.href;
                                // 获取URL的最后部分（去除末尾斜杠）
                                const urlPath = href.replace(/\/$/, '');
                                const lastPart = urlPath.split('/').pop();
                                
                                // 更严格的文章URL过滤
                                const isValidArticleUrl = 
                                    href && 
                                    href.includes('todays-golfer.com') && 
                                    !href.includes('#') &&
                                    !href.includes('?') && // 排除带参数的URL
                                    !href.includes('category') &&
                                    !href.includes('tag') &&
                                    !href.includes('author') &&
                                    !href.includes('page/') &&
                                    !href.includes('/about') &&
                                    !href.includes('/contact') &&
                                    !href.includes('/subscribe') &&
                                    !href.includes('/privacy') &&
                                    !href.includes('/terms') &&
                                    !href.includes('greatmagazines.co.uk') &&
                                    !href.includes('/best/') &&
                                    !href.includes('/win/') &&
                                    !href.includes('/competitions/') &&
                                    // 确保不是分类页面根路径
                                    !href.match(/\/(tips-and-tuition|news-and-events|equipment|courses|features|best|news|instruction|golf-courses)\/?$/) &&
                                    // 路径深度检查
                                    href.split('/').length >= 5 &&
                                    // slug验证 - 必须有连字符且长度合理
                                    lastPart && 
                                    lastPart.includes('-') &&
                                    lastPart.length > 15 && // 提高最小长度要求
                                    lastPart.length < 150 && // 避免过长的URL
                                    // 至少包含2个连字符（更像文章slug）
                                    (lastPart.match(/-/g) || []).length >= 2;
                                
                                if (isValidArticleUrl) {
                                    
                                    foundUrls.add(href);
                                    
                                    const title = elem.textContent?.trim() || 
                                                elem.getAttribute('title') || 
                                                elem.parentElement?.querySelector('h2, h3, h4')?.textContent?.trim() ||
                                                'Today\'s Golfer Article';
                                    
                                    articleData.push({
                                        url: href,
                                        title: title
                                    });
                                }
                            });
                        });

                        // 如果上面的方法没找到，尝试更宽泛的搜索
                        if (articleData.length === 0) {
                            console.log('第一轮未找到文章，尝试更宽泛的搜索...');
                            const allLinks = document.querySelectorAll('a[href]');
                            allLinks.forEach(link => {
                                const href = link.href;
                                const urlPath = href.replace(/\/$/, '');
                                const lastPart = urlPath.split('/').pop();
                                
                                // 使用相同的验证逻辑
                                const isValidFallbackUrl = 
                                    href && 
                                    href.includes('todays-golfer.com') && 
                                    !foundUrls.has(href) &&
                                    !href.includes('#') &&
                                    !href.includes('?') &&
                                    !href.includes('greatmagazines.co.uk') &&
                                    !href.includes('/best/') &&
                                    !href.includes('/win/') &&
                                    !href.includes('/competitions/') &&
                                    !href.match(/\/(tips-and-tuition|news-and-events|equipment|courses|features|best|news|instruction|golf-courses)\/?$/) &&
                                    href.split('/').length >= 5 &&
                                    lastPart && 
                                    lastPart.includes('-') &&
                                    lastPart.length > 15 &&
                                    (lastPart.match(/-/g) || []).length >= 2;
                                
                                if (isValidFallbackUrl) {
                                    
                                    foundUrls.add(href);
                                    articleData.push({
                                        url: href,
                                        title: link.textContent?.trim() || 'Today\'s Golfer Article'
                                    });
                                }
                            });
                        }

                        return articleData;
                    });

                        console.log(`✅ 从 ${url} 找到 ${articles.length} 篇文章`);
                        
                        // 显示一些示例URL用于调试
                        if (articles.length > 0 && this.debug) {
                            console.log('  示例URL:');
                            articles.slice(0, 3).forEach(a => console.log(`    - ${a.url}`));
                        }
                        
                        allArticles = allArticles.concat(articles);
                        
                    } catch (e) {
                        console.log(`❌ 无法访问 ${url}: ${e.message}`);
                    }
                }
                
                // 如果成功找到文章，处理并返回
                if (allArticles.length > 0) {
                    console.log(`\n✅ 第 ${retryCount + 1} 次尝试成功，找到 ${allArticles.length} 篇文章`);

                    // 去重
                    console.log(`\n📊 去重前总共收集到 ${allArticles.length} 篇文章`);
                    const uniqueUrls = new Map();
                    allArticles.forEach(article => {
                        if (!uniqueUrls.has(article.url)) {
                            uniqueUrls.set(article.url, article);
                        }
                    });

                    let finalArticles = Array.from(uniqueUrls.values());
                    
                    // 如果找到的文章太少，添加备用URL
                    if (finalArticles.length < 10) {
                        console.log(`\n⚠️ 只找到 ${finalArticles.length} 篇文章，添加备用URL...`);
                        fallbackUrls.forEach(url => {
                            if (!uniqueUrls.has(url)) {
                                finalArticles.push({
                                    url: url,
                                    title: 'Today\'s Golfer Article (Fallback)'
                                });
                            }
                        });
                    }
                    
                    finalArticles = finalArticles.slice(0, this.maxArticles);
                    console.log(`📊 去重后剩余 ${uniqueUrls.size} 篇独特文章`);
                    console.log(`📊 最终返回 ${finalArticles.length} 篇文章（限制: ${this.maxArticles}）`);

                    if (this.urlsOnly) {
                        // 只输出URL列表
                        const urlList = finalArticles.map(a => a.url).join('\n');
                        console.log(urlList);
                        
                        // 保存到文件
                        const urlFile = 'deep_urls_todays_golfer_com.txt';
                        await fs.writeFile(urlFile, urlList + '\n');
                        console.log(`\n✅ URL列表已保存到: ${urlFile}`);
                    } else {
                        // 显示文章列表
                        finalArticles.forEach((article, i) => {
                            console.log(`\n${i + 1}. ${article.title}`);
                            console.log(`   URL: ${article.url}`);
                        });
                    }

                    return finalArticles;
                }

            } catch (error) {
                console.error(`❌ 第 ${retryCount + 1} 次尝试失败:`, error.message);
                retryCount++;
                
                // 如果不是最后一次重试，等待后继续
                if (retryCount < maxRetries) {
                    console.log(`⏳ 等待 ${retryCount * 2} 秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
                }
            } finally {
                if (browser) {
                    await browser.close();
                    browser = null;
                }
            }
        }
        
        // 如果所有重试都失败，返回备用URL
        console.log('\n❌ 所有尝试都失败，使用备用URL...');
        const fallbackArticles = fallbackUrls.map(url => ({
            url: url,
            title: 'Today\'s Golfer Article (Fallback)'
        }));
        
        if (this.urlsOnly) {
            const urlList = fallbackArticles.map(a => a.url).join('\n');
            console.log(urlList);
            
            const urlFile = 'deep_urls_todays_golfer_com.txt';
            await fs.writeFile(urlFile, urlList + '\n');
            console.log(`\n✅ 备用URL列表已保存到: ${urlFile}`);
        }
        
        return fallbackArticles;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const maxArticles = parseInt(args[0]) || 100;
    const urlsOnly = args.includes('--urls-only');
    const debug = args.includes('--debug');

    console.log(`📊 参数: 最大文章数=${maxArticles}, 仅URL=${urlsOnly}`);

    const discoverer = new TodaysGolferDiscoverer({
        maxArticles,
        urlsOnly,
        debug
    });

    await discoverer.discover();
}

// 执行
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TodaysGolferDiscoverer;