#!/usr/bin/env node

/**
 * GolfWRX 简化版URL生成器
 * 设计理念：简单、快速、可靠
 * 避免复杂的Cloudflare绕过，直接获取能访问的URL
 */

const { chromium } = require('playwright');

class SimpleGolfWRXUrlGenerator {
    constructor() {
        this.baseUrl = 'https://www.golfwrx.com';
        this.maxUrls = 20; // 默认获取20个URL
        this.timeout = 30000; // 30秒超时
    }

    async getUrls(limit = 20) {
        this.maxUrls = limit;
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            const page = await context.newPage();
            const urls = new Set();

            // 直接访问新闻页面，避开首页的Cloudflare
            const newsPages = [
                '/news/',
                '/news/page/2/',
                '/news/page/3/'
            ];

            for (const newsPage of newsPages) {
                if (urls.size >= this.maxUrls) break;
                
                try {
                    await page.goto(this.baseUrl + newsPage, {
                        waitUntil: 'domcontentloaded',
                        timeout: this.timeout
                    });

                    await page.waitForTimeout(2000);

                    // 简单的URL提取
                    const pageUrls = await page.evaluate(() => {
                        const links = [];
                        // 获取所有包含日期格式的链接（GolfWRX文章URL特征）
                        document.querySelectorAll('a[href*="/20"]').forEach(link => {
                            const href = link.href;
                            if (href && 
                                href.includes('golfwrx.com') && 
                                href.match(/\/\d{4}\/\d{2}\/\d{2}\//) && // 日期格式
                                !href.includes('/page/') &&
                                !href.includes('#')) {
                                links.push(href);
                            }
                        });
                        return links;
                    });

                    pageUrls.forEach(url => urls.add(url));
                } catch (e) {
                    // 静默失败，继续下一个页面
                }
            }

            // 如果URL为0，使用1个备用URL
            const fallbackUrls = [
                'https://www.golfwrx.com/news/spotted-tiger-woods-new-taylormade-prototype/'
            ];

            // 只在完全失败时使用备用URL
            if (urls.size === 0 && fallbackUrls.length > 0) {
                urls.add(fallbackUrls[0]);
                console.error('⚠️  警告：GolfWRX URL生成失败，使用备用URL');
            }

            return Array.from(urls).slice(0, this.maxUrls);

        } finally {
            await browser.close();
        }
    }
}

// 命令行接口
async function main() {
    const args = process.argv.slice(2);
    const urlsOnly = args.includes('--urls-only');
    const limitArg = args.find(arg => !isNaN(parseInt(arg)));
    const limit = limitArg ? parseInt(limitArg) : 20;

    if (!urlsOnly) {
        console.log('🏌️ GolfWRX 简化版URL生成器');
        console.log('设计理念：简单快速，避免复杂性');
        console.log('=' .repeat(50));
    }

    const generator = new SimpleGolfWRXUrlGenerator();
    
    try {
        const urls = await generator.getUrls(limit);
        
        if (urlsOnly) {
            // --urls-only 模式：只输出URL
            urls.forEach(url => console.log(url));
        } else {
            // 正常模式：显示统计
            console.log(`\n✅ 成功获取 ${urls.length} 个URL`);
            urls.forEach((url, i) => {
                console.log(`${i + 1}. ${url}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        if (!urlsOnly) {
            console.error('❌ 错误:', error.message);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = SimpleGolfWRXUrlGenerator;