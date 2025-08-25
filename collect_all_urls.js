#!/usr/bin/env node

/**
 * 并行收集所有网站的URL - 优化版本
 * 只收集URL，不处理文章，避免并行处理导致的崩溃
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class URLCollector {
    constructor() {
        this.browser = null;
        this.context = null;
        this.collectedUrls = [];
    }

    async initialize() {
        console.log('🚀 初始化浏览器...');
        this.browser = await chromium.launch({
            headless: true,
            args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        });
    }

    async collectGolfComUrls(page) {
        console.log('🏌️ 收集 Golf.com URLs...');
        try {
            await page.goto('https://golf.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(3000);
            
            // 滚动加载更多内容
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, 500));
                await page.waitForTimeout(1000);
            }

            const urls = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/news/"], a[href*="/instruction/"]');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => url.includes('golf.com/news/') || url.includes('golf.com/instruction/'))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            });

            console.log(`✅ Golf.com: 找到 ${urls.length} 个URL`);
            return urls.map(url => ({ url, source: 'golf.com' }));
        } catch (error) {
            console.error('❌ Golf.com 收集失败:', error.message);
            return [];
        }
    }

    async collectGolfMonthlyUrls(page) {
        console.log('📰 收集 Golf Monthly URLs...');
        try {
            await page.goto('https://www.golfmonthly.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(2000);

            const urls = await page.evaluate(() => {
                const links = document.querySelectorAll('.listing__item a, article a');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => url.includes('/news/') || url.includes('/tips/') || url.includes('/features/'))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            });

            console.log(`✅ Golf Monthly: 找到 ${urls.length} 个URL`);
            return urls.map(url => ({ url, source: 'golfmonthly.com' }));
        } catch (error) {
            console.error('❌ Golf Monthly 收集失败:', error.message);
            return [];
        }
    }

    async collectMyGolfSpyUrls(page) {
        console.log('🕵️ 收集 MyGolfSpy URLs...');
        try {
            await page.goto('https://mygolfspy.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(3000);

            const urls = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/news-opinion/"], a[href*="/buyers-guide/"]');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => !url.includes('#'))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            });

            console.log(`✅ MyGolfSpy: 找到 ${urls.length} 个URL`);
            return urls.map(url => ({ url, source: 'mygolfspy.com' }));
        } catch (error) {
            console.error('❌ MyGolfSpy 收集失败:', error.message);
            return [];
        }
    }

    async collectGolfWRXUrls(page) {
        console.log('🔧 收集 GolfWRX URLs...');
        try {
            await page.goto('https://www.golfwrx.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(5000); // GolfWRX需要更多时间

            const urls = await page.evaluate(() => {
                const links = document.querySelectorAll('h2 a, h3 a, .content-list a');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => url.match(/golfwrx\.com\/\d+\//))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            });

            console.log(`✅ GolfWRX: 找到 ${urls.length} 个URL`);
            return urls.map(url => ({ url, source: 'golfwrx.com' }));
        } catch (error) {
            console.error('❌ GolfWRX 收集失败:', error.message);
            return [];
        }
    }

    async collectGolfDigestUrls(page) {
        console.log('📖 收集 Golf Digest URLs...');
        try {
            await page.goto('https://www.golfdigest.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(3000);

            const urls = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/story/"]');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(url => !url.includes('?'))
                    .filter((url, index, self) => self.indexOf(url) === index)
                    .slice(0, 10);
            });

            console.log(`✅ Golf Digest: 找到 ${urls.length} 个URL`);
            return urls.map(url => ({ url, source: 'golfdigest.com' }));
        } catch (error) {
            console.error('❌ Golf Digest 收集失败:', error.message);
            return [];
        }
    }

    async collectAllUrls() {
        await this.initialize();
        
        console.log('\n📊 开始并行收集所有网站URLs...\n');
        const startTime = Date.now();

        try {
            // 创建5个页面，每个网站一个
            const pages = await Promise.all([
                this.context.newPage(),
                this.context.newPage(),
                this.context.newPage(),
                this.context.newPage(),
                this.context.newPage()
            ]);

            // 并行收集所有URL
            const results = await Promise.all([
                this.collectGolfComUrls(pages[0]),
                this.collectGolfMonthlyUrls(pages[1]),
                this.collectMyGolfSpyUrls(pages[2]),
                this.collectGolfWRXUrls(pages[3]),
                this.collectGolfDigestUrls(pages[4])
            ]);

            // 关闭所有页面
            await Promise.all(pages.map(page => page.close()));

            // 合并所有结果
            this.collectedUrls = results.flat();
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✅ URL收集完成！耗时: ${duration}秒`);
            console.log(`📊 总计收集: ${this.collectedUrls.length} 个URL`);

            // 按网站统计
            const stats = {};
            this.collectedUrls.forEach(item => {
                stats[item.source] = (stats[item.source] || 0) + 1;
            });
            
            console.log('\n📈 各网站URL数量:');
            Object.entries(stats).forEach(([source, count]) => {
                console.log(`  - ${source}: ${count} 个`);
            });

            // 保存到文件
            await this.saveUrls();

            return this.collectedUrls;

        } catch (error) {
            console.error('❌ 收集过程出错:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async saveUrls() {
        const outputPath = path.join(__dirname, 'collected_urls.json');
        const data = {
            timestamp: new Date().toISOString(),
            total: this.collectedUrls.length,
            urls: this.collectedUrls
        };
        
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
        console.log(`\n💾 URLs已保存到: ${outputPath}`);
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('\n🧹 浏览器已关闭');
        }
    }
}

// 主程序
async function main() {
    console.log('🏌️ 高尔夫网站URL收集器 - 优化版\n');
    
    const collector = new URLCollector();
    
    try {
        const urls = await collector.collectAllUrls();
        
        // 如果是直接运行，可以选择是否立即处理
        if (process.argv.includes('--process')) {
            console.log('\n🚀 准备处理收集到的文章...');
            const { spawn } = require('child_process');
            const child = spawn('node', ['process_collected_urls.js'], {
                stdio: 'inherit'
            });
        }
        
    } catch (error) {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    }
}

// 导出供其他模块使用
module.exports = URLCollector;

// 如果直接运行
if (require.main === module) {
    main();
}