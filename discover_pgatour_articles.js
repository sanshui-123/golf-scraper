#!/usr/bin/env node

/**
 * PGA Tour 内容发现脚本
 * 抓取最新高尔夫文章，支持JavaScript渲染页面
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class PGATourDiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 100;
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
        this.outputFile = 'deep_urls_www_pgatour_com.txt';
    }

    async discover() {
        console.log('🏌️ PGA Tour 文章发现器');
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
                { url: 'https://www.pgatour.com/', name: '主页' },
                { url: 'https://www.pgatour.com/news', name: '新闻' },
                { url: 'https://www.pgatour.com/video', name: '视频' },
                { url: 'https://www.pgatour.com/instruction', name: '教学' },
                { url: 'https://www.pgatour.com/tournaments', name: '锦标赛' },
                { url: 'https://www.pgatour.com/champions', name: '冠军巡回赛' }
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
                        
                        // PGA Tour特定的选择器策略
                        const linkSelectors = [
                            'a[href*="/news/"]',
                            'a[href*="/article/"]',
                            'a[href*="/video/"]',
                            'a[href*="/instruction/"]',
                            'a[href*="/tournament/"]',
                            '.article-item a',
                            '.news-item a',
                            '.video-item a',
                            'article a[href]',
                            '[data-testid="article-link"]',
                            '.card a[href]',
                            '.content-card a[href]',
                            'h2 a[href]',
                            'h3 a[href]',
                            'h4 a[href]',
                            '.headline a[href]',
                            '.story-link'
                        ];
                        
                        linkSelectors.forEach(selector => {
                            const links = document.querySelectorAll(selector);
                            links.forEach(link => {
                                const href = link.href;
                                const text = link.textContent?.trim() || '';
                                
                                // 优化过滤条件 - 排除分类页面
                                const isArticlePage = href.includes('/article/news/') || 
                                                    href.includes('/article/video/') ||
                                                    href.includes('/article/instruction/');
                                const isCategoryPage = href.match(/\/news\/[^/]+$/) || // news/wire-to-wire等
                                                     href.endsWith('/news') ||
                                                     href.endsWith('/video') ||
                                                     href.endsWith('/instruction') ||
                                                     href.endsWith('/tournaments');
                                
                                if (href && 
                                    href.includes('pgatour.com') &&
                                    isArticlePage &&
                                    !isCategoryPage &&
                                    !href.includes('#') &&
                                    !href.includes('signin') &&
                                    !href.includes('subscribe') &&
                                    !href.includes('/category/') &&
                                    !href.includes('/tag/') &&
                                    !href.includes('?') &&
                                    !seenUrls.has(href) &&
                                    text.length > 10) {
                                    
                                    seenUrls.add(href);
                                    
                                    // 尝试获取时间信息
                                    let timeText = '';
                                    const parent = link.closest('article, .article-item, .news-item, .content-card');
                                    if (parent) {
                                        const timeElem = parent.querySelector('time, .date, .timestamp, [datetime]');
                                        if (timeElem) {
                                            timeText = timeElem.textContent?.trim() || timeElem.getAttribute('datetime') || '';
                                        }
                                    }
                                    
                                    articleData.push({
                                        url: href,
                                        title: text,
                                        time: timeText
                                    });
                                }
                            });
                        });
                        
                        return articleData;
                    });
                    
                    console.log(`   找到 ${articles.length} 篇文章`);
                    
                    // 合并到总列表
                    articles.forEach(article => {
                        if (!allArticles.has(article.url)) {
                            allArticles.set(article.url, article);
                        }
                    });
                    
                } catch (error) {
                    console.error(`   ❌ 抓取失败: ${error.message}`);
                }
            }
            
            // 转换为数组并排序
            const sortedArticles = Array.from(allArticles.values());
            
            // 准备输出
            if (this.urlsOnly) {
                // --urls-only 模式：只输出URL
                const urls = sortedArticles.map(a => a.url);
                urls.forEach(url => console.log(url));
                
                // 同时保存到文件
                const fileContent = urls.join('\n') + '\n';
                await fs.writeFile(this.outputFile, fileContent);
                console.error(`\n✅ 已保存 ${urls.length} 个URL到 ${this.outputFile}`);
            } else {
                // 正常模式：输出详细信息
                console.log(`\n📊 总共发现 ${sortedArticles.length} 篇文章`);
                
                // 显示前10篇
                console.log('\n📰 最新文章:');
                sortedArticles.slice(0, 10).forEach((article, index) => {
                    console.log(`\n${index + 1}. ${article.title}`);
                    console.log(`   URL: ${article.url}`);
                    if (article.time) {
                        console.log(`   时间: ${article.time}`);
                    }
                });
                
                // 保存到文件
                const urls = sortedArticles.map(a => a.url);
                const fileContent = urls.join('\n') + '\n';
                await fs.writeFile(this.outputFile, fileContent);
                console.log(`\n✅ 已保存 ${urls.length} 个URL到 ${this.outputFile}`);
            }
            
        } catch (error) {
            console.error('❌ 发生错误:', error);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const maxArticles = parseInt(args[0]) || 100;
    const urlsOnly = args.includes('--urls-only');
    
    const discoverer = new PGATourDiscoverer({
        maxArticles,
        urlsOnly
    });
    
    await discoverer.discover();
}

// 运行
if (require.main === module) {
    main().catch(console.error);
}

module.exports = PGATourDiscoverer;