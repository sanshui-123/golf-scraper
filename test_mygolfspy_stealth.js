#!/usr/bin/env node

const { chromium } = require('playwright');
const path = require('path');

async function testMyGolfSpyWithStealth() {
    const url = 'https://mygolfspy.com/news-opinion/callaways-chrome-tour-shark-balls-are-ready-to-hunt/';
    console.log('🧪 测试MyGolfSpy抓取（增强隐身模式）\n');
    console.log(`目标URL: ${url}\n`);
    
    let browser;
    try {
        // 使用更接近真实浏览器的配置
        browser = await chromium.launch({
            headless: false, // 使用有界面模式
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=CrossSiteDocumentBlockingAlways',
                '--disable-site-isolation-trials',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--start-maximized'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const page = await context.newPage();

        // 增强的反检测措施
        await page.addInitScript(() => {
            // 覆盖navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // 覆盖navigator.plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // 覆盖navigator.languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // 覆盖Permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // 覆盖chrome对象
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // 覆盖toString方法以避免检测
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this === window.navigator.permissions.query) {
                    return 'function query() { [native code] }';
                }
                return originalToString.call(this);
            };
        });

        console.log('🔄 导航到页面...');
        
        // 设置更多的请求拦截
        await page.route('**/*', route => {
            const request = route.request();
            const url = request.url();
            
            // 阻止一些可能触发检测的资源
            if (url.includes('google-analytics') || 
                url.includes('googletagmanager') ||
                url.includes('doubleclick') ||
                url.includes('facebook')) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // 尝试访问页面
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        console.log(`📡 响应状态: ${response.status()}`);
        console.log(`📍 最终URL: ${page.url()}`);

        // 等待一下，让页面完全加载
        await page.waitForTimeout(5000);

        // 检查是否有Cloudflare挑战
        const pageContent = await page.content();
        if (pageContent.includes('Checking your browser') || 
            pageContent.includes('cf-browser-verification') ||
            pageContent.includes('Cloudflare')) {
            console.log('⚠️  检测到Cloudflare验证页面');
            
            // 等待更长时间
            console.log('⏳ 等待30秒以通过验证...');
            await page.waitForTimeout(30000);
            
            // 再次检查
            const newContent = await page.content();
            if (newContent.includes('Checking your browser')) {
                console.log('❌ 仍在Cloudflare验证页面');
            } else {
                console.log('✅ 似乎已通过验证');
            }
        }

        // 检查是否成功获取到文章内容
        const hasArticle = await page.evaluate(() => {
            // 检查多种可能的文章容器
            const selectors = [
                '.entry-content',
                '.post-content',
                '.article-content',
                'article',
                '[class*="content"]',
                'main'
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.length > 100) {
                    return true;
                }
            }
            return false;
        });

        if (hasArticle) {
            console.log('✅ 检测到文章内容！');
            
            // 尝试提取标题和部分内容
            const articleData = await page.evaluate(() => {
                const title = document.querySelector('h1')?.textContent || '';
                const content = document.querySelector('.entry-content, .post-content, .article-content, article')?.textContent || '';
                return {
                    title: title.trim(),
                    contentLength: content.length,
                    contentPreview: content.substring(0, 200).trim() + '...'
                };
            });
            
            console.log('\n📄 文章信息:');
            console.log(`标题: ${articleData.title}`);
            console.log(`内容长度: ${articleData.contentLength} 字符`);
            console.log(`内容预览: ${articleData.contentPreview}`);
            
        } else {
            console.log('❌ 未检测到文章内容');
            
            // 保存页面截图
            const screenshotPath = path.join(__dirname, 'mygolfspy_stealth_test.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 页面截图已保存: ${screenshotPath}`);
            
            // 输出页面标题
            const pageTitle = await page.title();
            console.log(`📌 页面标题: ${pageTitle}`);
        }

        // 保持浏览器开启10秒，方便观察
        console.log('\n⏱️ 保持浏览器开启10秒...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 运行测试
testMyGolfSpyWithStealth().catch(console.error);