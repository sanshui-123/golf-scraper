#!/usr/bin/env node

/**
 * 检查GolfWRX文章中的图片
 */

const { chromium } = require('playwright');

async function checkArticleImages(url) {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log(`\n🔍 检查文章: ${url}`);
        
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // 等待页面完全加载
        await page.waitForTimeout(5000);
        
        // 查找文章内容区域的所有图片
        const imageInfo = await page.evaluate(() => {
            const contentSelectors = [
                '#mvp-content-body',
                '.mvp-content-body', 
                '.mvp-post-content',
                '.td-post-content',
                '.entry-content',
                '.single-post-content',
                '.the-content',
                'article',
                'main'
            ];
            
            let contentContainer = null;
            for (const selector of contentSelectors) {
                contentContainer = document.querySelector(selector);
                if (contentContainer) break;
            }
            
            if (!contentContainer) {
                contentContainer = document.body;
            }
            
            const images = contentContainer.querySelectorAll('img');
            const imageData = [];
            
            images.forEach((img, index) => {
                // 过滤明显的非内容图片
                if (!img.src.includes('avatar') && 
                    !img.src.includes('logo') &&
                    !img.classList.contains('avatar') &&
                    !img.closest('.yarpp-related') &&
                    !img.closest('.related-posts')) {
                    imageData.push({
                        index: index + 1,
                        src: img.src,
                        alt: img.alt || 'No alt text',
                        width: img.width,
                        height: img.height,
                        className: img.className,
                        parent: img.parentElement.tagName
                    });
                }
            });
            
            return {
                totalImages: images.length,
                contentImages: imageData,
                contentSelector: contentContainer.tagName + (contentContainer.id ? '#' + contentContainer.id : '') + (contentContainer.className ? '.' + contentContainer.className.split(' ')[0] : '')
            };
        });
        
        console.log(`\n📊 图片统计:`);
        console.log(`- 页面总图片数: ${imageInfo.totalImages}`);
        console.log(`- 内容区图片数: ${imageInfo.contentImages.length}`);
        console.log(`- 内容容器: ${imageInfo.contentSelector}`);
        
        if (imageInfo.contentImages.length > 0) {
            console.log(`\n📷 内容图片列表:`);
            imageInfo.contentImages.forEach((img, idx) => {
                console.log(`\n${idx + 1}. 图片 #${img.index}:`);
                console.log(`   URL: ${img.src}`);
                console.log(`   尺寸: ${img.width}x${img.height}`);
                console.log(`   Alt: ${img.alt}`);
                console.log(`   父元素: ${img.parent}`);
            });
        } else {
            console.log(`\n⚠️  文章内容区没有找到图片`);
        }
        
    } catch (error) {
        console.error('❌ 检查失败:', error.message);
    } finally {
        await page.waitForTimeout(5000); // 保持页面打开5秒以便查看
        await browser.close();
    }
}

// 测试两篇文章
async function runTests() {
    const urls = [
        'https://www.golfwrx.com/764751/blades-brown-witb-2025-august/',
        'https://www.golfwrx.com/764741/ian-poulter-blasts-himself-on-social-media-as-he-has-one-last-chance-to-avoid-liv-relegation/'
    ];
    
    for (const url of urls) {
        await checkArticleImages(url);
    }
}

runTests().catch(console.error);