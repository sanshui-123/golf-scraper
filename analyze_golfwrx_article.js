const { chromium } = require('playwright');

async function analyzeGolfWRXArticle() {
    console.log('🔍 分析 GolfWRX 文章页面结构...\n');
    
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
        
        // 分析文章结构
        const articleInfo = await page.evaluate(() => {
            const info = {
                title: '',
                mainContent: '',
                contentSelectors: [],
                imageInfo: [],
                relatedContent: []
            };
            
            // 查找标题
            const titleSelectors = [
                'h1.entry-title',
                'h1.mvp-post-title',
                'h1.td-post-title',
                '.single-post h1',
                'h1'
            ];
            
            for (const selector of titleSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    info.title = el.textContent.trim();
                    console.log(`标题选择器: ${selector}`);
                    break;
                }
            }
            
            // 查找主要内容容器
            const contentSelectors = [
                '.entry-content',
                '.mvp-content-body',
                '.td-post-content',
                '.post-content',
                '.article-content',
                '.single-content',
                'article .content'
            ];
            
            for (const selector of contentSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    info.contentSelectors.push(selector);
                    
                    // 获取段落文本（不包含链接）
                    const paragraphs = el.querySelectorAll('p');
                    const textContent = [];
                    paragraphs.forEach(p => {
                        // 克隆节点以便移除链接
                        const clonedP = p.cloneNode(true);
                        // 移除所有链接
                        clonedP.querySelectorAll('a').forEach(a => a.remove());
                        const text = clonedP.textContent.trim();
                        if (text) {
                            textContent.push(text);
                        }
                    });
                    info.mainContent = textContent.join('\n\n');
                    
                    // 查找图片
                    const images = el.querySelectorAll('img');
                    images.forEach(img => {
                        const src = img.src || img.getAttribute('data-src');
                        const alt = img.alt || '';
                        if (src && !src.includes('avatar') && !src.includes('logo')) {
                            info.imageInfo.push({
                                src: src,
                                alt: alt,
                                width: img.width,
                                height: img.height
                            });
                        }
                    });
                    
                    break;
                }
            }
            
            // 查找相关内容（需要排除）
            const relatedSelectors = [
                '.related-posts',
                '.mvp-related-posts',
                '.td-post-next-prev',
                '.yarpp-related',
                '.wp-block-latest-posts'
            ];
            
            relatedSelectors.forEach(selector => {
                if (document.querySelector(selector)) {
                    info.relatedContent.push(selector);
                }
            });
            
            return info;
        });
        
        console.log('📄 文章信息:');
        console.log(`标题: ${articleInfo.title}`);
        console.log(`\n内容选择器找到: ${articleInfo.contentSelectors.join(', ')}`);
        console.log(`\n主要内容长度: ${articleInfo.mainContent.length} 字符`);
        console.log(`内容预览: ${articleInfo.mainContent.substring(0, 200)}...`);
        console.log(`\n找到图片: ${articleInfo.imageInfo.length} 张`);
        articleInfo.imageInfo.forEach((img, index) => {
            console.log(`  ${index + 1}. ${img.src}`);
            console.log(`     Alt: ${img.alt}`);
            console.log(`     尺寸: ${img.width}x${img.height}`);
        });
        
        if (articleInfo.relatedContent.length > 0) {
            console.log(`\n需要排除的相关内容选择器: ${articleInfo.relatedContent.join(', ')}`);
        }
        
        // 测试清理后的内容提取
        console.log('\n📝 测试优化的内容提取...');
        const cleanContent = await page.evaluate(() => {
            // 查找主内容容器
            const contentEl = document.querySelector('.entry-content, .mvp-content-body, .td-post-content');
            if (!contentEl) return null;
            
            // 克隆内容以便修改
            const clonedContent = contentEl.cloneNode(true);
            
            // 移除不需要的元素
            const removeSelectors = [
                'script',
                'style',
                '.related-posts',
                '.social-share',
                '.newsletter-signup',
                '.advertisement',
                '.wp-block-latest-posts',
                '.yarpp-related'
            ];
            
            removeSelectors.forEach(selector => {
                clonedContent.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // 提取纯文本（移除所有链接）
            clonedContent.querySelectorAll('a').forEach(a => {
                const text = a.textContent;
                const textNode = document.createTextNode(text);
                a.parentNode.replaceChild(textNode, a);
            });
            
            return {
                text: clonedContent.textContent.trim(),
                html: clonedContent.innerHTML
            };
        });
        
        if (cleanContent) {
            console.log(`\n清理后的内容长度: ${cleanContent.text.length} 字符`);
            console.log(`预览: ${cleanContent.text.substring(0, 300)}...`);
        }
        
        // 保存页面截图
        await page.screenshot({ path: 'golfwrx_article_structure.png', fullPage: false });
        console.log('\n📸 已保存页面截图: golfwrx_article_structure.png');
        
        console.log('\n⏸️  按 Ctrl+C 关闭浏览器...');
        await page.waitForTimeout(300000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

analyzeGolfWRXArticle();