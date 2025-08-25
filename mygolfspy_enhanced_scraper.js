const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class MyGolfSpyEnhancedScraper {
    constructor() {
        this.userDataDir = path.join(__dirname, '.mygolfspy_browser_data');
        this.cookiesFile = path.join(__dirname, '.mygolfspy_cookies.json');
    }

    /**
     * 创建增强版浏览器实例
     */
    async createEnhancedBrowser() {
        // 确保用户数据目录存在
        if (!fs.existsSync(this.userDataDir)) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }

        const browser = await chromium.launch({
            headless: false, // 使用有头模式更像真实用户
            channel: 'chrome', // 使用Chrome而不是Chromium
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--start-maximized',
                '--disable-webgl',
                '--disable-webgl2',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
            timeout: 60000
        });

        return browser;
    }

    /**
     * 创建增强版页面
     */
    async createEnhancedPage(browser) {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            permissions: ['geolocation'],
            geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
            colorScheme: 'light',
            deviceScaleFactor: 2,
            isMobile: false,
            hasTouch: false,
            javaScriptEnabled: true,
            acceptDownloads: false,
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // 加载已保存的cookies
        if (fs.existsSync(this.cookiesFile)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
                await context.addCookies(cookies);
                console.log('[MyGolfSpy Enhanced] ✅ 已加载保存的cookies');
            } catch (e) {
                console.log('[MyGolfSpy Enhanced] ⚠️  无法加载cookies');
            }
        }

        const page = await context.newPage();

        // 注入反检测脚本
        await page.addInitScript(() => {
            // 覆盖navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // 覆盖navigator.plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                ]
            });

            // 覆盖permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // 添加chrome对象
            window.chrome = {
                runtime: {
                    connect: () => {},
                    sendMessage: () => {}
                }
            };

            // 覆盖languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // 添加更多真实浏览器属性
            window.navigator.bluetooth = {};
            window.navigator.usb = {};
            
            // 模拟真实的屏幕属性
            Object.defineProperties(screen, {
                availWidth: { get: () => 1920 },
                availHeight: { get: () => 1080 },
                width: { get: () => 1920 },
                height: { get: () => 1080 },
                colorDepth: { get: () => 24 },
                pixelDepth: { get: () => 24 }
            });

            // 隐藏自动化相关的属性
            delete window.navigator.__proto__.webdriver;
            
            // 模拟真实的媒体设备
            navigator.mediaDevices.enumerateDevices = async () => [
                { deviceId: 'default', kind: 'audioinput', label: 'Default', groupId: 'default' },
                { deviceId: 'communications', kind: 'audioinput', label: 'Communications', groupId: 'communications' },
                { deviceId: 'default', kind: 'videoinput', label: 'FaceTime HD Camera', groupId: 'default' }
            ];
        });

        return { page, context };
    }

    /**
     * 智能等待和导航
     */
    async smartNavigate(page, url, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[MyGolfSpy Enhanced] 尝试访问 (${attempt}/${maxRetries})...`);
                
                const response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });

                // 等待一段随机时间
                await page.waitForTimeout(2000 + Math.random() * 3000);

                // 检查是否遇到Cloudflare
                const pageContent = await page.evaluate(() => document.body?.textContent || '');
                const hasCloudflare = pageContent.includes('Checking your browser') || 
                                     pageContent.includes('Please stand by') ||
                                     pageContent.includes('Just a moment');

                if (hasCloudflare) {
                    console.log('[MyGolfSpy Enhanced] 检测到Cloudflare，等待验证...');
                    
                    // 等待Cloudflare验证完成
                    await this.waitForCloudflareResolution(page);
                }

                // 检查是否成功加载内容
                const hasContent = await page.evaluate(() => {
                    const content = document.querySelector('.entry-content, .post-content, article');
                    return content && content.textContent.length > 100;
                });

                if (hasContent) {
                    console.log('[MyGolfSpy Enhanced] ✅ 页面加载成功');
                    return response;
                }

                if (attempt < maxRetries) {
                    console.log('[MyGolfSpy Enhanced] 页面内容不足，重试...');
                    await page.waitForTimeout(5000);
                }

            } catch (error) {
                console.log(`[MyGolfSpy Enhanced] 导航失败: ${error.message}`);
                if (attempt < maxRetries) {
                    await page.waitForTimeout(5000 * attempt);
                } else {
                    throw error;
                }
            }
        }

        throw new Error('无法加载页面内容');
    }

    /**
     * 等待Cloudflare验证完成
     */
    async waitForCloudflareResolution(page, maxWaitTime = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            await page.waitForTimeout(1000);
            
            const pageContent = await page.evaluate(() => document.body?.textContent || '');
            const stillChecking = pageContent.includes('Checking your browser') || 
                                 pageContent.includes('Please stand by') ||
                                 pageContent.includes('Just a moment');
            
            if (!stillChecking) {
                // 额外等待确保页面稳定
                await page.waitForTimeout(2000);
                return;
            }
            
            // 模拟鼠标移动
            const x = 100 + Math.random() * 700;
            const y = 100 + Math.random() * 500;
            await page.mouse.move(x, y);
        }
        
        throw new Error('Cloudflare验证超时');
    }

    /**
     * 抓取MyGolfSpy文章
     */
    async scrapeArticle(url) {
        console.log('[MyGolfSpy Enhanced] 开始抓取:', url);
        
        const browser = await this.createEnhancedBrowser();
        
        try {
            const { page, context } = await this.createEnhancedPage(browser);
            
            // 先访问主页建立会话
            console.log('[MyGolfSpy Enhanced] 访问主页建立会话...');
            await this.smartNavigate(page, 'https://mygolfspy.com/', 1);
            
            // 模拟用户行为
            await this.simulateHumanBehavior(page);
            
            // 访问目标文章
            console.log('[MyGolfSpy Enhanced] 访问目标文章...');
            await this.smartNavigate(page, url);
            
            // 再次模拟用户行为
            await this.simulateHumanBehavior(page);
            
            // 提取内容
            const content = await this.extractContent(page);
            
            // 保存cookies
            const cookies = await context.cookies();
            fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2));
            console.log('[MyGolfSpy Enhanced] 💾 已保存cookies');
            
            return content;
            
        } finally {
            await browser.close();
        }
    }

    /**
     * 模拟人类行为
     */
    async simulateHumanBehavior(page) {
        console.log('[MyGolfSpy Enhanced] 模拟用户行为...');
        
        // 随机滚动
        const scrolls = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < scrolls; i++) {
            const scrollY = 100 + Math.random() * 400;
            await page.evaluate((y) => window.scrollBy(0, y), scrollY);
            await page.waitForTimeout(500 + Math.random() * 1000);
        }
        
        // 滚动回顶部
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1000);
        
        // 随机鼠标移动
        for (let i = 0; i < 3; i++) {
            const x = 100 + Math.random() * 1000;
            const y = 100 + Math.random() * 600;
            await page.mouse.move(x, y);
            await page.waitForTimeout(200 + Math.random() * 300);
        }
    }

    /**
     * 提取文章内容
     */
    async extractContent(page) {
        return await page.evaluate(() => {
            // 查找标题
            const titleElement = document.querySelector('h1.entry-title, h1.post-title, h1.article-title, .entry-header h1, article h1');
            const title = titleElement?.textContent.trim() || 'MyGolfSpy Article';
            
            // 查找内容容器
            const contentElement = document.querySelector('.entry-content, .post-content, .article-content, article .content');
            
            if (!contentElement) {
                throw new Error('找不到文章内容');
            }
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, img, figure');
            
            elements.forEach(elem => {
                const tagName = elem.tagName.toUpperCase();
                
                if (tagName === 'P') {
                    const text = elem.textContent.trim();
                    if (text.length > 20 && !text.includes('Advertisement')) {
                        content += `${text}\n\n`;
                    }
                } else if (tagName === 'H2') {
                    content += `\n## ${elem.textContent.trim()}\n\n`;
                } else if (tagName === 'H3' || tagName === 'H4') {
                    content += `\n### ${elem.textContent.trim()}\n\n`;
                } else if (tagName === 'UL' || tagName === 'OL') {
                    elem.querySelectorAll('li').forEach(li => {
                        content += `• ${li.textContent.trim()}\n`;
                    });
                    content += '\n';
                } else if (tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.textContent.trim()}\n\n`;
                } else if (tagName === 'IMG' || tagName === 'FIGURE') {
                    const img = tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                    if (img && img.src && !img.src.includes('logo') && !img.src.includes('avatar')) {
                        imageCounter++;
                        const alt = img.alt || `图片${imageCounter}`;
                        images.push({ url: img.src, alt });
                        content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                    }
                }
            });
            
            return { title, content, images, url: window.location.href };
        });
    }
}

module.exports = MyGolfSpyEnhancedScraper;