const { chromium } = require('playwright');

async function testGolfWRXStructure() {
    console.log('🔍 测试 GolfWRX 页面结构...\n');
    
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        ]
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        // 添加stealth模式
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        console.log('📡 访问 GolfWRX 首页...');
        await page.goto('https://www.golfwrx.com', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // 等待页面加载
        await page.waitForTimeout(10000);
        
        console.log('✅ 页面加载完成\n');
        
        // 检查是否有Cloudflare
        const pageContent = await page.content();
        if (pageContent.includes('Cloudflare')) {
            console.log('⚠️  检测到Cloudflare保护\n');
            // 等待更长时间让Cloudflare验证通过
            await page.waitForTimeout(15000);
        }
        
        // 尝试各种可能的选择器
        console.log('🔍 查找文章元素...\n');
        
        const selectors = [
            // 常见的文章容器选择器
            'article',
            '.post',
            '.entry',
            '.article-item',
            '.news-item',
            '.story',
            '.content-item',
            // TD主题相关
            '.td_module_wrap',
            '.td-block-span6',
            '.td_module_10',
            '.td-post-content',
            // 其他可能的选择器
            '.wp-block-post',
            '.blog-post',
            '.article-preview',
            '[class*="article"]',
            '[class*="post"]',
            '[class*="entry"]'
        ];
        
        for (const selector of selectors) {
            const count = await page.$$eval(selector, elements => elements.length);
            if (count > 0) {
                console.log(`✅ 找到 ${count} 个 "${selector}" 元素`);
                
                // 获取第一个元素的详细信息
                const info = await page.$$eval(selector, (elements) => {
                    const el = elements[0];
                    return {
                        className: el.className,
                        innerHTML: el.innerHTML.substring(0, 200) + '...',
                        hasLink: !!el.querySelector('a'),
                        linkHref: el.querySelector('a')?.href
                    };
                });
                
                console.log(`   类名: ${info.className}`);
                console.log(`   包含链接: ${info.hasLink ? '是' : '否'}`);
                if (info.linkHref) {
                    console.log(`   链接: ${info.linkHref}`);
                }
                console.log('');
            }
        }
        
        // 查找所有包含链接的元素
        console.log('\n🔍 查找所有文章链接...\n');
        const links = await page.$$eval('a[href*="/20"]', links => 
            links.slice(0, 10).map(link => ({
                href: link.href,
                text: link.textContent.trim(),
                parent: link.parentElement?.className
            }))
        );
        
        if (links.length > 0) {
            console.log(`✅ 找到 ${links.length} 个可能的文章链接:\n`);
            links.forEach((link, index) => {
                console.log(`${index + 1}. ${link.text || '无标题'}`);
                console.log(`   URL: ${link.href}`);
                console.log(`   父元素类: ${link.parent || '无'}\n`);
            });
        }
        
        // 截图保存
        await page.screenshot({ path: 'golfwrx_structure_test.png', fullPage: false });
        console.log('📸 已保存页面截图: golfwrx_structure_test.png\n');
        
        // 等待用户查看
        console.log('⏸️  按 Ctrl+C 关闭浏览器...');
        await page.waitForTimeout(300000); // 等待5分钟
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

testGolfWRXStructure();