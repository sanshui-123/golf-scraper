// 浏览器池管理器 - 优化资源使用
const { chromium } = require('playwright');

class BrowserPool {
    constructor(maxBrowsers = 2) {
        this.browsers = [];
        this.available = [];
        this.maxBrowsers = maxBrowsers;
        this.creating = false;
    }
    
    async getBrowser() {
        // 如果有可用的浏览器，直接返回
        if (this.available.length > 0) {
            return this.available.pop();
        }
        
        // 如果还没达到上限，创建新的
        if (this.browsers.length < this.maxBrowsers && !this.creating) {
            this.creating = true;
            try {
                const browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-web-security',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-gpu',
                        '--no-zygote',
                        '--single-process',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-images',  // 不加载图片，加快速度
                        '--disable-javascript',  // 如果只是抓取内容，可以禁用JS
                    ],
                    ignoreDefaultArgs: ['--enable-automation']
                });
                
                this.browsers.push(browser);
                console.log(`🌐 创建浏览器 #${this.browsers.length}`);
                return browser;
            } finally {
                this.creating = false;
            }
        }
        
        // 等待可用的浏览器
        console.log('⏳ 等待可用浏览器...');
        while (this.available.length === 0) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        return this.available.pop();
    }
    
    releaseBrowser(browser) {
        if (this.browsers.includes(browser)) {
            this.available.push(browser);
        }
    }
    
    async closeAll() {
        console.log('🌐 关闭所有浏览器...');
        for (const browser of this.browsers) {
            try {
                await browser.close();
            } catch (e) {}
        }
        this.browsers = [];
        this.available = [];
    }
}

// 页面池管理器 - 复用页面
class PagePool {
    constructor(browser, maxPages = 5) {
        this.browser = browser;
        this.pages = [];
        this.available = [];
        this.maxPages = maxPages;
    }
    
    async getPage() {
        // 清理关闭的页面
        this.pages = this.pages.filter(p => !p.isClosed());
        this.available = this.available.filter(p => !p.isClosed());
        
        // 如果有可用页面
        if (this.available.length > 0) {
            const page = this.available.pop();
            // 清理页面状态
            await page.goto('about:blank');
            return page;
        }
        
        // 创建新页面
        if (this.pages.length < this.maxPages) {
            const page = await this.browser.newPage();
            
            // 优化页面设置
            await page.setViewportSize({ width: 1280, height: 720 });
            
            // 拦截不必要的资源
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            
            this.pages.push(page);
            return page;
        }
        
        // 等待可用页面
        while (this.available.length === 0) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        return this.getPage();
    }
    
    releasePage(page) {
        if (!page.isClosed() && this.pages.includes(page)) {
            this.available.push(page);
        }
    }
    
    async closeAll() {
        for (const page of this.pages) {
            try {
                if (!page.isClosed()) {
                    await page.close();
                }
            } catch (e) {}
        }
        this.pages = [];
        this.available = [];
    }
}

// 全局浏览器管理器
class GlobalBrowserManager {
    constructor() {
        this.browserPool = new BrowserPool(2);
        this.pagePools = new Map();
    }
    
    async getPage() {
        const browser = await this.browserPool.getBrowser();
        
        if (!this.pagePools.has(browser)) {
            this.pagePools.set(browser, new PagePool(browser));
        }
        
        const pagePool = this.pagePools.get(browser);
        const page = await pagePool.getPage();
        
        // 返回页面和释放函数
        return {
            page,
            release: () => {
                pagePool.releasePage(page);
                this.browserPool.releaseBrowser(browser);
            }
        };
    }
    
    async shutdown() {
        for (const [browser, pool] of this.pagePools) {
            await pool.closeAll();
        }
        await this.browserPool.closeAll();
    }
}

// 导出单例
module.exports = new GlobalBrowserManager();