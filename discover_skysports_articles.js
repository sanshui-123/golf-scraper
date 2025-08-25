#!/usr/bin/env node

/**
 * Sky Sports Golf 内容发现脚本
 * 抓取最新高尔夫文章，支持JavaScript渲染页面
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class SkySportsDiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 100;
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
        this.outputFile = 'deep_urls_skysports_com.txt';
    }

    async discover() {
        console.log('🏌️ Sky Sports Golf 文章发现器 - 优化版');
        console.log('═'.repeat(60));
        console.log(`目标: 获取最多 ${this.maxArticles} 篇文章`);
        console.log('优化: 快速抓取、多页面扫描\n');
        
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
                { url: 'https://www.skysports.com/golf', name: '主页' },
                { url: 'https://www.skysports.com/golf/news', name: '新闻' },
                { url: 'https://www.skysports.com/golf/features', name: '特写' },
                { url: 'https://www.skysports.com/golf/reports', name: '报道' },
                { url: 'https://www.skysports.com/golf/interviews', name: '访谈' },
                { url: 'https://www.skysports.com/golf/columnists', name: '专栏' },
                { url: 'https://www.skysports.com/golf/pga-tour', name: 'PGA巡回赛' },
                { url: 'https://www.skysports.com/golf/european-tour', name: '欧洲巡回赛' },
                { url: 'https://www.skysports.com/golf/lpga-tour', name: 'LPGA巡回赛' }
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
                    await page.waitForTimeout(2000);
                    
                    // 滚动页面加载更多内容
                    console.log('📜 滚动页面加载更多文章...');
                    const scrollTimes = pageInfo.name === '主页' ? 6 : 4;
                    for (let i = 0; i < scrollTimes; i++) {
                        const previousHeight = await page.evaluate(() => document.body.scrollHeight);
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await page.waitForTimeout(1500);
                        
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
                        
                        // 多种选择器策略
                        const linkSelectors = [
                            'a[href*="/golf/news/"]',
                            'a[href*="/golf/story/"]',
                            'a[href*="/golf/report/"]',
                            'a[href*="/golf/interview/"]',
                            'a[href*="/golf/feature/"]',
                            'a[href*="/golf/column/"]',
                            '.news-list__headline a',
                            '.news-list-secondary__headline a',
                            '.sdc-site-tile__headline a',
                            '.article__headline a',
                            '.media-list__headline a',
                            'h3.news-list__headline a',
                            'h3 a[href*="/golf/"]',
                            'h4 a[href*="/golf/"]',
                            '.headline a[href*="/golf/"]'
                        ];
                        
                        linkSelectors.forEach(selector => {
                            const links = document.querySelectorAll(selector);
                            links.forEach(link => {
                                const url = link.href;
                                const title = link.textContent?.trim() || '';
                                
                                // 过滤条件
                                if (url && 
                                    url.includes('skysports.com/golf/') &&
                                    (url.includes('/news/') || 
                                     url.includes('/story/') || 
                                     url.includes('/report/') || 
                                     url.includes('/interview/') || 
                                     url.includes('/feature/') || 
                                     url.includes('/column/')) &&
                                    !url.includes('/live/') &&
                                    !url.includes('/video/') &&
                                    !url.includes('/gallery/') &&
                                    !url.includes('/poll/') &&
                                    !url.includes('/quiz/') &&
                                    !url.includes('/fixtures/') &&
                                    !url.includes('/results/') &&
                                    !url.includes('/leaderboard/') &&
                                    !url.includes('#') &&
                                    !url.includes('?') &&
                                    title.length > 10 &&
                                    !seenUrls.has(url)) {
                                    
                                    seenUrls.add(url);
                                    
                                    // 获取时间信息
                                    let publishTime = null;
                                    const container = link.closest('article, .news-list__item, .media-list__item, .sdc-site-tile');
                                    if (container) {
                                        const timeElement = container.querySelector('time[datetime], .label__timestamp, .sdc-site-tile__date-time');
                                        if (timeElement) {
                                            publishTime = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
                                        }
                                    }
                                    
                                    articleData.push({
                                        url: url,
                                        title: title,
                                        publishTime: publishTime
                                    });
                                }
                            });
                        });
                        
                        return articleData;
                    });
                    
                    console.log(`   找到 ${articles.length} 篇文章`);
                    
                    // 添加到总集合
                    articles.forEach(article => {
                        if (allArticles.size < this.maxArticles) {
                            allArticles.set(article.url, article);
                        }
                    });
                    
                    await page.waitForTimeout(500);
                    
                } catch (error) {
                    console.error(`   ❌ 抓取失败: ${error.message}`);
                }
            }
            
            // 转换为数组并排序
            const sortedArticles = Array.from(allArticles.values())
                .sort((a, b) => {
                    // 优先按时间排序，没有时间的放后面
                    if (a.publishTime && b.publishTime) {
                        return new Date(b.publishTime) - new Date(a.publishTime);
                    }
                    if (a.publishTime) return -1;
                    if (b.publishTime) return 1;
                    return 0;
                });
            
            console.log(`\n📊 总计发现 ${sortedArticles.length} 篇文章`);
            
            // 保存URL到文件
            if (this.urlsOnly) {
                // 纯URL模式
                const urls = sortedArticles.map(a => a.url).join('\n');
                await fs.writeFile(this.outputFile, urls + '\n');
                console.log(`\n✅ URL已保存到: ${this.outputFile}`);
                console.log('\n生成的URL列表:');
                sortedArticles.forEach((article, index) => {
                    console.log(article.url);
                });
            } else {
                // 详细信息模式
                const content = sortedArticles.map(article => {
                    return `URL: ${article.url}\nTitle: ${article.title}\nTime: ${article.publishTime || '未知'}\n---`;
                }).join('\n');
                await fs.writeFile(this.outputFile, content);
                console.log(`\n✅ 详细信息已保存到: ${this.outputFile}`);
            }
            
            return sortedArticles;
            
        } catch (error) {
            console.error('❌ 发现过程出错:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

// 命令行参数处理
if (require.main === module) {
    const args = process.argv.slice(2);
    const maxArticles = parseInt(args[0]) || 50;
    const urlsOnly = args.includes('--urls-only');
    const debug = args.includes('--debug');
    
    const discoverer = new SkySportsDiscoverer({
        maxArticles,
        urlsOnly,
        debug
    });
    
    discoverer.discover()
        .then(articles => {
            console.log(`\n✅ 完成! 共发现 ${articles.length} 篇文章`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = SkySportsDiscoverer;