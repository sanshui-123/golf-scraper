#!/usr/bin/env node

/**
 * 查找有效的MyGolfSpy.com文章URL
 */

const { chromium } = require('playwright');

async function findValidUrls() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('🔍 访问MyGolfSpy.com搜索有效文章...');
        
        // 访问网站首页
        await page.goto('https://mygolfspy.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        
        // 获取所有可能的文章链接
        const links = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const articleLinks = [];
            
            allLinks.forEach(link => {
                const href = link.href;
                const text = link.textContent.trim();
                
                // 过滤出可能的文章链接
                if (href && href.includes('mygolfspy.com') && 
                    !href.includes('wp-content') && 
                    !href.includes('wp-admin') &&
                    !href.includes('category') &&
                    !href.includes('tag') &&
                    !href.includes('author') &&
                    !href.includes('page') &&
                    !href.includes('#') &&
                    !href.includes('mailto:') &&
                    !href.includes('tel:') &&
                    !href.includes('javascript:') &&
                    href !== 'https://mygolfspy.com/' &&
                    href.length > 30 &&
                    text.length > 10) {
                    
                    articleLinks.push({
                        url: href,
                        title: text,
                        length: text.length
                    });
                }
            });
            
            // 去重并排序
            const unique = [];
            const seen = new Set();
            
            articleLinks.forEach(link => {
                if (!seen.has(link.url)) {
                    seen.add(link.url);
                    unique.push(link);
                }
            });
            
            return unique.sort((a, b) => b.length - a.length);
        });
        
        console.log(`\n找到 ${links.length} 个潜在文章链接`);
        
        // 测试前10个链接的可访问性
        const validUrls = [];
        
        for (let i = 0; i < Math.min(10, links.length); i++) {
            const link = links[i];
            console.log(`\n测试 ${i + 1}: ${link.title}`);
            console.log(`URL: ${link.url}`);
            
            try {
                const response = await page.goto(link.url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });
                
                if (response && response.ok()) {
                    // 检查是否是真正的文章页面
                    const isArticle = await page.evaluate(() => {
                        const title = document.title;
                        const body = document.body.textContent;
                        const h1 = document.querySelector('h1');
                        
                        // 检查是否是404或错误页面
                        if (title.toLowerCase().includes('404') || 
                            title.toLowerCase().includes('not found') || 
                            body.toLowerCase().includes('uh oh') || 
                            body.toLowerCase().includes('lost this one')) {
                            return false;
                        }
                        
                        // 检查是否有文章内容
                        const contentSelectors = [
                            '.entry-content',
                            '.post-content',
                            '.article-content',
                            '.content-area',
                            '.post-body'
                        ];
                        
                        for (const selector of contentSelectors) {
                            const content = document.querySelector(selector);
                            if (content && content.textContent.trim().length > 500) {
                                return true;
                            }
                        }
                        
                        return false;
                    });
                    
                    if (isArticle) {
                        console.log('✅ 有效文章页面');
                        validUrls.push(link.url);
                    } else {
                        console.log('❌ 不是文章页面');
                    }
                } else {
                    console.log(`❌ 无法访问: ${response ? response.status() : 'timeout'}`);
                }
            } catch (error) {
                console.log(`❌ 错误: ${error.message}`);
            }
        }
        
        console.log('\n🎯 找到的有效文章URL：');
        console.log('═'.repeat(50));
        validUrls.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
        
        // 保存到文件
        const fs = require('fs');
        fs.writeFileSync('valid_mygolfspy_urls.txt', validUrls.join('\n'));
        console.log('\n✅ 已保存到 valid_mygolfspy_urls.txt');
        
    } catch (error) {
        console.error('❌ 搜索过程中出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行搜索
findValidUrls().catch(console.error);