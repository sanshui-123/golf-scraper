#!/usr/bin/env node

/**
 * MyGolfSpy.com 网站结构分析工具
 * 分析网站的HTML结构、图片格式和内容组织方式
 */

const { chromium } = require('playwright');

async function analyzeMygolfspy() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('📝 分析 MyGolfSpy.com 网站结构...');
        
        // 访问网站首页
        await page.goto('https://mygolfspy.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 等待页面加载完成
        await page.waitForTimeout(3000);
        
        // 分析文章列表结构
        console.log('\n📊 分析文章列表结构：');
        const articleListInfo = await page.evaluate(() => {
            const articles = [];
            
            // 尝试不同的文章容器选择器
            const selectors = [
                '.post-item',
                '.article-item', 
                '.card',
                '.entry',
                '.post',
                'article',
                '.content-item',
                '.story-card',
                '.listing-item'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`找到 ${elements.length} 个 ${selector} 元素`);
                    
                    elements.forEach((el, index) => {
                        if (index < 3) { // 只分析前3个元素
                            const links = el.querySelectorAll('a[href]');
                            const title = el.querySelector('h1, h2, h3, .title, .headline');
                            const time = el.querySelector('time, .date, .published');
                            
                            if (links.length > 0) {
                                articles.push({
                                    selector: selector,
                                    href: links[0].href,
                                    title: title ? title.textContent.trim() : '无标题',
                                    time: time ? time.textContent.trim() : '无时间',
                                    className: el.className
                                });
                            }
                        }
                    });
                }
            });
            
            return articles;
        });
        
        console.log('文章列表信息：');
        articleListInfo.forEach((article, index) => {
            console.log(`${index + 1}. [${article.selector}] ${article.title}`);
            console.log(`   链接: ${article.href}`);
            console.log(`   类名: ${article.className}`);
            console.log(`   时间: ${article.time}`);
            console.log('');
        });
        
        // 选择一篇文章进行详细分析
        if (articleListInfo.length > 0) {
            const firstArticle = articleListInfo[0];
            console.log(`\n🔍 分析文章页面结构: ${firstArticle.title}`);
            console.log(`访问链接: ${firstArticle.href}`);
            
            await page.goto(firstArticle.href, { waitUntil: 'networkidle', timeout: 30000 });
            
            // 分析文章页面结构
            const articleStructure = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    images: [],
                    possibleSelectors: {
                        title: [],
                        content: [],
                        images: []
                    }
                };
                
                // 分析标题选择器
                const titleSelectors = [
                    'h1.entry-title',
                    'h1.post-title', 
                    'h1.article-title',
                    'h1.title',
                    '.entry-header h1',
                    '.article-header h1',
                    '.post-header h1',
                    'h1'
                ];
                
                titleSelectors.forEach(selector => {
                    const el = document.querySelector(selector);
                    if (el) {
                        result.possibleSelectors.title.push({
                            selector: selector,
                            text: el.textContent.trim().substring(0, 50),
                            className: el.className
                        });
                        if (!result.title) {
                            result.title = el.textContent.trim();
                        }
                    }
                });
                
                // 分析内容选择器
                const contentSelectors = [
                    '.entry-content',
                    '.post-content',
                    '.article-content',
                    '.content-area',
                    '.post-body',
                    '.article-body',
                    'main article',
                    '.single-post-content'
                ];
                
                contentSelectors.forEach(selector => {
                    const el = document.querySelector(selector);
                    if (el) {
                        const text = el.textContent.trim();
                        result.possibleSelectors.content.push({
                            selector: selector,
                            textLength: text.length,
                            className: el.className,
                            hasImages: el.querySelectorAll('img').length
                        });
                        if (!result.content && text.length > 100) {
                            result.content = text.substring(0, 200) + '...';
                        }
                    }
                });
                
                // 分析图片选择器
                const imageSelectors = [
                    '.entry-content img',
                    '.post-content img',
                    '.article-content img',
                    '.content-area img',
                    '.post-body img',
                    'article img',
                    '.wp-block-image img',
                    'figure img',
                    'picture img'
                ];
                
                imageSelectors.forEach(selector => {
                    const imgs = document.querySelectorAll(selector);
                    if (imgs.length > 0) {
                        result.possibleSelectors.images.push({
                            selector: selector,
                            count: imgs.length
                        });
                    }
                });
                
                // 获取所有图片的详细信息
                const allImages = document.querySelectorAll('img');
                allImages.forEach((img, index) => {
                    if (index < 10) { // 只分析前10张图片
                        const width = img.width || parseInt(img.getAttribute('width')) || 0;
                        const height = img.height || parseInt(img.getAttribute('height')) || 0;
                        
                        result.images.push({
                            src: img.src,
                            alt: img.alt || '',
                            width: width,
                            height: height,
                            className: img.className,
                            hasDataSrc: !!img.dataset.src,
                            srcset: img.srcset || '',
                            parentTag: img.parentElement.tagName.toLowerCase()
                        });
                    }
                });
                
                return result;
            });
            
            console.log('\n📋 文章页面结构分析：');
            console.log(`标题: ${articleStructure.title}`);
            console.log(`内容预览: ${articleStructure.content}`);
            console.log(`图片数量: ${articleStructure.images.length}`);
            
            console.log('\n🎯 推荐的选择器：');
            console.log('标题选择器：');
            articleStructure.possibleSelectors.title.forEach(sel => {
                console.log(`  ${sel.selector} - "${sel.text}"`);
            });
            
            console.log('\n内容选择器：');
            articleStructure.possibleSelectors.content.forEach(sel => {
                console.log(`  ${sel.selector} - 长度: ${sel.textLength}, 图片: ${sel.hasImages}`);
            });
            
            console.log('\n图片选择器：');
            articleStructure.possibleSelectors.images.forEach(sel => {
                console.log(`  ${sel.selector} - 数量: ${sel.count}`);
            });
            
            console.log('\n🖼️ 图片分析：');
            articleStructure.images.forEach((img, index) => {
                console.log(`${index + 1}. ${img.src}`);
                console.log(`   尺寸: ${img.width}x${img.height}`);
                console.log(`   alt: ${img.alt}`);
                console.log(`   父元素: ${img.parentTag}`);
                console.log(`   懒加载: ${img.hasDataSrc ? '是' : '否'}`);
                console.log(`   srcset: ${img.srcset ? '有' : '无'}`);
                console.log('');
            });
            
            // 检查图片格式
            console.log('\n🔍 检查图片格式支持：');
            const imageFormatTest = await page.evaluate(async () => {
                const testImages = document.querySelectorAll('img');
                const formatInfo = [];
                
                for (let i = 0; i < Math.min(5, testImages.length); i++) {
                    const img = testImages[i];
                    try {
                        const response = await fetch(img.src, { method: 'HEAD' });
                        const contentType = response.headers.get('content-type');
                        formatInfo.push({
                            url: img.src,
                            contentType: contentType,
                            status: response.status
                        });
                    } catch (e) {
                        formatInfo.push({
                            url: img.src,
                            error: e.message
                        });
                    }
                }
                
                return formatInfo;
            });
            
            imageFormatTest.forEach((info, index) => {
                console.log(`${index + 1}. ${info.contentType || 'unknown'} - ${info.status || 'error'}`);
                console.log(`   ${info.url}`);
                if (info.error) {
                    console.log(`   错误: ${info.error}`);
                }
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('分析过程中出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行分析
analyzeMygolfspy().catch(console.error);