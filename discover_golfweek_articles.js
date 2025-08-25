#!/usr/bin/env node

/**
 * Golfweek (USA Today) 内容发现脚本
 * 抓取最新高尔夫文章，支持JavaScript渲染页面
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class GolfweekDiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 100;  // 增加默认值到100
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
        this.outputFile = 'deep_urls_golfweek_usatoday_com.txt';
    }

    async discover() {
        console.log('🏌️ Golfweek (USA Today) 文章发现器');
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
                { url: 'https://golfweek.usatoday.com/', name: '主页' },
                { url: 'https://golfweek.usatoday.com/category/pga-tour/', name: 'PGA巡回赛' },
                { url: 'https://golfweek.usatoday.com/category/lpga-tour/', name: 'LPGA巡回赛' },
                { url: 'https://golfweek.usatoday.com/category/instruction/', name: '教学' },
                { url: 'https://golfweek.usatoday.com/category/equipment/', name: '装备' },
                { url: 'https://golfweek.usatoday.com/category/travel/', name: '旅游' },
                { url: 'https://golfweek.usatoday.com/lists/', name: '列表文章' }
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
                    
                    // 增加滚动次数以加载更多内容
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
                        
                        // 多种选择器策略
                        const linkSelectors = [
                            'a[href*="/story/sports/golf/"]',
                            'a[href*="/news/"]',
                            'a[href*="/article/"]',
                            'a[href*="/video/"]',
                            'a[href*="/lists/"]',
                            '.gnt_m_flm_a',  // USA Today 文章链接类
                            'a.gnt_m_flm_a',
                            'article a[href]',
                            '.story-link',
                            '[data-c-br] a[href]',
                            'h2 a[href]',
                            'h3 a[href]',
                            'h4 a[href]',
                            '.gnt_m_tl a',
                            '.gnt_m_tl_a'
                        ];
                        
                        linkSelectors.forEach(selector => {
                            const links = document.querySelectorAll(selector);
                            links.forEach(link => {
                                const href = link.href;
                                const text = link.textContent?.trim() || '';
                                
                                // 过滤条件 - 增强高尔夫内容过滤
                                if (href && 
                                    href.includes('golfweek.usatoday.com') &&
                                    (href.includes('/story/sports/golf/') || 
                                     href.includes('/story/sports/2024/') ||
                                     href.includes('/story/sports/2025/') ||
                                     href.includes('/lists/') ||
                                     href.includes('/instruction/') ||
                                     href.includes('/equipment/') ||
                                     href.includes('/travel/')) &&
                                    !href.includes('#') &&
                                    !href.includes('signin') &&
                                    !href.includes('subscribe') &&
                                    !href.includes('/category/') &&
                                    !href.includes('/news/local/') &&
                                    !href.includes('/news/nation/') &&
                                    !href.includes('/news/politics/') &&
                                    !href.includes('/story/news/local/') &&
                                    !seenUrls.has(href) &&
                                    text.length > 10) {
                                    
                                    seenUrls.add(href);
                                    
                                    // 尝试获取时间信息
                                    let timeText = '';
                                    const parent = link.closest('article') || link.closest('[data-c-br]') || link.parentElement?.parentElement;
                                    if (parent) {
                                        const timeElem = parent.querySelector('time, [data-c-dt], .gnt_m_flm_sbt, .timestamp');
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
                    
                    console.log(`   从 ${pageInfo.name} 发现 ${articles.length} 篇文章`);
                    
                    // 添加到总集合
                    articles.forEach(article => {
                        if (!allArticles.has(article.url)) {
                            allArticles.set(article.url, article);
                        }
                    });
                    
                    console.log(`   当前总计: ${allArticles.size} 篇文章`);
                    
                } catch (pageError) {
                    console.error(`   ❌ 抓取 ${pageInfo.name} 失败:`, pageError.message);
                    continue;
                }
            }
            
            console.log(`\n📊 总共发现 ${allArticles.size} 篇文章`);
            
            // 保存URL到文件
            const finalArticles = Array.from(allArticles.values()).slice(0, this.maxArticles);
            
            if (this.urlsOnly) {
                // 只输出URL模式
                const urls = finalArticles.map(a => a.url);
                
                // 写入文件
                const fileContent = [
                    `# Golfweek URL文件`,
                    `# 生成时间: ${new Date().toISOString()}`,
                    `# 文章数量: ${urls.length}`,
                    '',
                    ...urls,
                    ''
                ].join('\n');
                
                await fs.writeFile(this.outputFile, fileContent, 'utf-8');
                console.log(`\n📝 已保存 ${urls.length} 个URL到 ${this.outputFile}`);
                
                // 输出到stdout供其他脚本使用
                urls.forEach(url => console.log(url));
            } else {
                // 完整模式 - 显示更多信息
                console.log('\n📊 文章列表:');
                finalArticles.forEach((article, index) => {
                    console.log(`\n${index + 1}. ${article.title}`);
                    console.log(`   URL: ${article.url}`);
                    if (article.time) {
                        console.log(`   时间: ${article.time}`);
                    }
                });
            }
            
            return finalArticles;
            
        } catch (error) {
            console.error('❌ 错误:', error.message);
            
            // 备用URL机制
            if (this.urlsOnly) {
                console.log('\n⚠️ 使用备用URL...');
                const backupUrls = [
                    'https://golfweek.usatoday.com/story/sports/golf/amateur/2025/08/11/us-amateur-2025-scores-highlights-first-round/85620493007/',
                    'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-2025-winners-money-payout-purse-at-caves-valley/85613251007/',
                    'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-sepp-straka-withdraws-private-family-matter-pga-tour/85614861007/'
                ];
                
                const fileContent = [
                    `# Golfweek URL文件 (备用)`,
                    `# 生成时间: ${new Date().toISOString()}`,
                    `# 文章数量: ${backupUrls.length}`,
                    '',
                    ...backupUrls,
                    ''
                ].join('\n');
                
                await fs.writeFile(this.outputFile, fileContent, 'utf-8');
                console.log(`📝 已保存 ${backupUrls.length} 个备用URL到 ${this.outputFile}`);
                
                backupUrls.forEach(url => console.log(url));
            }
            
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    isWithin24Hours(timeText) {
        if (!timeText) return false;
        
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        // 处理相对时间
        if (timeText.includes('hour') || timeText.includes('minute')) {
            return true;
        }
        
        if (timeText.includes('day')) {
            const match = timeText.match(/(\d+)\s*day/);
            if (match && parseInt(match[1]) === 1) {
                return true;
            }
            return false;
        }
        
        // 尝试解析绝对时间
        try {
            const date = new Date(timeText);
            if (!isNaN(date.getTime())) {
                return date.getTime() > oneDayAgo;
            }
        } catch (e) {
            // 忽略解析错误
        }
        
        return false;
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        maxArticles: 100,  // 增加默认值到100
        urlsOnly: false,
        debug: false
    };
    
    // 解析命令行参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--urls-only') {
            options.urlsOnly = true;
        } else if (args[i] === '--debug') {
            options.debug = true;
        } else if (!isNaN(parseInt(args[i]))) {
            options.maxArticles = parseInt(args[i]);
        }
    }
    
    const discoverer = new GolfweekDiscoverer(options);
    discoverer.discover().catch(error => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = GolfweekDiscoverer;