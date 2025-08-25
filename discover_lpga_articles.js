#!/usr/bin/env node

/**
 * LPGA 内容发现脚本
 * 抓取最新高尔夫文章，支持JavaScript渲染页面
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class LPGADiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 50;
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
        this.outputFile = 'deep_urls_lpga_com.txt';
    }

    async discover() {
        console.log('⛳ LPGA 文章发现器');
        console.log('═'.repeat(60));
        console.log(`目标: 获取最多 ${this.maxArticles} 篇文章\n`);
        
        let browser;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                ]
            });

            const context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            });

            const page = await context.newPage();
            page.setDefaultTimeout(60000);
            
            const allArticles = new Map();
            const today = new Date();
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            
            // 定义要抓取的多个页面
            const pagesToScrape = [
                { url: 'https://www.lpga.com/', name: '主页' },
                { url: 'https://www.lpga.com/news', name: '新闻' },
                { url: 'https://www.lpga.com/tournaments', name: '巡回赛' },
                { url: 'https://www.lpga.com/stories', name: '故事' },
                { url: 'https://www.lpga.com/features', name: '专题' }
            ];
            
            // 遍历所有页面
            for (const pageInfo of pagesToScrape) {
                if (allArticles.size >= this.maxArticles) {
                    console.log(`\n✅ 已达到目标数量 ${this.maxArticles} 篇文章，停止抓取`);
                    break;
                }
                
                console.log(`\n📄 访问 ${pageInfo.name}: ${pageInfo.url}`);
                try {
                    await page.goto(pageInfo.url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    });
                    
                    // 等待内容加载
                    await page.waitForTimeout(3000);
                    
                    // 滚动页面加载更多内容
                    console.log('📜 滚动页面加载更多文章...');
                    const scrollTimes = pageInfo.name === '主页' ? 10 : 8;
                    for (let i = 0; i < scrollTimes; i++) {
                        const previousHeight = await page.evaluate(() => document.body.scrollHeight);
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await page.waitForTimeout(2000);
                        
                        // 检查是否有新内容加载
                        const newHeight = await page.evaluate(() => document.body.scrollHeight);
                        if (newHeight === previousHeight) {
                            console.log('   已到达页面底部');
                            break;
                        }
                    }
                    
                    // 提取文章链接
                    const articles = await page.evaluate(() => {
                        const articleData = [];
                        const seenUrls = new Set();
                        
                        // LPGA特定的选择器策略
                        const linkSelectors = [
                            'a[href*="/news/"]',
                            'a[href*="/article/"]',
                            'a[href*="/tournaments/"]',
                            'a[href*="/stories/"]',
                            'a[href*="/features/"]',
                            '.news-item a',
                            '.article-card a',
                            '.story-card a',
                            '[class*="article"] a',
                            '[class*="news"] a',
                            '[class*="story"] a'
                        ];
                        
                        linkSelectors.forEach(selector => {
                            const links = document.querySelectorAll(selector);
                            links.forEach(link => {
                                const href = link.href;
                                const text = link.textContent?.trim() || '';
                                const title = link.getAttribute('title') || text;
                                
                                // 基本过滤条件
                                if (!href || 
                                    seenUrls.has(href) || 
                                    !href.includes('lpga.com') ||
                                    href === 'https://www.lpga.com/' ||
                                    href.includes('#') ||
                                    href.includes('/video/') ||
                                    href.includes('/photos/') ||
                                    href.includes('/gallery/') ||
                                    href.includes('/leaderboard') ||
                                    href.includes('/statistics') ||
                                    href.includes('/players/') ||
                                    href.includes('/schedule') ||
                                    href.includes('/results') ||
                                    href.includes('/rankings') ||
                                    href.includes('/fantasy') ||
                                    href.includes('/tickets') ||
                                    href.includes('/shop') ||
                                    title.length < 10) {
                                    return;
                                }
                                
                                // 查找时间信息
                                let dateText = null;
                                const parent = link.closest('article, .news-item, .article-card, [class*="article"], [class*="news"]');
                                if (parent) {
                                    const timeElements = parent.querySelectorAll('time, .date, .publish-date, [class*="date"], [datetime]');
                                    for (const elem of timeElements) {
                                        const datetime = elem.getAttribute('datetime');
                                        const text = elem.textContent?.trim();
                                        if (datetime || text) {
                                            dateText = datetime || text;
                                            break;
                                        }
                                    }
                                }
                                
                                seenUrls.add(href);
                                articleData.push({
                                    url: href,
                                    title: title,
                                    dateText: dateText,
                                    source: selector
                                });
                            });
                        });
                        
                        return articleData;
                    });
                    
                    console.log(`   找到 ${articles.length} 个链接`);
                    
                    // 处理并过滤文章
                    let newArticlesCount = 0;
                    for (const article of articles) {
                        if (allArticles.has(article.url)) continue;
                        
                        // 解析日期（如果有）
                        let articleDate = null;
                        if (article.dateText) {
                            articleDate = this.parseDate(article.dateText);
                            
                            // 如果有日期，只保留24小时内的文章
                            if (articleDate && articleDate < yesterday) {
                                if (this.debug) {
                                    console.log(`   ⏭️  跳过旧文章: ${article.title} (${article.dateText})`);
                                }
                                continue;
                            }
                        }
                        
                        // 确保是文章页面（URL模式检查）
                        if (!this.isValidArticleUrl(article.url)) {
                            if (this.debug) {
                                console.log(`   ⏭️  跳过非文章URL: ${article.url}`);
                            }
                            continue;
                        }
                        
                        allArticles.set(article.url, {
                            ...article,
                            date: articleDate,
                            page: pageInfo.name
                        });
                        newArticlesCount++;
                    }
                    
                    console.log(`   ✅ 从${pageInfo.name}新增 ${newArticlesCount} 篇文章`);
                    
                } catch (error) {
                    console.error(`   ❌ 抓取${pageInfo.name}失败:`, error.message);
                }
            }
            
            // 按日期排序（有日期的优先，然后按抓取顺序）
            const sortedArticles = Array.from(allArticles.values()).sort((a, b) => {
                if (a.date && b.date) {
                    return b.date - a.date;
                }
                if (a.date && !b.date) return -1;
                if (!a.date && b.date) return 1;
                return 0;
            });
            
            // 限制数量
            const finalArticles = sortedArticles.slice(0, this.maxArticles);
            
            console.log(`\n📊 抓取完成！`);
            console.log(`   总计发现: ${allArticles.size} 篇文章`);
            console.log(`   最终保留: ${finalArticles.length} 篇文章`);
            
            // 输出URL
            if (this.urlsOnly) {
                console.log('\n🔗 生成URL文件...');
                const urls = finalArticles.map(a => a.url);
                await this.saveUrls(urls);
                
                // 输出URL到stdout（兼容性）
                urls.forEach(url => console.log(url));
            } else {
                // 显示文章列表
                console.log('\n📋 文章列表:');
                finalArticles.forEach((article, index) => {
                    const dateStr = article.date ? 
                        ` (${article.date.toLocaleDateString()})` : '';
                    console.log(`${index + 1}. ${article.title}${dateStr}`);
                    console.log(`   ${article.url}`);
                    console.log(`   来源: ${article.page}`);
                    console.log();
                });
            }
            
            return finalArticles;
            
        } catch (error) {
            console.error('❌ 抓取过程出错:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    // 解析日期
    parseDate(dateText) {
        if (!dateText) return null;
        
        try {
            // 尝试多种日期格式
            const date = new Date(dateText);
            if (!isNaN(date.getTime())) {
                return date;
            }
            
            // 处理相对时间（如 "2 hours ago"）
            const relativeMatch = dateText.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/i);
            if (relativeMatch) {
                const amount = parseInt(relativeMatch[1]);
                const unit = relativeMatch[2].toLowerCase();
                const now = new Date();
                
                switch (unit) {
                    case 'hour':
                        return new Date(now.getTime() - amount * 60 * 60 * 1000);
                    case 'day':
                        return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
                    case 'week':
                        return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
                    case 'month':
                        return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
                }
            }
            
            // 处理 "Today", "Yesterday"
            if (dateText.toLowerCase().includes('today')) {
                return new Date();
            }
            if (dateText.toLowerCase().includes('yesterday')) {
                return new Date(Date.now() - 24 * 60 * 60 * 1000);
            }
            
        } catch (e) {
            // 忽略解析错误
        }
        
        return null;
    }
    
    // 验证是否为有效的文章URL
    isValidArticleUrl(url) {
        // 排除锦标赛概览页面
        if (url.includes('/tournaments/') && url.includes('/overview')) {
            return false;
        }
        
        // 必须包含文章路径标识
        const validPaths = [
            '/news/',
            '/article/',
            '/tournaments/',  // 保留锦标赛相关新闻，但上面已排除overview页面
            '/stories/',
            '/features/',
            '/blog/'
        ];
        
        // 检查是否包含有效路径
        const hasValidPath = validPaths.some(path => url.includes(path));
        
        // 确保URL有足够的深度（不是分类页）
        const urlParts = url.replace('https://www.lpga.com/', '').split('/').filter(p => p);
        const hasDepth = urlParts.length >= 2;
        
        return hasValidPath && hasDepth;
    }
    
    // 保存URL到文件
    async saveUrls(urls) {
        try {
            const content = urls.join('\n') + '\n';
            await fs.writeFile(this.outputFile, content, 'utf8');
            console.log(`✅ URL已保存到: ${this.outputFile}`);
            console.log(`   共 ${urls.length} 个URL`);
        } catch (error) {
            console.error('❌ 保存URL文件失败:', error);
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const maxArticles = parseInt(args[0]) || 50;
    const urlsOnly = args.includes('--urls-only');
    const debug = args.includes('--debug');
    
    const discoverer = new LPGADiscoverer({
        maxArticles,
        urlsOnly,
        debug
    });
    
    try {
        await discoverer.discover();
        process.exit(0);
    } catch (error) {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = LPGADiscoverer;