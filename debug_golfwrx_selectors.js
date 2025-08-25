const { chromium } = require('playwright');

async function debugGolfWRXSelectors() {
    console.log('🔍 调试 GolfWRX 选择器...\n');
    
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        const articleUrl = 'https://www.golfwrx.com/759308/2025-best-irons-best-blades/';
        
        console.log('📡 访问文章页面...');
        await page.goto(articleUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        await page.waitForTimeout(10000);
        
        console.log('✅ 页面加载完成\n');
        
        // 调试选择器
        const debug = await page.evaluate(() => {
            const result = {
                possibleContentSelectors: [],
                foundImages: [],
                pageStructure: {}
            };
            
            // 测试各种可能的内容选择器
            const contentSelectors = [
                '.entry-content',
                '.mvp-content-body',
                '.td-post-content',
                '.post-content',
                '.article-content',
                '.content-area',
                '.the-content',
                '#mvp-content-body',
                '#mvp-content-main',
                '.the-content-wrap',
                'article .content',
                'article',
                'main',
                '.single-content',
                '.post-body'
            ];
            
            contentSelectors.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    const paragraphs = element.querySelectorAll('p').length;
                    const images = element.querySelectorAll('img').length;
                    const textLength = element.textContent.trim().length;
                    
                    result.possibleContentSelectors.push({
                        selector: selector,
                        exists: true,
                        paragraphs: paragraphs,
                        images: images,
                        textLength: textLength,
                        firstParagraph: element.querySelector('p')?.textContent.substring(0, 100) + '...'
                    });
                }
            });
            
            // 查找所有图片
            document.querySelectorAll('img').forEach(img => {
                if (img.src && img.width > 50) {
                    result.foundImages.push({
                        src: img.src,
                        alt: img.alt,
                        width: img.width,
                        height: img.height,
                        parent: img.parentElement?.tagName,
                        parentClass: img.parentElement?.className
                    });
                }
            });
            
            // 获取页面结构信息
            result.pageStructure = {
                hasArticleTag: !!document.querySelector('article'),
                hasMainTag: !!document.querySelector('main'),
                bodyClasses: document.body.className,
                possibleArticleContainers: []
            };
            
            // 查找可能包含文章内容的容器
            const containers = document.querySelectorAll('[class*="content"], [class*="post"], [class*="article"], [id*="content"], [id*="post"]');
            containers.forEach(container => {
                if (container.querySelectorAll('p').length > 2) {
                    result.pageStructure.possibleArticleContainers.push({
                        tagName: container.tagName,
                        className: container.className,
                        id: container.id,
                        paragraphCount: container.querySelectorAll('p').length
                    });
                }
            });
            
            return result;
        });
        
        console.log('📊 调试结果:\n');
        
        console.log('可能的内容选择器:');
        debug.possibleContentSelectors.forEach(selector => {
            console.log(`\n  ${selector.selector}:`);
            console.log(`    - 段落数: ${selector.paragraphs}`);
            console.log(`    - 图片数: ${selector.images}`);
            console.log(`    - 文本长度: ${selector.textLength}`);
            if (selector.firstParagraph) {
                console.log(`    - 首段预览: ${selector.firstParagraph}`);
            }
        });
        
        console.log('\n\n找到的图片:');
        debug.foundImages.forEach((img, index) => {
            console.log(`  ${index + 1}. ${img.src}`);
            console.log(`     尺寸: ${img.width}x${img.height}`);
            console.log(`     父元素: <${img.parent}> class="${img.parentClass}"`);
        });
        
        console.log('\n\n页面结构:');
        console.log(`  - 有<article>标签: ${debug.pageStructure.hasArticleTag}`);
        console.log(`  - 有<main>标签: ${debug.pageStructure.hasMainTag}`);
        console.log(`  - body类名: ${debug.pageStructure.bodyClasses}`);
        
        if (debug.pageStructure.possibleArticleContainers.length > 0) {
            console.log('\n  可能的文章容器:');
            debug.pageStructure.possibleArticleContainers.forEach(container => {
                console.log(`    - <${container.tagName}> id="${container.id}" class="${container.className}" (${container.paragraphCount}个段落)`);
            });
        }
        
        // 保存页面截图
        await page.screenshot({ path: 'golfwrx_debug.png', fullPage: false });
        console.log('\n📸 已保存调试截图: golfwrx_debug.png');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

debugGolfWRXSelectors();