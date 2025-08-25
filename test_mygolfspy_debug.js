#!/usr/bin/env node

const { chromium } = require('playwright');

async function testMyGolfSpyDebug() {
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const page = await browser.newPage();
    
    try {
        const url = 'https://mygolfspy.com/news-opinion/pxg-launches-a-hellcat-at-the-zero-torque-putter-competition/';
        console.log('访问页面:', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // 只测试图片提取部分
        console.log('\n测试图片提取...');
        
        const result = await page.evaluate(() => {
            // 先查看页面上有哪些主要元素
            const possibleSelectors = [
                '.entry-content',
                '.jeg_main_content', 
                '.post-content',
                '.article-content',
                'article .content',
                'article',
                'main',
                '[class*="content"]'
            ];
            
            let contentElement = null;
            for (const selector of possibleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.querySelectorAll('p').length > 3) {
                    contentElement = elem;
                    console.log('找到内容元素，使用选择器:', selector);
                    break;
                }
            }
            
            if (!contentElement) {
                // 尝试找到包含最多段落的元素
                const allElements = document.querySelectorAll('*');
                let maxParagraphs = 0;
                allElements.forEach(elem => {
                    const paragraphs = elem.querySelectorAll('p').length;
                    if (paragraphs > maxParagraphs) {
                        maxParagraphs = paragraphs;
                        contentElement = elem;
                    }
                });
                console.log('使用包含最多段落的元素，段落数:', maxParagraphs);
            }
            
            if (!contentElement) return { error: '找不到内容元素' };
            
            const images = [];
            let imageCounter = 0;
            const errors = [];
            
            try {
                const elements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, img, figure');
                
                elements.forEach((elem, index) => {
                    try {
                        if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                            const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                            if (img) {
                                let imgUrl = img.src;
                                
                                // 获取真实URL
                                if (!imgUrl || imgUrl.startsWith('data:')) {
                                    imgUrl = img.getAttribute('data-lazy-src') || 
                                            img.getAttribute('data-src') || 
                                            img.dataset.lazySrc ||
                                            img.dataset.src ||
                                            img.src;
                                }
                                
                                if (imgUrl && imgUrl.startsWith('http')) {
                                    imageCounter++;
                                    
                                    // 尝试获取alt文本 - 这里可能有问题
                                    let alt = img.alt || '';
                                    
                                    // 如果是figure标签，尝试获取figcaption
                                    if (elem.tagName === 'FIGURE' && !alt) {
                                        try {
                                            const figcaptionElem = elem.querySelector('figcaption');
                                            if (figcaptionElem) {
                                                alt = figcaptionElem.innerText || '';
                                            }
                                        } catch (e) {
                                            errors.push(`Figcaption错误 at index ${index}: ${e.message}`);
                                        }
                                    }
                                    
                                    images.push({ 
                                        url: imgUrl, 
                                        alt: alt || `图片${imageCounter}`,
                                        index: index,
                                        tagName: elem.tagName
                                    });
                                }
                            }
                        }
                    } catch (elemError) {
                        errors.push(`元素处理错误 at index ${index}: ${elemError.message}`);
                    }
                });
                
            } catch (e) {
                errors.push(`主循环错误: ${e.message}`);
            }
            
            return { images, errors, imageCounter };
        });
        
        console.log('\n结果:', result);
        
        if (result && result.images) {
            console.log('图片数量:', result.images.length);
            console.log('错误数量:', result.errors ? result.errors.length : 0);
            
            if (result.errors && result.errors.length > 0) {
                console.log('\n错误详情:');
                result.errors.forEach(err => console.log('  -', err));
            }
            
            console.log('\n图片列表:');
            result.images.forEach((img, i) => {
                console.log(`${i+1}. [${img.tagName}] ${img.url.substring(0, 80)}...`);
                console.log(`   Alt: ${img.alt}`);
            });
        }
        
    } catch (error) {
        console.error('页面错误:', error);
    } finally {
        await browser.close();
    }
}

testMyGolfSpyDebug();