#!/usr/bin/env node

/**
 * MyGolfSpy.com 特定文章结构分析
 * 使用具体的文章URL进行分析
 */

const { chromium } = require('playwright');

async function analyzeSpecificArticle() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('📝 分析 MyGolfSpy.com 特定文章结构...');
        
        // 使用一个具体的文章URL
        const articleUrl = 'https://mygolfspy.com/mygolfspy-most-wanted-fairway-woods-2024/';
        
        console.log(`访问文章: ${articleUrl}`);
        await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 等待页面加载完成
        await page.waitForTimeout(5000);
        
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
                '.single-post-content',
                '.content',
                '.post'
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
            
            // 获取所有图片的详细信息
            const allImages = document.querySelectorAll('img');
            allImages.forEach((img, index) => {
                if (index < 15) { // 只分析前15张图片
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
                        parentTag: img.parentElement.tagName.toLowerCase(),
                        parentClass: img.parentElement.className
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
            console.log(`   父元素: ${img.parentTag} (${img.parentClass})`);
            console.log(`   懒加载: ${img.hasDataSrc ? '是' : '否'}`);
            console.log(`   srcset: ${img.srcset ? '有' : '无'}`);
            console.log('');
        });
        
        // 检查图片格式
        console.log('\n🔍 检查图片格式支持：');
        const imageFormatTest = await page.evaluate(async () => {
            const testImages = document.querySelectorAll('img');
            const formatInfo = [];
            
            for (let i = 0; i < Math.min(8, testImages.length); i++) {
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
        
        // 保存分析结果
        const fs = require('fs');
        const analysisResult = {
            url: articleUrl,
            title: articleStructure.title,
            selectors: articleStructure.possibleSelectors,
            images: articleStructure.images,
            formatTest: imageFormatTest,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync('mygolfspy_analysis_result.json', JSON.stringify(analysisResult, null, 2));
        console.log('\n✅ 分析结果已保存到 mygolfspy_analysis_result.json');
        
    } catch (error) {
        console.error('分析过程中出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行分析
analyzeSpecificArticle().catch(console.error);