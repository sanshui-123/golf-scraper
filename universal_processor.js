#!/usr/bin/env node

/**
 * 通用处理器 - 基于配置文件自动处理所有网站
 * 新增网站只需要在 website_configs.json 中添加配置
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const websiteConfigs = require('./website_configs.json');
const BatchProcessor = require('./batch_process_articles');

class UniversalProcessor {
    constructor() {
        this.configs = websiteConfigs;
        this.browser = null;
        this.context = null;
        this.urlQueue = [];
        this.processedUrls = new Set();
        this.stateFile = path.join(__dirname, 'processor_state.json');
        this.loadState();
    }

    // 加载处理状态，避免重复处理
    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
                this.processedUrls = new Set(state.processedUrls || []);
                console.log(`📊 已加载状态：已处理 ${this.processedUrls.size} 个URL`);
            }
        } catch (error) {
            console.log('📝 首次运行，创建新状态');
        }
    }

    // 保存处理状态
    saveState() {
        const state = {
            lastUpdate: new Date().toISOString(),
            processedUrls: Array.from(this.processedUrls)
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    async initialize() {
        this.browser = await chromium.launch({
            headless: true,
            args: ['--disable-gpu', '--no-sandbox']
        });
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
    }

    // 通用URL收集方法 - 基于配置
    async collectUrlsFromSite(domain, config, page) {
        console.log(`\n🔍 收集 ${config.name} 的URL...`);
        
        try {
            await page.goto(config.homepage, {
                waitUntil: 'domcontentloaded',
                timeout: config.timeout || 30000
            });

            // 等待内容加载
            if (config.waitForSelector) {
                await page.waitForSelector(config.articleListSelectors.container, {
                    timeout: 5000
                }).catch(() => {});
            }

            // 滚动加载更多内容
            await page.evaluate(() => {
                for (let i = 0; i < 3; i++) {
                    window.scrollBy(0, 500);
                }
            });
            await page.waitForTimeout(2000);

            // 使用配置的选择器收集URL
            const urls = await page.evaluate((selectors, patterns) => {
                const links = document.querySelectorAll(selectors.link);
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => {
                        // 根据配置的模式过滤URL
                        return patterns.some(pattern => url.includes(pattern));
                    })
                    .filter((url, index, self) => self.indexOf(url) === index);
            }, config.articleListSelectors, config.articlePatterns);

            console.log(`✅ ${config.name}: 找到 ${urls.length} 个URL`);
            
            // 过滤已处理的URL
            const newUrls = urls.filter(url => !this.processedUrls.has(url));
            console.log(`🆕 新URL: ${newUrls.length} 个`);
            
            return newUrls.map(url => ({
                url,
                domain,
                siteName: config.name
            }));

        } catch (error) {
            console.error(`❌ ${config.name} 收集失败:`, error.message);
            return [];
        }
    }

    // 并行收集所有网站的URL
    async collectAllUrls() {
        await this.initialize();
        
        console.log('📊 开始收集所有配置网站的URL...\n');
        const startTime = Date.now();

        const sites = Object.entries(this.configs);
        const pages = [];
        
        // 为每个网站创建页面
        for (let i = 0; i < sites.length; i++) {
            pages.push(await this.context.newPage());
        }

        // 并行收集
        const results = await Promise.all(
            sites.map(([domain, config], index) => 
                this.collectUrlsFromSite(domain, config, pages[index])
            )
        );

        // 关闭所有页面
        await Promise.all(pages.map(page => page.close()));

        // 合并结果
        this.urlQueue = results.flat();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ URL收集完成！耗时: ${duration}秒`);
        console.log(`📊 总计新URL: ${this.urlQueue.length} 个`);

        return this.urlQueue;
    }

    // 处理所有文章
    async processAllArticles() {
        if (this.urlQueue.length === 0) {
            console.log('📭 没有新文章需要处理');
            return;
        }

        console.log(`\n🚀 开始处理 ${this.urlQueue.length} 篇文章...\n`);
        
        const batchProcessor = new BatchProcessor();
        
        // 按网站分组处理
        const groupedUrls = {};
        this.urlQueue.forEach(item => {
            if (!groupedUrls[item.domain]) {
                groupedUrls[item.domain] = [];
            }
            groupedUrls[item.domain].push(item.url);
        });

        // 串行处理每个网站
        for (const [domain, urls] of Object.entries(groupedUrls)) {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📰 处理 ${this.configs[domain].name} (${urls.length}篇)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            await batchProcessor.processArticles(urls, domain);
            
            // 记录已处理的URL
            urls.forEach(url => this.processedUrls.add(url));
            this.saveState();
        }
    }

    async run() {
        try {
            // 收集URL
            await this.collectAllUrls();
            
            // 处理文章
            await this.processAllArticles();
            
            console.log('\n✅ 所有处理完成！');
            
        } catch (error) {
            console.error('❌ 处理出错:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// 命令行参数处理
const args = process.argv.slice(2);
const options = {
    reset: args.includes('--reset'),      // 重置处理状态
    collectOnly: args.includes('--collect-only'), // 只收集URL
    processOnly: args.includes('--process-only')  // 只处理已收集的URL
};

// 主程序
async function main() {
    console.log('🏌️ 通用高尔夫网站处理器\n');
    
    const processor = new UniversalProcessor();
    
    if (options.reset) {
        console.log('🔄 重置处理状态...');
        processor.processedUrls.clear();
        processor.saveState();
    }
    
    if (options.collectOnly) {
        await processor.collectAllUrls();
        console.log('\n📋 URL收集完成，使用 --process-only 开始处理');
    } else if (options.processOnly) {
        // 从保存的队列加载URL
        await processor.processAllArticles();
    } else {
        // 完整流程
        await processor.run();
    }
}

if (require.main === module) {
    main();
}

module.exports = UniversalProcessor;