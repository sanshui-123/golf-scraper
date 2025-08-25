const { chromium } = require('playwright');
const fs = require('fs');

async function testGolfWRXExtraction() {
    console.log('🧪 测试 GolfWRX 内容提取...\n');
    
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
        
        // 添加反检测脚本
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
        
        // 等待页面加载
        await page.waitForTimeout(10000);
        
        // 检查Cloudflare
        const pageContent = await page.content();
        if (pageContent.includes('Cloudflare')) {
            console.log('⚠️  检测到Cloudflare保护，等待...');
            await page.waitForTimeout(15000);
        }
        
        console.log('✅ 页面加载完成\n');
        
        // 使用更新后的提取逻辑
        const extractedContent = await page.evaluate(() => {
            const result = {
                title: '',
                content: '',
                images: [],
                removedElements: []
            };
            
            // 获取标题
            const titleElement = document.querySelector('h1.entry-title, h1.mvp-post-title, h1.td-post-title, h1');
            if (titleElement) {
                result.title = titleElement.textContent.trim();
            }
            
            // 获取内容容器 - GolfWRX使用#mvp-content-body
            const contentContainer = document.querySelector('#mvp-content-body, .mvp-content-body, .entry-content, .td-post-content');
            if (!contentContainer) return result;
            
            // 克隆容器以便修改
            const workingContainer = contentContainer.cloneNode(true);
            
            // 移除不需要的元素
            const removeSelectors = [
                '.yarpp-related',
                '.wp-block-latest-posts',
                '.mvp-related-posts',
                '.related-articles',
                '.trending-posts',
                '.recommended-posts',
                '.also-read',
                '.read-more-articles',
                '.mvp-post-add-box',
                '.mvp-post-soc-wrap',
                '.wp-block-group',
                '.inline-related',
                '.td-related-posts',
                '.td-post-next-prev',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            removeSelectors.forEach(selector => {
                const elements = workingContainer.querySelectorAll(selector);
                elements.forEach(el => {
                    result.removedElements.push({
                        selector: selector,
                        content: el.textContent.substring(0, 50) + '...'
                    });
                    el.remove();
                });
            });
            
            // 提取文本内容（移除超链接）
            const paragraphs = workingContainer.querySelectorAll('p');
            const textParts = [];
            
            paragraphs.forEach(p => {
                // 移除所有链接，保留文本
                p.querySelectorAll('a').forEach(a => {
                    const textNode = document.createTextNode(a.textContent);
                    a.parentNode.replaceChild(textNode, a);
                });
                
                const text = p.textContent.trim();
                if (text.length > 20) {
                    textParts.push(text);
                }
            });
            
            result.content = textParts.join('\n\n');
            
            // 提取图片
            const images = workingContainer.querySelectorAll('img');
            images.forEach((img, index) => {
                const src = img.src || img.getAttribute('data-src');
                if (src && 
                    !src.includes('avatar') && 
                    !src.includes('logo') && 
                    !src.includes('banner') &&
                    (img.width > 100 || !img.width)) {
                    result.images.push({
                        index: index + 1,
                        src: src,
                        alt: img.alt || '',
                        width: img.width,
                        height: img.height
                    });
                }
            });
            
            return result;
        });
        
        console.log('📄 提取结果:');
        console.log(`\n标题: ${extractedContent.title}`);
        console.log(`\n内容长度: ${extractedContent.content.length} 字符`);
        console.log(`内容预览:\n${extractedContent.content.substring(0, 500)}...`);
        
        console.log(`\n🖼️  找到图片: ${extractedContent.images.length} 张`);
        extractedContent.images.forEach(img => {
            console.log(`  ${img.index}. ${img.src}`);
            if (img.alt) console.log(`     Alt: ${img.alt}`);
            console.log(`     尺寸: ${img.width}x${img.height}`);
        });
        
        if (extractedContent.removedElements.length > 0) {
            console.log(`\n🗑️  已移除的元素: ${extractedContent.removedElements.length} 个`);
            const uniqueSelectors = [...new Set(extractedContent.removedElements.map(e => e.selector))];
            console.log(`  选择器: ${uniqueSelectors.join(', ')}`);
        }
        
        // 保存提取的内容到文件
        const output = {
            url: articleUrl,
            title: extractedContent.title,
            contentLength: extractedContent.content.length,
            imageCount: extractedContent.images.length,
            images: extractedContent.images,
            contentPreview: extractedContent.content.substring(0, 1000)
        };
        
        fs.writeFileSync('golfwrx_extraction_result.json', JSON.stringify(output, null, 2));
        console.log('\n💾 结果已保存到 golfwrx_extraction_result.json');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

testGolfWRXExtraction();