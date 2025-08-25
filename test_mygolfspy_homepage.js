#!/usr/bin/env node

/**
 * MyGolfSpy.com 首页分析
 * 获取首页文章链接并分析其中一篇
 */

const { chromium } = require('playwright');

async function analyzeHomepage() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('📝 分析 MyGolfSpy.com 首页...');
        
        // 访问网站首页
        await page.goto('https://mygolfspy.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 等待页面加载完成
        await page.waitForTimeout(5000);
        
        // 获取首页所有文章链接
        const articleLinks = await page.evaluate(() => {
            const links = [];
            const allLinks = document.querySelectorAll('a[href]');
            
            allLinks.forEach(link => {
                const href = link.href;
                // 过滤出文章链接
                if (href && href.includes('mygolfspy.com') && 
                    !href.includes('wp-content') && 
                    !href.includes('wp-admin') &&
                    !href.includes('#') &&
                    !href.includes('mailto:') &&
                    !href.includes('tel:') &&
                    !href.includes('javascript:') &&
                    href !== 'https://mygolfspy.com/' &&
                    href.length > 25) {
                    
                    const title = link.textContent.trim();
                    if (title && title.length > 10) {
                        links.push({
                            url: href,
                            title: title
                        });
                    }
                }
            });
            
            // 去重
            const uniqueLinks = [];
            const seen = new Set();
            
            links.forEach(link => {
                if (!seen.has(link.url)) {
                    seen.add(link.url);
                    uniqueLinks.push(link);
                }
            });
            
            return uniqueLinks;
        });
        
        console.log(`\n找到 ${articleLinks.length} 个文章链接：`);
        articleLinks.slice(0, 10).forEach((link, index) => {
            console.log(`${index + 1}. ${link.title}`);
            console.log(`   ${link.url}`);
            console.log('');
        });
        
        // 分析第一篇文章
        if (articleLinks.length > 0) {
            const firstArticle = articleLinks[0];
            console.log(`\n🔍 分析文章: ${firstArticle.title}`);
            console.log(`URL: ${firstArticle.url}`);
            
            try {
                await page.goto(firstArticle.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(5000);
                
                // 检查页面是否是404
                const isNotFound = await page.evaluate(() => {
                    const title = document.title.toLowerCase();
                    const body = document.body.textContent.toLowerCase();
                    return title.includes('404') || title.includes('not found') || 
                           body.includes('uh oh') || body.includes('lost this one');
                });
                
                if (isNotFound) {
                    console.log('❌ 这个页面是404，尝试下一个...');
                    
                    // 尝试第二篇文章
                    if (articleLinks.length > 1) {
                        const secondArticle = articleLinks[1];
                        console.log(`\n🔍 分析文章: ${secondArticle.title}`);
                        console.log(`URL: ${secondArticle.url}`);
                        
                        await page.goto(secondArticle.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await page.waitForTimeout(5000);
                    }
                }
                
                // 分析当前页面结构
                const pageStructure = await page.evaluate(() => {
                    const result = {
                        title: document.title,
                        h1: '',
                        content: '',
                        images: [],
                        possibleSelectors: {
                            title: [],
                            content: [],
                            images: []
                        }
                    };
                    
                    // 获取H1标题
                    const h1 = document.querySelector('h1');
                    if (h1) {
                        result.h1 = h1.textContent.trim();
                    }
                    
                    // 分析标题选择器
                    const titleSelectors = [
                        'h1.entry-title',
                        'h1.post-title', 
                        'h1.article-title',
                        '.entry-header h1',
                        '.post-header h1',
                        'h1'
                    ];
                    
                    titleSelectors.forEach(selector => {
                        const el = document.querySelector(selector);
                        if (el) {
                            result.possibleSelectors.title.push({
                                selector: selector,
                                text: el.textContent.trim().substring(0, 80),
                                className: el.className
                            });
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
                        'main .content',
                        '.single-post-content',
                        '.post .content'
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
                                result.content = text.substring(0, 300) + '...';
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
                        'picture img',
                        '.content img',
                        '.post img'
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
                    
                    // 获取所有图片信息
                    const allImages = document.querySelectorAll('img');
                    allImages.forEach((img, index) => {
                        if (index < 10) { // 只分析前10张图片
                            const width = img.width || parseInt(img.getAttribute('width')) || 0;
                            const height = img.height || parseInt(img.getAttribute('height')) || 0;
                            
                            // 过滤掉明显的图标和小图片
                            if (width > 100 || height > 100 || width === 0) {
                                result.images.push({
                                    src: img.src,
                                    alt: img.alt || '',
                                    width: width,
                                    height: height,
                                    className: img.className,
                                    hasDataSrc: !!img.dataset.src,
                                    srcset: img.srcset || '',
                                    parentTag: img.parentElement.tagName.toLowerCase(),
                                    parentClass: img.parentElement.className
                                });
                            }
                        }
                    });
                    
                    return result;
                });
                
                console.log('\n📋 页面结构分析：');
                console.log(`页面标题: ${pageStructure.title}`);
                console.log(`H1标题: ${pageStructure.h1}`);
                console.log(`内容预览: ${pageStructure.content}`);
                console.log(`图片数量: ${pageStructure.images.length}`);
                
                console.log('\n🎯 推荐的选择器：');
                console.log('标题选择器：');
                pageStructure.possibleSelectors.title.forEach(sel => {
                    console.log(`  ${sel.selector} - "${sel.text}"`);
                });
                
                console.log('\n内容选择器：');
                pageStructure.possibleSelectors.content.forEach(sel => {
                    console.log(`  ${sel.selector} - 长度: ${sel.textLength}, 图片: ${sel.hasImages}`);
                });
                
                console.log('\n图片选择器：');
                pageStructure.possibleSelectors.images.forEach(sel => {
                    console.log(`  ${sel.selector} - 数量: ${sel.count}`);
                });
                
                console.log('\n🖼️ 图片分析：');
                pageStructure.images.forEach((img, index) => {
                    console.log(`${index + 1}. ${img.src}`);
                    console.log(`   尺寸: ${img.width}x${img.height}`);
                    console.log(`   alt: ${img.alt}`);
                    console.log(`   父元素: ${img.parentTag}`);
                    console.log('');
                });
                
            } catch (error) {
                console.error('访问文章页面失败:', error);
            }
        }
        
    } catch (error) {
        console.error('分析过程中出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行分析
analyzeHomepage().catch(console.error);