#!/usr/bin/env node

const { chromium } = require('playwright');

async function testConstError() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        const url = 'https://mygolfspy.com/news-opinion/pxg-launches-a-hellcat-at-the-zero-torque-putter-competition/';
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // 测试我们的实际代码
        const result = await page.evaluate(() => {
            try {
                const title = document.querySelector('h1')?.innerText || '';
                const contentElement = document.querySelector('.entry-content, article');
                if (!contentElement) return { error: '找不到内容元素' };
                
                let content = `# ${title}\n\n`;
                const images = [];
                let imageCounter = 0;
                
                const elements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, img, figure');
                
                for (let i = 0; i < elements.length; i++) {
                    const elem = elements[i];
                    
                    try {
                        if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                            const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                            if (img) {
                                let imgUrl = img.src;
                                
                                // 检查是否是小尺寸
                                const isSmallSize = imgUrl && (
                                    imgUrl.match(/-300x\d+/) || 
                                    imgUrl.match(/-\d+x210/)
                                );
                                
                                if (!isSmallSize && imgUrl && imgUrl.startsWith('http')) {
                                    // 检查是否已存在相同基础名称的图片
                                    const baseImageName = imgUrl.replace(/-\d+x\d+/, '');
                                    const isDuplicate = images.some(existingImg => {
                                        const existingBase = existingImg.url.replace(/-\d+x\d+/, '');
                                        return existingBase === baseImageName;
                                    });
                                    
                                    if (!isDuplicate) {
                                        imageCounter++;
                                        
                                        // 这里可能是问题所在 - 尝试不同的写法
                                        let alt = img.alt || '';
                                        if (elem.tagName === 'FIGURE' && !alt) {
                                            const figcaption = elem.querySelector('figcaption');
                                            if (figcaption) {
                                                alt = figcaption.innerText || '';
                                            }
                                        }
                                        
                                        images.push({ 
                                            url: imgUrl, 
                                            alt: alt || `图片${imageCounter}`
                                        });
                                        content += `[IMAGE_${imageCounter}:${alt || '图片'}]\n\n`;
                                    }
                                }
                            }
                        }
                    } catch (elemError) {
                        return { error: `处理元素${i}时出错: ${elemError.message}`, stack: elemError.stack };
                    }
                }
                
                return { title, content, images, imageCounter };
                
            } catch (error) {
                return { error: error.message, stack: error.stack };
            }
        });
        
        console.log('结果:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        await browser.close();
    }
}

testConstError();