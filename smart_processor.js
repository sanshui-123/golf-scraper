#!/usr/bin/env node

/**
 * 智能处理器 - 两阶段优化处理
 * 1. 快速并行收集所有URL
 * 2. 智能串行处理文章
 */

const { chromium } = require('playwright');
const websiteConfigs = require('./website_configs.json');
const BatchProcessor = require('./batch_process_articles');

class SmartProcessor {
    constructor() {
        this.browser = null;
        this.urlPool = [];
        this.startTime = Date.now();
    }

    // 阶段1：并行收集URL（快速）
    async collectAllUrls() {
        console.log('📊 阶段1：并行收集所有网站URL\n');
        
        this.browser = await chromium.launch({ 
            headless: true,
            args: ['--disable-gpu', '--no-sandbox']
        });
        
        const context = await this.browser.newContext();
        const domains = Object.keys(websiteConfigs);
        
        // 为每个网站创建页面
        const pages = await Promise.all(
            domains.map(() => context.newPage())
        );
        
        // 并行收集（这个很快，不会崩溃）
        const results = await Promise.all(
            domains.map((domain, index) => 
                this.collectFromDomain(domain, pages[index])
            )
        );
        
        // 清理页面
        await Promise.all(pages.map(p => p.close()));
        await context.close();
        
        // 汇总结果
        this.urlPool = results.flat();
        console.log(`\n✅ URL收集完成：共 ${this.urlPool.length} 篇新文章`);
        
        return this.urlPool;
    }
    
