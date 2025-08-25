#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const { loadCookies, saveCookies } = require('./handle_popup_and_cookies');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class CookieAwareBatchProcessor extends BatchProcessor {
    constructor() {
        super();
        this.cookiesDir = path.join(__dirname, 'cookies');
    }
    
    async processArticles(urls) {
        // 检查是否有 MyGolfSpy 的 URL
        const hasMyGolfSpy = urls.some(url => url.includes('mygolfspy.com'));
        
        if (hasMyGolfSpy) {
            console.log('🍪 检测到 MyGolfSpy 链接，将使用保存的 cookies...');
        }
        
        // 调用父类方法
        return super.processArticles(urls);
    }
    
    // 重写浏览器启动方法
    async launchBrowser() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            });
            
            // 为每个页面设置 cookies
            this.browser.on('page', async (page) => {
                const url = page.url();
                if (url.includes('mygolfspy.com')) {
                    const context = page.context();
                    const cookieFile = path.join(this.cookiesDir, 'mygolfspy_cookies.json');
                    
                    try {
                        const cookieData = await fs.promises.readFile(cookieFile, 'utf8');
                        const cookies = JSON.parse(cookieData);
                        await context.addCookies(cookies);
                        console.log('✅ 已为 MyGolfSpy 页面加载 cookies');
                    } catch (e) {
                        console.log('⚠️ 未找到 MyGolfSpy cookies，可能会遇到弹窗');
                    }
                }
            });
        }
        return this.browser;
    }
}

// 主函数
async function main() {
    const urls = process.argv.slice(2).filter(arg => arg.startsWith('http'));
    
    if (urls.length === 0) {
        console.log('\n使用方法:');
        console.log('  node process_with_cookies.js <URL1> <URL2> ...');
        console.log('\n特点:');
        console.log('  - 自动处理 MyGolfSpy 的 cookies');
        console.log('  - 支持所有已配置的网站');
        return;
    }
    
    const processor = new CookieAwareBatchProcessor();
    await processor.processArticles(urls);
}

if (require.main === module) {
    main().catch(console.error);
}