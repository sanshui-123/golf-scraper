#!/usr/bin/env node

/**
 * CBS Sports Golf内容发现脚本
 * 
 * 功能特性：
 * - 专门抓取CBS Sports的高尔夫内容
 * - 过滤其他运动内容（NFL、NBA、MLB等）
 * - 过滤导航页面、视频专区、直播、排名页面
 * - 支持多页面扫描（主页、PGA、LPGA等）
 * - 智能去重和文章过滤
 * 
 * 使用方法：
 * node discover_cbssports_golf_articles.js 50 --urls-only
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// 命令行参数
const args = process.argv.slice(2);
const urlLimit = parseInt(args[0]) || 50;
const urlsOnly = args.includes('--urls-only');

// 输出文件
const OUTPUT_FILE = 'deep_urls_cbssports_golf.txt';
const DETAILS_FILE = 'cbssports_golf_details.json';

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 格式化日期
function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    return date.toLocaleDateString('zh-CN', options);
}

// 清理标题
function cleanTitle(title) {
    return title
        .replace(/\s+/g, ' ')
        .replace(/[\n\r\t]/g, '')
        .trim();
}

// 检查是否为高尔夫相关内容
function isGolfContent(url, title = '') {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // 必须包含golf路径或golf关键词
    const hasGolf = urlLower.includes('/golf/') || 
                   urlLower.includes('golf-') ||
                   titleLower.includes('golf') ||
                   titleLower.includes('pga') ||
                   titleLower.includes('lpga') ||
                   titleLower.includes('masters') ||
                   titleLower.includes('open championship') ||
                   titleLower.includes('ryder cup') ||
                   titleLower.includes('fedex') ||
                   titleLower.includes('liv golf') ||
                   titleLower.includes('tiger woods') ||
                   titleLower.includes('rory mcilroy');
    
    // 排除其他运动关键词
    const otherSports = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 
                        'basketball', 'baseball', 'hockey', 'tennis', 
                        'boxing', 'mma', 'ufc', 'nascar', 'formula',
                        'cricket', 'rugby', 'olympics', 'college-football',
                        'college-basketball', 'ncaa'];
    
    const hasOtherSports = otherSports.some(sport => 
        urlLower.includes(`/${sport}/`) || 
        urlLower.includes(`/${sport}-`) ||
        (titleLower.includes(sport) && !titleLower.includes('golf'))
    );
    
    // 排除特定类型的内容
    const excludedTypes = ['/video/', '/videos/', '/watch/', '/live/', 
                          '/schedule', '/schedules/', '/rankings/', '/leaderboard/',
                          '/players/', '/player/', '/standings/', '/teams/',
                          '/odds/', '/betting/', '/fantasy/', '/game/',
                          '/scoreboard/', '/scores/', '/picks/', '/expert-picks/'];
    
    const isExcluded = excludedTypes.some(type => urlLower.includes(type));
    
    // 必须是文章URL - CBS Sports使用的URL模式
    const isArticle = urlLower.includes('/golf/news/') || 
                     urlLower.includes('/golf/') && 
                     (urlLower.endsWith('.html') || urlLower.match(/\d{4}\/\d{2}\/\d{2}\//));
    
    return hasGolf && !hasOtherSports && !isExcluded && isArticle;
}

// 扫描页面获取文章
async function scanPage(page, url, pageName) {
    console.log(`\n📄 扫描${pageName}: ${url}`);
    
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // 等待内容加载
        await delay(3000);
        
        // 获取所有链接
        const articles = await page.evaluate(() => {
            const links = [];
            
            // CBS Sports的多种选择器策略
            const selectors = [
                'a[href*="/golf/news/"]',
                'article a[href*="/golf/"]',
                '.Article-container a[href]',
                '.list-item-content a[href]',
                '.article-list-item a[href]',
                '.content-list-item a[href]',
                '.media-item a[href]',
                '.news-item a[href]',
                '.story-link',
                'h2 a[href*="/golf/"]',
                'h3 a[href*="/golf/"]',
                'h4 a[href*="/golf/"]',
                '.headline a[href]',
                '.title a[href]'
            ];
            
            const seenUrls = new Set();
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(a => {
                    const href = a.href;
                    const text = a.textContent || '';
                    
                    if (href && 
                        href.startsWith('https://www.cbssports.com') && 
                        !seenUrls.has(href) &&
                        text.length > 10) {
                        
                        seenUrls.add(href);
                        
                        // 获取发布时间（如果有）
                        let time = '';
                        const parent = a.closest('article') || a.closest('.list-item') || a.parentElement;
                        if (parent) {
                            const timeEl = parent.querySelector('time, .timestamp, .date, .article-date');
                            if (timeEl) {
                                time = timeEl.getAttribute('datetime') || 
                                      timeEl.textContent || '';
                            }
                        }
                        
                        links.push({
                            url: href,
                            title: text.trim(),
                            time: time
                        });
                    }
                });
            });
            
            return links;
        });
        
        // 过滤高尔夫内容
        const golfArticles = articles.filter(article => 
            isGolfContent(article.url, article.title)
        );
        
        console.log(`  找到 ${articles.length} 篇文章，过滤后保留 ${golfArticles.length} 篇`);
        
        
        return golfArticles;
        
    } catch (error) {
        console.error(`扫描页面失败: ${error.message}`);
        return [];
    }
}

// 主函数
async function discoverCBSSportsGolfArticles() {
    console.log('🏌️ CBS Sports Golf 内容发现');
    console.log('═'.repeat(60));
    console.log(`📌 目标: 抓取 ${urlLimit} 篇高尔夫文章（过滤其他运动）\n`);
    
    const browser = await chromium.launch({
        headless: true
    });
    
    try {
        const page = await browser.newPage();
        
        // 设置超时时间
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(30000);
        
        // 要扫描的页面
        const pagesToScan = [
            { url: 'https://www.cbssports.com/golf/', name: 'Golf主页' },
            { url: 'https://www.cbssports.com/golf/news/', name: 'Golf新闻' },
            { url: 'https://www.cbssports.com/golf/pga-tour/', name: 'PGA Tour' },
            { url: 'https://www.cbssports.com/golf/lpga/', name: 'LPGA' },
            { url: 'https://www.cbssports.com/golf/european-tour/', name: '欧巡赛' },
            { url: 'https://www.cbssports.com/golf/masters-tournament/', name: '大师赛' },
            { url: 'https://www.cbssports.com/golf/us-open/', name: '美国公开赛' },
            { url: 'https://www.cbssports.com/golf/british-open/', name: '英国公开赛' }
        ];
        
        const allArticles = [];
        const seenUrls = new Set();
        
        // 扫描各个页面
        for (const pageInfo of pagesToScan) {
            if (allArticles.length >= urlLimit) {
                console.log('\n✅ 已收集到目标数量的文章');
                break;
            }
            
            const articles = await scanPage(page, pageInfo.url, pageInfo.name);
            
            // 去重并添加
            articles.forEach(article => {
                if (!seenUrls.has(article.url) && allArticles.length < urlLimit) {
                    seenUrls.add(article.url);
                    allArticles.push({
                        ...article,
                        source: pageInfo.name,
                        discoveredAt: new Date().toISOString()
                    });
                }
            });
            
            // 避免请求过快
            if (allArticles.length < urlLimit) {
                await delay(2000);
            }
        }
        
        // 按时间排序（最新的在前）
        allArticles.sort((a, b) => {
            if (a.time && b.time) {
                return new Date(b.time) - new Date(a.time);
            }
            return 0;
        });
        
        // 输出结果
        console.log(`\n📊 扫描结果:`);
        console.log(`  - 总共找到: ${allArticles.length} 篇高尔夫文章`);
        
        if (!urlsOnly && allArticles.length > 0) {
            console.log(`\n最新文章列表:`);
            allArticles.slice(0, 10).forEach((article, index) => {
                console.log(`${index + 1}. [${article.source}] ${cleanTitle(article.title)}`);
                console.log(`   URL: ${article.url}`);
            });
            
            if (allArticles.length > 10) {
                console.log(`\n... 还有 ${allArticles.length - 10} 篇文章`);
            }
        }
        
        // 保存URL到文件
        const urls = allArticles.map(a => a.url);
        await fs.writeFile(OUTPUT_FILE, urls.join('\n') + '\n');
        console.log(`\n💾 已保存 ${urls.length} 个URL到 ${OUTPUT_FILE}`);
        
        // 保存详细信息
        await fs.writeFile(DETAILS_FILE, JSON.stringify({
            generatedAt: new Date().toISOString(),
            generatedDate: formatDate(new Date()),
            totalArticles: allArticles.length,
            articles: allArticles
        }, null, 2));
        console.log(`💾 详细信息已保存到 ${DETAILS_FILE}`);
        
        // 如果是 --urls-only 模式，输出URL列表
        if (urlsOnly) {
            urls.forEach(url => console.log(url));
        }
        
        return urls;
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        
        // 创建空文件避免主程序出错
        try {
            await fs.access(OUTPUT_FILE);
        } catch {
            await fs.writeFile(OUTPUT_FILE, '');
            console.log('📝 已创建空的URL文件');
        }
        
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// 执行主函数
(async () => {
    try {
        await discoverCBSSportsGolfArticles();
        console.log('\n✅ 完成！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 发生错误:', error);
        process.exit(1);
    }
})();