    async collectFromDomain(domain, page) {
        const config = websiteConfigs[domain];
        console.log(`🔍 扫描 ${config.name}...`);
        
        try {
            // MyGolfSpy 使用RSS源，不需要页面抓取
            if (domain === 'mygolfspy.com') {
                console.log(`  ℹ️ ${config.name}: 使用RSS源，将在处理阶段获取`);
                return []; // RSS源在处理阶段获取
            }
            
            // GolfWRX 可能有Cloudflare保护
            if (domain === 'golfwrx.com') {
                console.log(`  ℹ️ ${config.name}: 需要特殊处理，将在处理阶段获取`);
                return []; // 特殊处理在处理阶段进行
            }
            
            // 快速扫描，只获取URL（Golf.com需要更多时间）
            const timeout = domain === 'golf.com' ? 45000 : 30000;
            await page.goto(config.homepage, { 
                waitUntil: 'domcontentloaded',
                timeout: timeout 
            });
            
            // 等待页面稳定
            await page.waitForTimeout(2000);
            
            // 特殊处理某些网站
            if (domain === 'golf.com') {
                // Golf.com需要等待动态内容
                await page.waitForTimeout(3000);
                // 滚动加载
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await page.waitForTimeout(2000);
            }
            
            // 根据配置获取链接
            const urls = await page.evaluate((config) => {
                const selectors = config.articleListSelectors;
                const patterns = config.articlePatterns;
                
                // 尝试多个选择器
                let links = [];
                if (selectors.container) {
                    const containers = document.querySelectorAll(selectors.container);
                    containers.forEach(container => {
                        const containerLinks = container.querySelectorAll('a[href]');
                        links.push(...containerLinks);
                    });
                }
                
                // 如果没找到，用通用选择器
                if (links.length === 0) {
                    links = document.querySelectorAll('a[href]');
                }
                
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => url && url.startsWith('http'))
                    .filter(url => patterns.some(p => url.includes(p)))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            }, config);
            
            // 检查是否找到了URL
            if (urls.length === 0) {
                console.log(`  ⏭️ ${config.name}: 没有找到新文章`);
                return [];
            }
            
            // 检查重复（基于本地已处理文件）
            const DuplicateChecker = require('./website_duplicate_checker');
            const checker = new DuplicateChecker();
            const processedUrls = checker.getWebsiteArticleUrls();
            const newUrls = urls.filter(url => !processedUrls.has(url));
            
            console.log(`  ✓ ${config.name}: ${urls.length} 个URL (新: ${newUrls.length})`);
            return newUrls.map(url => ({ url, domain, site: config.name }));
            
        } catch (error) {
            console.log(`  ✗ ${config.name}: 失败 - ${error.message}`);
            return [];
        }
    }
    
    // 阶段2：智能处理文章
    async processAllArticles() {
        console.log('\n📊 阶段2：智能处理文章\n');
        
        // 按网站分组
        const grouped = {};
        this.urlPool.forEach(item => {
            if (!grouped[item.domain]) {
                grouped[item.domain] = [];
            }
            grouped[item.domain].push(item.url);
        });
        
        // 确保特殊网站也被包含在处理中
        const allDomains = Object.keys(websiteConfigs);
        for (const domain of allDomains) {
            if (!grouped[domain] && (domain === 'mygolfspy.com' || domain === 'golfwrx.com')) {
                grouped[domain] = []; // 即使没有URL也要处理这些特殊网站
            }
        }
        
        let totalProcessed = 0;
        
        // 为不同网站使用不同的处理策略
        for (const [domain, urls] of Object.entries(grouped)) {
            // 特殊网站即使没有URL也要处理
            if (urls.length === 0 && domain !== 'mygolfspy.com' && domain !== 'golfwrx.com') {
                console.log(`\n⏭️ 跳过 ${websiteConfigs[domain].name} - 没有新文章`);
                continue;
            }
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📰 处理 ${websiteConfigs[domain].name} (${urls.length}篇)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            try {
                // 根据网站选择处理方式
                if (domain === 'mygolfspy.com') {
                    // MyGolfSpy 使用专门的RSS处理器
                    console.log('🔧 使用MyGolfSpy专用处理器...');
                    const { spawn } = require('child_process');
                    await new Promise((resolve, reject) => {
                        const child = spawn('node', ['process_mygolfspy_rss.js', 'process', urls.length.toString()], {
                            stdio: 'inherit'
                        });
                        child.on('close', code => {
                            if (code === 0) resolve();
                            else reject(new Error(`处理失败，退出码: ${code}`));
                        });
                    });
                    totalProcessed += urls.length;
                } else if (domain === 'golfwrx.com') {
                    // GolfWRX 使用专门的处理器
                    console.log('🔧 使用GolfWRX专用处理器...');
                    const { spawn } = require('child_process');
                    await new Promise((resolve, reject) => {
                        const child = spawn('node', ['process_golfwrx.js', 'process', urls.length.toString()], {
                            stdio: 'inherit'
                        });
                        child.on('close', code => {
                            if (code === 0) resolve();
                            else reject(new Error(`处理失败，退出码: ${code}`));
                        });
                    });
                    totalProcessed += urls.length;
                } else {
                    // 其他网站使用通用批处理器
                    console.log('🔧 使用通用批处理器...');
                    const processor = new BatchProcessor();
                    
                    // Golf Digest 需要特殊处理（限制图片数量）
                    if (domain === 'golfdigest.com') {
                        console.log('⚠️ Golf Digest特殊处理：限制图片处理数量');
                        // 只处理前3篇文章，避免大量图片导致超时
                        const limitedUrls = urls.slice(0, 3);
                        await processor.processArticles(limitedUrls, domain);
                        totalProcessed += limitedUrls.length;
                    } else {
                        await processor.processArticles(urls, domain);
                        totalProcessed += urls.length;
                    }
                }
            } catch (error) {
                console.error(`❌ ${websiteConfigs[domain].name} 处理出错:`, error.message);
            }
            
            // 每个网站处理完休息一下
            if (Object.keys(grouped).indexOf(domain) < Object.keys(grouped).length - 1) {
                console.log('\n⏳ 休息3秒后继续下一个网站...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        return totalProcessed;
    }
    
    async run() {
        try {
            // 两阶段处理
            await this.collectAllUrls();
            const totalProcessed = await this.processAllArticles();
            
            const duration = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
            console.log('\n' + '='.repeat(50));
            console.log('📊 处理完成统计：');
            console.log(`  • 总URL数: ${this.urlPool.length}`);
            console.log(`  • 处理成功: ${totalProcessed || 0}`);
            console.log(`  • 总耗时: ${duration} 分钟`);
            console.log('='.repeat(50));
            
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// 运行
if (require.main === module) {
    const processor = new SmartProcessor();
    processor.run().catch(console.error);
}

module.exports = SmartProcessor;