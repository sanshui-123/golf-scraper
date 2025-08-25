const { chromium } = require('playwright');

async function testGolfWRXCategories() {
    console.log('🔍 测试 GolfWRX 分类页面...\n');
    
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        ]
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        // 添加stealth模式
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        // 测试不同的分类页面
        const categories = [
            { name: 'Equipment', url: 'https://www.golfwrx.com/category/equipment/' },
            { name: 'News', url: 'https://www.golfwrx.com/category/news/' },
            { name: 'Instruction', url: 'https://www.golfwrx.com/category/instruction/' },
            { name: 'Equipment News', url: 'https://www.golfwrx.com/category/equipment/equipment-news/' },
            { name: 'Tour', url: 'https://www.golfwrx.com/category/tour/' }
        ];
        
        for (const category of categories) {
            console.log(`\n📡 测试 ${category.name} 分类...`);
            console.log(`URL: ${category.url}`);
            
            try {
                await page.goto(category.url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                
                // 等待页面加载
                await page.waitForTimeout(5000);
                
                // 检查是否有Cloudflare
                const pageContent = await page.content();
                if (pageContent.includes('Cloudflare')) {
                    console.log('⚠️  检测到Cloudflare保护');
                    await page.waitForTimeout(10000);
                }
                
                // 查找文章
                const articles = await page.evaluate(() => {
                    const items = [];
                    const links = document.querySelectorAll('a[href*="/20"]');
                    const processedUrls = new Set();
                    
                    links.forEach(link => {
                        const url = link.href;
                        const title = link.textContent.trim();
                        
                        if (url && title && 
                            !url.includes('/page/') && 
                            !url.includes('/category/') &&
                            title.length > 10 &&
                            !processedUrls.has(url)) {
                            
                            processedUrls.add(url);
                            items.push({ url, title });
                        }
                    });
                    
                    return items.slice(0, 5); // 只返回前5个
                });
                
                if (articles.length > 0) {
                    console.log(`✅ 找到 ${articles.length} 篇文章:`);
                    articles.forEach((article, index) => {
                        console.log(`   ${index + 1}. ${article.title.substring(0, 50)}...`);
                    });
                } else {
                    console.log('❌ 未找到文章');
                }
                
                // 截图
                await page.screenshot({ 
                    path: `golfwrx_${category.name.toLowerCase().replace(' ', '_')}.png`,
                    fullPage: false 
                });
                
            } catch (error) {
                console.log(`❌ 访问失败: ${error.message}`);
            }
        }
        
        console.log('\n✅ 测试完成！');
        console.log('⏸️  按 Ctrl+C 关闭浏览器...');
        await page.waitForTimeout(300000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

testGolfWRXCategories();