#!/usr/bin/env node

/**
 * 统一Playwright抓取器
 * 合并Golf.com和Golf Digest的抓取逻辑
 * 保持各自网站特有的配置和处理方式
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const UrlFileManager = require('./url_file_manager');

class UnifiedPlaywrightScraper {
    constructor() {
        this.browser = null;
        this.forceCleanupTimer = null;
        this.isUrlsOnlyMode = false;
        
        // 网站特定配置
        this.websiteConfigs = {
            'golf.com': {
                name: 'Golf.com',
                baseUrl: 'https://golf.com',
                sections: [
                    { url: 'https://golf.com/', name: '首页' },
                    { url: 'https://golf.com/news/', name: '新闻' },
                    { url: 'https://golf.com/instruction/', name: '教学' },
                    { url: 'https://golf.com/gear/', name: '装备' },
                    { url: 'https://golf.com/travel/', name: '旅游' }
                ],
                articleSelectors: [
                    '.g-article-prev',
                    '.m-card--horizontal',
                    '.m-card--vertical', 
                    '.m-card',
                    '.c-entry-group-labels__item',
                    'article[class*="card"]',
                    'article'
                ],
                linkSelectors: [
                    'a.c-entry-box--compact__image-wrapper',
                    'a.m-ellipses--text',
                    'a[href*="/news/"]',
                    'a[href*="/instruction/"]',
                    'a[href*="/gear/"]',
                    'a[href*="/travel/"]'
                ],
                titleSelectors: [
                    '.c-entry-box--compact__title',
                    '.m-ellipses--text',
                    '.g-article-prev__title'
                ],
                timeSelectors: [
                    'time[datetime]',
                    '.c-timestamp',
                    '.entry-date',
                    '.g-article-prev__time'
                ],
                headless: false, // Golf.com需要非headless模式
                timeout: 60000,
                scrollSettings: {
                    scrollCount: 5,
                    scrollDelay: 3000
                }
            },
            'golfdigest.com': {
                name: 'Golf Digest',
                baseUrl: 'https://www.golfdigest.com',
                sections: [
                    { url: 'https://www.golfdigest.com', name: '主页' }
                ],
                articleSelectors: [
                    '.summary-item',
                    '.summary-list__item',
                    '.summary-collection__item',
                    '[data-testid="SummaryItemWrapper"]',
                    '.river-item',
                    '.content-card',
                    '.story-card'
                ],
                linkSelectors: [
                    'a[href*="/story/"]',
                    'a[href*="/article/"]',
                    'a[href*="/reviews/"]',
                    'a[href*="/instruction/"]',
                    'a[href*="/equipment/"]',
                    '.summary-item__hed-link'
                ],
                titleSelectors: [
                    '.summary-item__hed',
                    '.hed',
                    'h1', 'h2', 'h3'
                ],
                timeSelectors: [
                    'time[datetime]',
                    '.summary-item__publish-date',
                    '.publish-date',
                    '.date'
                ],
                headless: true,
                timeout: 30000,
                scrollSettings: {
                    scrollCount: 3,
                    scrollDelay: 2000
                }
            }
        };
    }

    /**
     * 初始化浏览器
     */
    async init(website) {
        const config = this.websiteConfigs[website];
        if (!config) {
            throw new Error(`不支持的网站: ${website}`);
        }

        console.log(`🚀 初始化${config.name}抓取器...`);
        
        // 设置强制清理定时器 - 防止进程卡死
        const timeoutDuration = this.isUrlsOnlyMode ? 90 * 1000 : 5 * 60 * 1000;
        this.forceCleanupTimer = setTimeout(async () => {
            console.warn('⚠️ 检测到长时间运行，强制清理资源并退出...');
            await this.forceCleanup('timeout');
            process.exit(0);
        }, timeoutDuration);
        
        this.browser = await chromium.launch({
            headless: config.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu',
                '--no-first-run',
                '--disable-web-security',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
        });

        return config;
    }

    /**
     * 抓取指定网站的文章URL
     */
    async scrapeWebsite(website, articleLimit = 20) {
        const config = await this.init(website);
        const articles = [];

        try {
            for (const section of config.sections) {
                console.log(`\n📄 扫描${section.name}: ${section.url}`);
                
                const page = await this.browser.newPage();
                page.setDefaultTimeout(config.timeout);
                page.setDefaultNavigationTimeout(config.timeout);
                
                try {
                    await page.goto(section.url, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: config.timeout 
                    });
                    
                    // 等待关键元素出现
                    try {
                        const selectorToWait = config.articleSelectors.join(', ');
                        await page.waitForSelector(selectorToWait, {
                            timeout: 10000
                        });
                    } catch (e) {
                        console.log('  ⚠️  页面可能未完全加载，继续处理...');
                    }
                    
                    // 网站特定的滚动处理
                    if (config.scrollSettings) {
                        for (let i = 0; i < config.scrollSettings.scrollCount; i++) {
                            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                            await page.waitForTimeout(config.scrollSettings.scrollDelay);
                        }
                    }
                    
                    // 提取文章信息
                    const sectionArticles = await this.extractArticles(page, config, website);
                    
                    console.log(`  ✅ 找到 ${sectionArticles.length} 篇文章`);
                    articles.push(...sectionArticles);
                    
                } catch (error) {
                    console.error(`  ❌ 扫描${section.name}失败:`, error.message);
                } finally {
                    await page.close();
                }
                
                // 如果已达到目标数量，停止抓取
                if (articles.length >= articleLimit) {
                    break;
                }
            }
            
            // 去重和限制数量
            const uniqueArticles = this.deduplicateArticles(articles);
            const limitedArticles = uniqueArticles.slice(0, articleLimit);
            
            console.log(`\n📊 ${config.name} 抓取完成:`);
            console.log(`   总计: ${limitedArticles.length} 篇文章`);
            
            return limitedArticles;
            
        } finally {
            await this.cleanup();
        }
    }

    /**
     * 从页面提取文章信息
     */
    async extractArticles(page, config, website) {
        return await page.evaluate((config, website) => {
            const articleData = [];
            const containers = document.querySelectorAll(config.articleSelectors.join(', '));
            
            containers.forEach(container => {
                // 查找链接
                let linkElement = null;
                for (const selector of config.linkSelectors) {
                    linkElement = container.querySelector(selector);
                    if (linkElement) break;
                }
                
                if (!linkElement) return;
                
                const url = linkElement.href;
                if (!url || url === window.location.href) return;
                
                // 查找标题
                let title = '';
                for (const selector of config.titleSelectors) {
                    const titleElement = container.querySelector(selector);
                    if (titleElement) {
                        title = titleElement.textContent?.trim() || titleElement.getAttribute('title') || '';
                        if (title) break;
                    }
                }
                
                if (!title) {
                    title = linkElement.getAttribute('title') || linkElement.textContent?.trim() || '';
                }
                
                // 查找时间
                let publishTime = null;
                for (const selector of config.timeSelectors) {
                    const timeElement = container.querySelector(selector);
                    if (timeElement) {
                        publishTime = timeElement.getAttribute('datetime') || timeElement.textContent?.trim();
                        if (publishTime) break;
                    }
                }
                
                // 如果没找到时间，尝试从文本中匹配相对时间
                if (!publishTime) {
                    const relativeTime = container.textContent.match(/(\d+)\s*(hours?|days?|weeks?)\s*ago/i);
                    if (relativeTime) {
                        publishTime = relativeTime[0];
                    }
                }
                
                if (url && title) {
                    articleData.push({ 
                        url, 
                        title: title.substring(0, 200), // 限制标题长度
                        publishTime,
                        website
                    });
                }
            });
            
            return articleData;
        }, config, website);
    }

    /**
     * 去重文章
     */
    deduplicateArticles(articles) {
        const seen = new Set();
        return articles.filter(article => {
            const key = article.url.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 生成URL文件
     */
    async generateUrlFile(website, articles, ignoreTime = false) {
        const urlFileManager = new UrlFileManager();
        const filename = `deep_urls_${website.replace('.', '_')}.txt`;
        
        // 提取URL
        const urls = articles.map(article => article.url);
        
        // 生成文件头部注释
        const header = [
            `# ${this.websiteConfigs[website].name} URLs`,
            `# 生成时间: ${new Date().toISOString()}`,
            `# 总计: ${urls.length} 个URL`,
            `# 模式: ${ignoreTime ? '所有文章' : '最近文章'}`,
            ''
        ].join('\n');
        
        const content = header + urls.join('\n') + '\n';
        
        fs.writeFileSync(filename, content, 'utf8');
        console.log(`\n💾 已生成URL文件: ${filename}`);
        console.log(`📊 包含 ${urls.length} 个URL`);
        
        // 显示前3个URL作为示例
        console.log('\n📋 URL示例:');
        urls.slice(0, 3).forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
        
        return filename;
    }

    /**
     * 强制清理
     */
    async forceCleanup(reason = 'manual') {
        console.log(`🧹 强制清理资源 (原因: ${reason})`);
        
        if (this.forceCleanupTimer) {
            clearTimeout(this.forceCleanupTimer);
            this.forceCleanupTimer = null;
        }
        
        if (this.browser) {
            try {
                const contexts = this.browser.contexts();
                for (const context of contexts) {
                    const pages = context.pages();
                    for (const page of pages) {
                        try {
                            await page.close();
                        } catch (e) {}
                    }
                    try {
                        await context.close();
                    } catch (e) {}
                }
                await this.browser.close();
            } catch (e) {
                console.error('浏览器清理失败:', e.message);
            }
            this.browser = null;
        }
    }

    /**
     * 普通清理
     */
    async cleanup() {
        await this.forceCleanup('normal');
    }
}

/**
 * 主函数 - 支持Golf.com和Golf Digest
 */
async function main() {
    const args = process.argv.slice(2);
    const website = args[0]; // 'golf.com' 或 'golfdigest.com'
    const articleLimit = parseInt(args[1]) || 20;
    const ignoreTime = args.includes('--ignore-time');
    const urlsOnly = args.includes('--urls-only');
    
    if (!website || !['golf.com', 'golfdigest.com'].includes(website)) {
        console.log('用法: node unified_playwright_scraper.js <网站> [数量] [选项]');
        console.log('网站: golf.com 或 golfdigest.com');
        console.log('选项: --ignore-time --urls-only');
        console.log('示例: node unified_playwright_scraper.js golf.com 25 --urls-only');
        process.exit(1);
    }
    
    const scraper = new UnifiedPlaywrightScraper();
    scraper.isUrlsOnlyMode = urlsOnly;
    
    try {
        console.log(`🏌️ 开始抓取 ${website} 的文章...`);
        console.log(`📊 目标数量: ${articleLimit} 篇`);
        console.log(`⏰ 时间模式: ${ignoreTime ? '所有文章' : '最近文章'}`);
        
        const articles = await scraper.scrapeWebsite(website, articleLimit);
        
        if (articles.length === 0) {
            console.log('❌ 没有获取到任何文章URL');
            return;
        }
        
        // 生成URL文件
        if (urlsOnly) {
            await scraper.generateUrlFile(website, articles, ignoreTime);
            console.log(`\n✅ ${website} URL文件生成完成！`);
        } else {
            // 显示获取到的文章列表
            console.log('\n📋 获取到的文章:');
            articles.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
                console.log(`   ${article.url}`);
                if (article.publishTime) {
                    console.log(`   发布时间: ${article.publishTime}`);
                }
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ 抓取过程中发生错误:', error);
        await scraper.forceCleanup('error');
        process.exit(1);
    }
}

// 导出类用于其他模块使用
module.exports = UnifiedPlaywrightScraper;

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}