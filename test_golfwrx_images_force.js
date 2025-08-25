#!/usr/bin/env node

/**
 * 强制测试GolfWRX图片抓取修复效果
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function testGolfWRXSingleArticle(url, articleNum) {
    const browser = await chromium.launch({ 
        headless: true
    });
    
    try {
        const page = await browser.newPage();
        
        console.log(`\n📄 处理文章 ${articleNum}: ${url}`);
        
        // 设置反检测
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        // 加载页面
        console.log('  ⏳ 加载页面...');
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // 等待内容加载
        await page.waitForTimeout(5000);
        
        // 检查Cloudflare
        const pageContent = await page.content();
        if (pageContent.includes('Cloudflare')) {
            console.log('  ⚠️ 检测到Cloudflare，等待验证...');
            await page.waitForTimeout(15000);
        }
        
        // 提取内容和图片
        const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText || '';
            
            // 查找内容容器
            const contentSelectors = [
                '#mvp-content-body',
                '.mvp-content-body',
                '.mvp-post-content',
                '.td-post-content',
                '.entry-content'
            ];
            
            let contentContainer = null;
            for (const selector of contentSelectors) {
                contentContainer = document.querySelector(selector);
                if (contentContainer) break;
            }
            
            if (!contentContainer) return { title, content: '', images: [] };
            
            // 移除相关文章等
            const removeSelectors = [
                '.yarpp-related',
                '.related-posts',
                '.mvp-related-posts',
                '.wp-block-group'
            ];
            
            removeSelectors.forEach(selector => {
                contentContainer.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // 收集图片
            const images = [];
            const imgElements = contentContainer.querySelectorAll('img');
            
            imgElements.forEach((img, index) => {
                // 过滤条件（修复后的版本）
                const isValid = (
                    img.src &&
                    !img.src.includes('avatar') &&
                    !img.src.includes('logo') &&
                    !img.src.includes('banner') &&
                    !img.src.includes('-150x') &&
                    !img.src.includes('x150') &&
                    !img.classList.contains('avatar') &&
                    !img.classList.contains('yarpp-thumbnail') &&
                    !img.closest('.yarpp-related') &&
                    !img.closest('.related-posts') &&
                    (img.width > 200 || !img.width)
                );
                
                if (isValid) {
                    images.push({
                        url: img.src,
                        alt: img.alt || `图片${index + 1}`,
                        width: img.width,
                        height: img.height
                    });
                }
            });
            
            // 收集文本内容
            const paragraphs = contentContainer.querySelectorAll('p');
            let content = '';
            paragraphs.forEach(p => {
                const text = p.innerText.trim();
                if (text) content += text + '\\n\\n';
            });
            
            return { title, content, images };
        });
        
        console.log(`  📊 抓取结果:`);
        console.log(`     标题: ${data.title}`);
        console.log(`     图片数量: ${data.images.length}`);
        
        if (data.images.length > 0) {
            console.log(`     图片列表:`);
            data.images.forEach((img, idx) => {
                console.log(`       ${idx + 1}. ${img.url.substring(img.url.lastIndexOf('/') + 1)} (${img.width}x${img.height})`);
            });
        }
        
        await page.close();
        
        return data;
        
    } catch (error) {
        console.error(`  ❌ 处理失败: ${error.message}`);
        return null;
    } finally {
        await browser.close();
    }
}

async function runTest() {
    console.log('🧪 强制测试GolfWRX图片抓取修复...\n');
    
    const testCases = [
        {
            url: 'https://www.golfwrx.com/764751/blades-brown-witb-2025-august/',
            expectedImages: 'WITB文章通常有多张装备图片'
        },
        {
            url: 'https://www.golfwrx.com/764741/ian-poulter-blasts-himself-on-social-media-as-he-has-one-last-chance-to-avoid-liv-relegation/',
            expectedImages: '新闻文章可能有0-2张图片'
        }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n📝 测试案例 ${i + 1}:`);
        console.log(`   预期: ${testCase.expectedImages}`);
        
        const result = await testGolfWRXSingleArticle(testCase.url, i + 1);
        
        if (result) {
            console.log(`\n   ✅ 测试结果: 抓取到 ${result.images.length} 张图片`);
        }
    }
    
    console.log('\n\n🎯 测试总结:');
    console.log('- 修复后的代码移除了2张图片的限制');
    console.log('- 放宽了图片尺寸要求（从400px降到200px）');
    console.log('- 移除了过于严格的URL过滤条件');
    console.log('- 现在应该能抓取到文章中的所有主要图片');
}

runTest().catch(console.error);