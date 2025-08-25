#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLazyLoad() {
    const browser = await chromium.launch({
        headless: false, // 让我们看到发生了什么
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
        
        // 第1步：移除所有弹窗
        console.log('\n第1步：移除弹窗...');
        await page.evaluate(() => {
            // 找到并点击所有关闭按钮
            document.querySelectorAll('button').forEach(btn => {
                const text = btn.textContent || '';
                if (text.includes('×') || text.includes('X') || text.includes('Close')) {
                    try { btn.click(); } catch(e) {}
                }
            });
            
            // 强制移除弹窗
            document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="overlay"]').forEach(elem => {
                const style = window.getComputedStyle(elem);
                if (style.position === 'fixed' && style.zIndex > 1000) {
                    elem.style.display = 'none';
                }
            });
            
            // 恢复滚动
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        });
        
        await page.waitForTimeout(2000);
        
        // 第2步：慢速滚动并检查图片
        console.log('\n第2步：滚动页面并监控图片加载...');
        
        const images = await page.evaluate(async () => {
            const results = [];
            
            // 获取初始图片状态
            const checkImages = () => {
                const imgs = document.querySelectorAll('.entry-content img, .post-content img, article img');
                const imgData = [];
                imgs.forEach((img, i) => {
                    imgData.push({
                        index: i + 1,
                        src: img.src,
                        dataSrc: img.getAttribute('data-src'),
                        dataLazySrc: img.getAttribute('data-lazy-src'),
                        isLoaded: img.src && img.src.startsWith('http'),
                        className: img.className
                    });
                });
                return imgData;
            };
            
            // 初始状态
            results.push({ phase: '初始状态', images: checkImages() });
            
            // 慢速滚动
            let scrolled = 0;
            const maxScroll = document.body.scrollHeight;
            
            while (scrolled < maxScroll) {
                window.scrollBy(0, 500);
                scrolled += 500;
                
                // 等待图片加载
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 尝试手动触发懒加载
                document.querySelectorAll('img[data-lazy-src]').forEach(img => {
                    if (!img.src.startsWith('http') && img.getAttribute('data-lazy-src')) {
                        img.src = img.getAttribute('data-lazy-src');
                        img.classList.add('lazyloaded');
                    }
                });
                
                // 检查滚动到的位置
                if (scrolled % 2000 === 0) {
                    results.push({ 
                        phase: `滚动到 ${scrolled}px`, 
                        images: checkImages() 
                    });
                }
            }
            
            // 滚动到底部后的最终状态
            await new Promise(resolve => setTimeout(resolve, 2000));
            results.push({ phase: '最终状态', images: checkImages() });
            
            return results;
        });
        
        // 打印结果
        images.forEach(result => {
            console.log(`\n${result.phase}:`);
            result.images.forEach(img => {
                console.log(`  图片${img.index}: ${img.isLoaded ? '✅已加载' : '❌未加载'} - ${img.src.substring(0, 60)}...`);
                if (!img.isLoaded && img.dataLazySrc) {
                    console.log(`    懒加载URL: ${img.dataLazySrc}`);
                }
            });
        });
        
        // 第3步：再次获取所有图片信息
        console.log('\n第3步：最终图片统计...');
        const finalImages = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            const loaded = [];
            const notLoaded = [];
            
            imgs.forEach(img => {
                if (img.src && img.src.startsWith('http') && img.width > 100) {
                    loaded.push(img.src);
                } else if (img.getAttribute('data-lazy-src')) {
                    notLoaded.push(img.getAttribute('data-lazy-src'));
                }
            });
            
            return { loaded, notLoaded };
        });
        
        console.log(`\n成功加载的图片: ${finalImages.loaded.length}`);
        finalImages.loaded.forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`);
        });
        
        console.log(`\n未加载的图片: ${finalImages.notLoaded.length}`);
        finalImages.notLoaded.forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`);
        });
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        console.log('\n按Ctrl+C结束...');
        await new Promise(() => {}); // 保持浏览器打开
    }
}

testLazyLoad();