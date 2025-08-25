const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class MyGolfSpySeleniumScraper {
    constructor() {
        this.cookiesFile = path.join(__dirname, '.mygolfspy_selenium_cookies.json');
    }

    async createDriver() {
        const options = new chrome.Options();
        
        // 关键设置：不使用headless模式
        // options.addArguments('--headless'); // 不使用headless
        
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-setuid-sandbox');
        options.addArguments('--window-size=1920,1080');
        options.addArguments('--start-maximized');
        options.addArguments('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        
        // 禁用自动化标识
        options.excludeSwitches(['enable-automation']);
        options.addArguments('--disable-infobars');
        
        // 设置偏好
        options.setUserPreferences({
            'credentials_enable_service': false,
            'profile.password_manager_enabled': false
        });

        const driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        // 执行JavaScript来隐藏webdriver属性
        await driver.executeScript(`
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            window.navigator.chrome = {
                runtime: {},
            };
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        `);

        return driver;
    }

    async loadCookies(driver) {
        if (fs.existsSync(this.cookiesFile)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
                for (const cookie of cookies) {
                    await driver.manage().addCookie(cookie);
                }
                console.log('[MyGolfSpy Selenium] ✅ 已加载保存的cookies');
            } catch (e) {
                console.log('[MyGolfSpy Selenium] ⚠️  无法加载cookies');
            }
        }
    }

    async saveCookies(driver) {
        try {
            const cookies = await driver.manage().getCookies();
            fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2));
            console.log('[MyGolfSpy Selenium] 💾 已保存cookies');
        } catch (e) {
            console.log('[MyGolfSpy Selenium] ⚠️  无法保存cookies');
        }
    }

    async waitForCloudflare(driver) {
        console.log('[MyGolfSpy Selenium] 检查Cloudflare...');
        
        try {
            const bodyText = await driver.findElement(By.tagName('body')).getText();
            
            if (bodyText.includes('Checking your browser') || 
                bodyText.includes('Please stand by') ||
                bodyText.includes('Just a moment')) {
                
                console.log('[MyGolfSpy Selenium] 检测到Cloudflare，等待验证...');
                
                // 等待最多30秒
                for (let i = 0; i < 30; i++) {
                    await driver.sleep(1000);
                    
                    const currentText = await driver.findElement(By.tagName('body')).getText();
                    if (!currentText.includes('Checking your browser') && 
                        !currentText.includes('Please stand by') &&
                        !currentText.includes('Just a moment')) {
                        console.log('[MyGolfSpy Selenium] Cloudflare验证完成');
                        break;
                    }
                    
                    // 模拟鼠标移动
                    const actions = driver.actions();
                    await actions.move({x: 100 + Math.random() * 500, y: 100 + Math.random() * 300}).perform();
                }
                
                await driver.sleep(2000); // 额外等待
            }
        } catch (e) {
            // 忽略错误
        }
    }

    async scrapeArticle(url) {
        console.log('[MyGolfSpy Selenium] 开始抓取:', url);
        
        const driver = await this.createDriver();
        
        try {
            // 先访问主页
            console.log('[MyGolfSpy Selenium] 访问主页建立会话...');
            await driver.get('https://mygolfspy.com/');
            await this.loadCookies(driver);
            await driver.navigate().refresh();
            
            await this.waitForCloudflare(driver);
            await driver.sleep(2000);
            
            // 访问目标文章
            console.log('[MyGolfSpy Selenium] 访问目标文章...');
            await driver.get(url);
            
            await this.waitForCloudflare(driver);
            
            // 等待内容加载
            await driver.wait(until.elementLocated(By.css('.entry-content, .post-content, article')), 30000);
            await driver.sleep(2000);
            
            // 获取页面HTML
            const pageSource = await driver.getPageSource();
            const $ = cheerio.load(pageSource);
            
            // 提取内容
            const title = $('h1.entry-title, h1.post-title, h1.article-title, .entry-header h1, article h1').first().text().trim() || 'MyGolfSpy Article';
            
            const contentElement = $('.entry-content, .post-content, .article-content, article .content').first();
            
            if (!contentElement.length) {
                throw new Error('找不到文章内容');
            }
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            contentElement.find('p, h2, h3, h4, ul, ol, blockquote, img, figure').each(function() {
                const elem = $(this);
                const tagName = this.tagName.toUpperCase();
                
                if (tagName === 'P') {
                    const text = elem.text().trim();
                    if (text.length > 20 && !text.includes('Advertisement')) {
                        content += `${text}\n\n`;
                    }
                } else if (tagName === 'H2') {
                    content += `\n## ${elem.text().trim()}\n\n`;
                } else if (tagName === 'H3' || tagName === 'H4') {
                    content += `\n### ${elem.text().trim()}\n\n`;
                } else if (tagName === 'UL' || tagName === 'OL') {
                    elem.find('li').each(function() {
                        content += `• ${$(this).text().trim()}\n`;
                    });
                    content += '\n';
                } else if (tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.text().trim()}\n\n`;
                } else if (tagName === 'IMG' || tagName === 'FIGURE') {
                    const img = tagName === 'FIGURE' ? elem.find('img').first() : elem;
                    if (img.length > 0) {
                        const src = img.attr('src');
                        const alt = img.attr('alt') || `图片${imageCounter + 1}`;
                        
                        if (src && !src.includes('logo') && !src.includes('avatar')) {
                            imageCounter++;
                            images.push({ url: src, alt });
                            content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                        }
                    }
                }
            });
            
            // 保存cookies
            await this.saveCookies(driver);
            
            if (content.length < 200) {
                throw new Error('抓取到的内容太少');
            }
            
            return { title, content, images, url };
            
        } finally {
            await driver.quit();
        }
    }
}

module.exports = MyGolfSpySeleniumScraper;