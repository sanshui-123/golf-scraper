#!/usr/bin/env node

/**
 * Golf.com 调试脚本 - 检查页面结构
 */

const { chromium } = require('playwright');

async function debugGolfCom() {
    console.log('🔍 Golf.com 页面结构调试');
    console.log('═'.repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(60000);
        
        console.log('\n访问Golf.com新闻页面...');
        await page.goto('https://golf.com/news/', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        // 等待页面加载
        await page.waitForTimeout(5000);
        
        // 滚动页面
        await page.evaluate(() => window.scrollTo(0, 1000));
        await page.waitForTimeout(2000);
        
        // 调试：查找所有可能的文章链接
        const debug = await page.evaluate(() => {
            const info = {
                title: document.title,
                url: window.location.href,
                links: [],
                containers: [],
                selectors: {}
            };
            
            // 查找所有链接
            const allLinks = document.querySelectorAll('a[href*="/news/"]');
            info.totalLinks = allLinks.length;
            
            // 测试不同的选择器
            const testSelectors = [
                '.m-card--horizontal',
                '.m-card--vertical',
                '.m-card',
                '.c-entry-group-labels__item',
                'article',
                'div[class*="card"]',
                'a[href*="/news/"]',
                '.post-item',
                '.article-item',
                '.news-item'
            ];
            
            testSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    info.selectors[selector] = elements.length;
                }
            });
            
            // 获取前5个新闻链接的详细信息
            let count = 0;
            allLinks.forEach(link => {
                const href = link.href;
                if (href.includes('/news/') && 
                    href.split('/').length > 5 && 
                    !href.includes('#') &&
                    !href.includes('page=') &&
                    count < 5) {
                    
                    const parent = link.parentElement;
                    const grandParent = parent ? parent.parentElement : null;
                    
                    info.links.push({
                        url: href,
                        text: link.textContent?.trim().substring(0, 50),
                        parentClass: parent?.className || 'no-class',
                        grandParentClass: grandParent?.className || 'no-class',
                        // 查找可能的时间信息
                        timeInfo: (() => {
                            let container = link.closest('article, div[class*="card"], .m-card');
                            if (!container) container = link.parentElement?.parentElement;
                            if (!container) return 'no-time';
                            
                            const timeEl = container.querySelector('time, .date, [class*="time"]');
                            if (timeEl) return timeEl.textContent?.trim();
                            
                            // 搜索文本中的时间信息
                            const text = container.textContent || '';
                            if (text.includes('hour')) return 'has-hour';
                            if (text.includes('day')) return 'has-day';
                            return 'no-time-found';
                        })()
                    });
                    count++;
                }
            });
            
            return info;
        });
        
        console.log('\n📊 调试信息:');
        console.log(`页面标题: ${debug.title}`);
        console.log(`总链接数: ${debug.totalLinks}`);
        
        console.log('\n选择器匹配结果:');
        Object.entries(debug.selectors).forEach(([selector, count]) => {
            console.log(`  ${selector}: ${count} 个元素`);
        });
        
        console.log('\n前5个文章链接详情:');
        debug.links.forEach((link, i) => {
            console.log(`\n${i + 1}. ${link.text || '无标题'}`);
            console.log(`   URL: ${link.url}`);
            console.log(`   父元素类: ${link.parentClass}`);
            console.log(`   祖父元素类: ${link.grandParentClass}`);
            console.log(`   时间信息: ${link.timeInfo}`);
        });
        
        // 保持浏览器打开10秒供查看
        console.log('\n浏览器将在10秒后关闭...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
    } finally {
        await browser.close();
        console.log('\n✨ 调试完成！');
    }
}

// 运行调试
debugGolfCom().catch(console.error);