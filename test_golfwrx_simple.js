const { chromium } = require('playwright');
const fs = require('fs');

async function testGolfWRXSimple() {
    console.log('🧪 简单测试 GolfWRX 内容提取...\n');
    
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security'
        ]
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        // 添加反检测脚本
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            delete navigator.__proto__.webdriver;
        });
        
        const articleUrl = 'https://www.golfwrx.com/759308/2025-best-irons-best-blades/';
        
        console.log('📡 访问文章页面...');
        await page.goto(articleUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // 等待页面稳定
        await page.waitForTimeout(5000);
        
        // 检查页面状态
        const pageTitle = await page.title();
        console.log(`📄 页面标题: ${pageTitle}`);
        
        // 测试内容提取
        const content = await page.evaluate(() => {
            // 查找内容容器
            const container = document.querySelector('#mvp-content-body');
            if (!container) {
                return { error: '未找到内容容器 #mvp-content-body' };
            }
            
            // 提取段落
            const paragraphs = [];
            container.querySelectorAll('p').forEach(p => {
                const text = p.textContent.trim();
                if (text.length > 20) {
                    paragraphs.push(text);
                }
            });
            
            // 提取图片
            const images = [];
            container.querySelectorAll('img').forEach(img => {
                if (img.src && img.width > 100) {
                    images.push({
                        src: img.src,
                        alt: img.alt || '',
                        width: img.width,
                        height: img.height
                    });
                }
            });
            
            return {
                paragraphCount: paragraphs.length,
                imageCount: images.length,
                firstParagraph: paragraphs[0] || '',
                totalLength: paragraphs.join(' ').length
            };
        });
        
        console.log('\n✅ 提取结果:');
        if (content.error) {
            console.log(`❌ 错误: ${content.error}`);
        } else {
            console.log(`📝 段落数: ${content.paragraphCount}`);
            console.log(`🖼️  图片数: ${content.imageCount}`);
            console.log(`📏 总长度: ${content.totalLength} 字符`);
            console.log(`📄 首段预览: ${content.firstParagraph?.substring(0, 100)}...`);
        }
        
        // 保存页面HTML用于调试
        const html = await page.content();
        fs.writeFileSync('golfwrx_page_debug.html', html);
        console.log('\n💾 页面HTML已保存到 golfwrx_page_debug.html');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

testGolfWRXSimple();