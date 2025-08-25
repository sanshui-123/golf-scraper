#!/usr/bin/env node

/**
 * Yahoo Sports Golf内容发现脚本
 * 
 * 功能特性：
 * - 专门抓取Yahoo Sports的高尔夫内容
 * - 过滤其他运动内容（NBA、NFL、MLB等）
 * - 过滤外部链接和广告内容
 * - 支持多页面扫描（主页、PGA、LPGA等）
 * - 智能去重和时间过滤
 * 
 * 使用方法：
 * node discover_yahoo_golf_articles.js 50 --urls-only
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// 命令行参数
const args = process.argv.slice(2);
const urlLimit = parseInt(args[0]) || 50;
const urlsOnly = args.includes('--urls-only');

// 输出文件
const OUTPUT_FILE = 'deep_urls_yahoo_golf.txt';
const DETAILS_FILE = 'yahoo_golf_details.json';

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
    const hasGolf = urlLower.includes('/golf') || 
                   urlLower.includes('golf-') ||
                   titleLower.includes('golf') ||
                   titleLower.includes('pga') ||
                   titleLower.includes('lpga') ||
                   titleLower.includes('masters') ||
                   titleLower.includes('open championship');
    
    // 排除其他运动关键词
    const otherSports = ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'football', 
                        'basketball', 'baseball', 'hockey', 'tennis', 
                        'boxing', 'mma', 'ufc', 'nascar', 'f1', 'formula'];
    
    const hasOtherSports = otherSports.some(sport => 
        urlLower.includes(sport) || titleLower.includes(sport)
    );
    
    // 排除特定类型的内容和导航页面
    const excludedTypes = ['video-', 'videos/', 'poll/', 'quiz/', 'fantasy/', 
                          'betting/', 'odds/', '/schedule/', '/stats/', 
                          '/players/', '/topic/', '/news/$'];
    const isExcluded = excludedTypes.some(type => {
        if (type.endsWith('$')) {
            return urlLower.endsWith(type.slice(0, -1));
        }
        return urlLower.includes(type);
    });
    
    // 必须是文章URL（包含article或breaking-news）
    const isArticle = urlLower.includes('/article/') || 
                     urlLower.includes('/breaking-news/') ||
                     (urlLower.includes('.html') && !urlLower.includes('/topic/'));
    
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
            
            // 多种选择器策略
            const selectors = [
                'a[href*="/golf/"]',
                'article a[href]',
                '.stream-item a[href]',
                '.js-stream-content a[href]',
                '[data-test-locator="stream-item"] a[href]',
                '.caas-content-wrapper a[href]',
                '.content-list a[href]',
                'h3 a[href]',
                'h2 a[href]'
            ];
            
            const seenUrls = new Set();
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(a => {
                    const href = a.href;
                    const text = a.textContent || '';
                    
                    if (href && 
                        href.startsWith('https://sports.yahoo.com') && 
                        !seenUrls.has(href) &&
                        text.length > 10) {
                        
                        seenUrls.add(href);
                        
                        // 获取发布时间（如果有）
                        let time = '';
                        const parent = a.closest('article') || a.closest('.stream-item');
                        if (parent) {
                            const timeEl = parent.querySelector('time');
                            if (timeEl) {
                                time = timeEl.getAttribute('datetime') || timeEl.textContent || '';
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
async function discoverYahooGolfArticles() {
    console.log('🏌️ Yahoo Sports Golf 内容发现');
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
            { url: 'https://sports.yahoo.com/golf/', name: 'Golf主页' },
            { url: 'https://sports.yahoo.com/golf/pga-tour/', name: 'PGA Tour' },
            { url: 'https://sports.yahoo.com/golf/lpga/', name: 'LPGA' },
            { url: 'https://sports.yahoo.com/golf/european-tour/', name: '欧巡赛' },
            { url: 'https://sports.yahoo.com/golf/masters/', name: '大师赛' }
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
        
        if (!urlsOnly) {
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
        await discoverYahooGolfArticles();
        console.log('\n✅ 完成！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 发生错误:', error);
        process.exit(1);
    }
})();