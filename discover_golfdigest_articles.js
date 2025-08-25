#!/usr/bin/env node

/**
 * Golf Digest文章发现脚本
 * 专门用于发现和抓取Golf Digest网站的高尔夫文章
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BatchProcessor = require('./batch_process_articles');
const WebsiteDuplicateChecker = require('./website_duplicate_checker');

// Golf Digest专用配置
const GOLFDIGEST_CONFIG = {
    baseUrl: 'https://www.golfdigest.com',
    sections: [
        '' // 只扫描主页
    ],
    selectors: {
        articleLinks: [
            'a[href*="/story/"]',
            'a[href*="/article/"]',
            'a[href*="/reviews/"]',
            'a[href*="/instruction/"]',
            'a[href*="/equipment/"]',
            '.content-header a',
            '.story-link',
            '.headline a',
            'h1 a, h2 a, h3 a',
            '[data-testid="BodyWrapper"] a',
            '.summary-item__hed-link',
            '.summary-collection__items a'
        ]
    },
    maxRetries: 3,
    timeout: 30000
};

class GolfDigestArticleDiscoverer {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.duplicateChecker = new WebsiteDuplicateChecker();
        this.discoveredUrls = new Set();
        this.validArticles = [];
    }

    async init() {
        console.log('🚀 初始化Golf Digest文章发现器...');
        
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        this.page = await this.context.newPage();

        console.log('✅ 浏览器初始化完成');
    }

    // 从页面提取文章URL
    async extractArticleUrls(pageUrl) {
        console.log(`📄 扫描页面: ${pageUrl}`);
        
        try {
            await this.page.goto(pageUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: GOLFDIGEST_CONFIG.timeout 
            });
            
            // 等待内容加载
            await this.page.waitForTimeout(3000);
            
            // 滚动页面以加载更多内容
            await this.scrollPage();
            
            // 提取所有符合条件的链接
            const urls = await this.page.evaluate((config) => {
                const foundUrls = new Set();
                
                config.selectors.articleLinks.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        const href = el.getAttribute('href');
                        if (href) {
                            // 构建完整URL
                            let fullUrl = href;
                            if (href.startsWith('//')) {
                                fullUrl = 'https:' + href;
                            } else if (href.startsWith('/')) {
                                fullUrl = `${config.baseUrl}${href}`;
                            } else if (!href.startsWith('http')) {
                                fullUrl = `${config.baseUrl}/${href}`;
                            }
                            
                            // 验证URL是否为有效的文章链接
                            if (fullUrl.includes('golfdigest.com')) {
                                // 必须包含文章标识
                                const articlePatterns = ['/story/', '/article/', '/reviews/', '/instruction/', '/equipment/'];
                                const hasArticlePattern = articlePatterns.some(pattern => fullUrl.includes(pattern));
                                
                                // 排除无效链接
                                const excludePatterns = ['#', 'javascript:', 'mailto:', '/video/', '/gallery/', '/podcast/', '/subscribe', '/account', '/search'];
                                const hasExcludePattern = excludePatterns.some(pattern => fullUrl.includes(pattern));
                                
                                if (hasArticlePattern && !hasExcludePattern) {
                                    foundUrls.add(fullUrl);
                                }
                            }
                        }
                    });
                });
                
                return Array.from(foundUrls);
            }, GOLFDIGEST_CONFIG);
            
            console.log(`✅ 发现 ${urls.length} 个潜在文章链接`);
            return urls;
            
        } catch (error) {
            console.error(`❌ 页面扫描失败: ${error.message}`);
            return [];
        }
    }

    // 验证是否为有效的文章URL
    isValidArticleUrl(url) {
        if (!url || !url.includes('golfdigest.com')) return false;
        
        // 必须包含文章标识
        const articlePatterns = [
            '/story/',
            '/article/',
            '/reviews/',
            '/instruction/',
            '/equipment/'
        ];
        
        const hasArticlePattern = articlePatterns.some(pattern => url.includes(pattern));
        
        // 排除无效链接
        const excludePatterns = [
            '#',
            'javascript:',
            'mailto:',
            '/video/',
            '/gallery/',
            '/podcast/',
            '/subscribe',
            '/account',
            '/search'
        ];
        
        const hasExcludePattern = excludePatterns.some(pattern => url.includes(pattern));
        
        return hasArticlePattern && !hasExcludePattern;
    }

    // 滚动页面加载更多内容
    async scrollPage() {
        console.log('📜 滚动页面以加载更多内容...');
        
        // 执行多次滚动以确保加载所有内容
        for (let scroll = 0; scroll < 3; scroll++) {
            await this.page.evaluate(async () => {
                const scrollStep = 500;
                const scrollDelay = 300;
                const maxScrolls = 10;
                
                for (let i = 0; i < maxScrolls; i++) {
                    window.scrollBy(0, scrollStep);
                    await new Promise(resolve => setTimeout(resolve, scrollDelay));
                    
                    // 检查是否到达页面底部
                    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
                        break;
                    }
                }
            });
            
            await this.page.waitForTimeout(1500);
        }
        
        // 确保回到页面顶部
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(500);
    }

    // 验证文章是否可访问并提取元信息
    async validateArticle(url) {
        try {
            console.log(`🔍 验证文章: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: 15000  // 减少超时时间
            });
            
            await this.page.waitForTimeout(1000);
            
            // 提取文章元信息
            const articleData = await this.page.evaluate(() => {
                // 提取标题
                const titleSelectors = [
                    'h1[data-testid="ContentHeaderHed"]',
                    'h1.content-header__hed',
                    'h1.headline',
                    'h1'
                ];
                
                let title = '';
                for (const selector of titleSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                        title = el.textContent.trim();
                        break;
                    }
                }
                
                // 提取发布时间
                const dateSelectors = [
                    '[data-testid="ContentHeaderPublishDate"]',
                    'time',
                    '.publish-date',
                    '.date'
                ];
                
                let publishDate = '';
                for (const selector of dateSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        publishDate = el.getAttribute('datetime') || el.textContent.trim() || '';
                        if (publishDate) break;
                    }
                }
                
                // 检查是否有正文内容
                const contentSelectors = [
                    '[data-testid="BodyWrapper"]',
                    '.article-body',
                    '.content-body',
                    '.story-body'
                ];
                
                let hasContent = false;
                for (const selector of contentSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim().length > 100) {
                        hasContent = true;
                        break;
                    }
                }
                
                return {
                    title,
                    publishDate,
                    hasContent,
                    url: window.location.href
                };
            });
            
            if (articleData.title && articleData.hasContent) {
                console.log(`✅ 有效文章: ${articleData.title.substring(0, 50)}...`);
                return articleData;
            } else {
                console.log(`⚠️ 无效文章: 缺少标题或内容`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ 文章验证失败: ${error.message}`);
            return null;
        }
    }

    // 发现文章的主方法
    async discoverArticles(options = {}) {
        const { 
            maxArticles = 50,
            ignoreTime = false,
            daysBack = 7
        } = options;
        
        console.log('🔍 开始发现Golf Digest文章...');
        console.log(`📊 参数: 最大文章数=${maxArticles}, 忽略时间=${ignoreTime}, 天数范围=${daysBack}`);
        
        try {
            await this.init();
            
            // 扫描各个版块
            for (const section of GOLFDIGEST_CONFIG.sections) {
                const sectionUrl = `${GOLFDIGEST_CONFIG.baseUrl}${section}`;
                const urls = await this.extractArticleUrls(sectionUrl);
                
                urls.forEach(url => this.discoveredUrls.add(url));
                
                // 避免请求过快
                await this.page.waitForTimeout(1000);
            }
            
            console.log(`📊 总计发现 ${this.discoveredUrls.size} 个独特URL`);
            
            // 检查重复并验证文章
            const urlArray = Array.from(this.discoveredUrls).slice(0, maxArticles * 2); // 只处理前面的一部分URL
            const newUrls = [];
            
            // 获取已处理的URL - 清理URL参数以便比较
            const processedUrls = this.duplicateChecker.getAllProcessedUrls();
            const cleanProcessedUrls = new Set();
            for (const pUrl of processedUrls) {
                // 移除URL参数进行比较
                const cleanUrl = pUrl.split('?')[0].replace(/\/$/, '');
                cleanProcessedUrls.add(cleanUrl);
            }
            
            console.log(`📊 已处理URL数量: ${processedUrls.size}`);
            
            for (let i = 0; i < urlArray.length && this.validArticles.length < maxArticles; i++) {
                const url = urlArray[i];
                
                // 清理当前URL以进行比较
                const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                
                // 检查是否重复
                const exists = cleanProcessedUrls.has(cleanUrl);
                if (exists) {
                    console.log(`⏩ 跳过已处理: ${cleanUrl}`);
                } else {
                    console.log(`🆕 发现新文章: ${cleanUrl}`);
                    // 验证文章是否有效
                    const articleData = await this.validateArticle(url);
                    if (articleData) {
                        // 时间过滤
                        if (!ignoreTime && articleData.publishDate) {
                            const articleDate = new Date(articleData.publishDate);
                            const cutoffDate = new Date();
                            cutoffDate.setDate(cutoffDate.getDate() - daysBack);
                            
                            if (articleDate < cutoffDate) {
                                console.log(`⏩ 跳过旧文章: ${articleData.title}`);
                                continue;
                            }
                        }
                        
                        this.validArticles.push({
                            url: articleData.url,
                            title: articleData.title,
                            publishDate: articleData.publishDate,
                            website: 'golfdigest.com'
                        });
                        
                        newUrls.push(url);
                    }
                }
                
                // 避免请求过快
                await this.page.waitForTimeout(1500);
            }
            
            console.log(`\n🆕 发现 ${this.validArticles.length} 篇新文章`);
            
            return {
                total: this.discoveredUrls.size,
                new: this.validArticles.length,
                articles: this.validArticles,
                urls: newUrls
            };
            
        } finally {
            await this.cleanup();
        }
    }

    // 处理发现的文章
    async processDiscoveredArticles(autoProcess = false) {
        if (this.validArticles.length === 0) {
            console.log('📭 没有新文章需要处理');
            return;
        }

        console.log(`\n📋 准备处理 ${this.validArticles.length} 篇文章`);
        
        if (!autoProcess) {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise((resolve) => {
                rl.question('是否开始批量处理这些文章？(y/n): ', (answer) => {
                    rl.close();
                    resolve(answer.toLowerCase());
                });
            });

            if (answer !== 'y' && answer !== 'yes') {
                console.log('❌ 用户取消处理');
                return;
            }
        }

        // 使用批量处理器
        console.log('\n🚀 开始批量处理文章...\n');
        const processor = new BatchProcessor();
        await processor.processArticles(
            this.validArticles.map(a => a.url), 
            'golfdigest.com'
        );
    }

    async cleanup() {
        if (this.page) {
            try {
                await this.page.close();
            } catch (e) {
                // 忽略页面关闭错误
            }
        }
        
        if (this.context) {
            try {
                await this.context.close();
            } catch (e) {
                // 忽略context关闭错误
            }
        }
        
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 浏览器已关闭');
        }
    }
}

// 命令行接口
async function main() {
    const args = process.argv.slice(2);
    
    // 在 --urls-only 模式下禁用日志输出
    if (args.includes('--urls-only')) {
        const originalLog = console.log;
        console.log = function(...args) {
            // 只允许输出URL
            if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('https://')) {
                originalLog.apply(console, args);
            }
        };
        console.error = () => {};
    }
    
    // 解析命令行参数
    const options = {
        maxArticles: 20,
        ignoreTime: args.includes('--ignore-time'),
        daysBack: 7,
        autoProcess: args.includes('--auto-process'),
        urlsOnly: args.includes('--urls-only')
    };
    
    // 从参数中提取数字
    const maxArticlesArg = args.find(arg => !isNaN(parseInt(arg)));
    if (maxArticlesArg) {
        options.maxArticles = parseInt(maxArticlesArg);
    }
    
    if (!args.includes('--urls-only')) {
        console.log('🏌️ Golf Digest文章发现器');
        console.log('=' .repeat(60));
    }
    
    const discoverer = new GolfDigestArticleDiscoverer();
    
    try {
        // 初始化浏览器 - 修复bug
        await discoverer.init();
        
        const result = await discoverer.discoverArticles(options);
        
        if (result.new > 0) {
            if (options.urlsOnly) {
                // --urls-only 模式：只输出URL
                result.articles.forEach((article) => {
                    console.log(article.url);
                });
            } else {
                // 正常模式：输出详细信息
                console.log('\n📊 发现的新文章:');
                result.articles.forEach((article, index) => {
                    console.log(`${index + 1}. ${article.title}`);
                    console.log(`   📅 ${article.publishDate || '无日期'}`);
                    console.log(`   🔗 ${article.url}\n`);
                });
                
                // 处理文章
                await discoverer.processDiscoveredArticles(options.autoProcess);
            }
        }
        
    } catch (error) {
        console.error('❌ 执行失败:', error);
        process.exit(1);
    } finally {
        // 确保清理浏览器资源
        await discoverer.cleanup();
    }
}

// 导出类
module.exports = GolfDigestArticleDiscoverer;

// 直接运行
if (require.main === module) {
    main();
}