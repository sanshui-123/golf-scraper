#!/usr/bin/env node

/**
 * Golf.com 快速内容发现脚本
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function quickDiscoverGolf() {
    console.log('🏌️ Golf.com 快速内容发现');
    console.log('═'.repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    try {
        const page = await browser.newPage();
        const articles = [];
        
        // 只扫描新闻页面
        console.log('\n📄 扫描Golf.com新闻页面...');
        
        await page.goto('https://golf.com/news/', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        
        // 等待内容加载
        await page.waitForTimeout(5000);
        
        // 滚动页面以加载更多内容
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(2000);
        
        // 提取文章
        const pageArticles = await page.evaluate(() => {
            const articleData = [];
            
            // 使用更广泛的选择器
            const links = document.querySelectorAll('a[href*="/news/"]');
            
            links.forEach(link => {
                const url = link.href;
                
                // 过滤掉非文章链接
                if (url.includes('/news/') && 
                    url.split('/').length > 5 && 
                    !url.includes('#') &&
                    !url.includes('page=')) {
                    
                    // 获取文章容器
                    const container = link.closest('article, .m-card, .c-entry-group-labels__item, div[class*="card"]');
                    
                    if (container) {
                        // 获取标题
                        const title = container.querySelector('h2, h3, .c-entry-box--compact__title')?.textContent?.trim() ||
                                     link.textContent?.trim() || '';
                        
                        if (title && title.length > 10) {
                            // 查找时间
                            let timeText = '';
                            const timeElement = container.querySelector('time, .c-timestamp, [class*="date"]');
                            if (timeElement) {
                                timeText = timeElement.textContent?.trim() || '';
                            }
                            
                            // 检查是否包含"hours ago"或"day ago"
                            const containerText = container.textContent || '';
                            const isRecent = containerText.includes('hour') || 
                                           containerText.includes('day ago') ||
                                           containerText.includes('1 day');
                            
                            articleData.push({
                                url,
                                title,
                                timeText,
                                isRecent
                            });
                        }
                    }
                }
            });
            
            // 去重
            const uniqueArticles = [];
            const seenUrls = new Set();
            
            articleData.forEach(article => {
                if (!seenUrls.has(article.url)) {
                    seenUrls.add(article.url);
                    uniqueArticles.push(article);
                }
            });
            
            return uniqueArticles;
        });
        
        console.log(`\n📊 找到 ${pageArticles.length} 篇文章`);
        
        // 筛选最近的文章
        const recentArticles = pageArticles.filter(a => a.isRecent);
        console.log(`📅 最近发布的文章: ${recentArticles.length} 篇`);
        
        // 如果最近文章太少，取前20篇
        const articlesToProcess = recentArticles.length > 0 ? recentArticles : pageArticles.slice(0, 20);
        
        if (articlesToProcess.length > 0) {
            console.log('\n📋 文章列表:');
            articlesToProcess.forEach((article, i) => {
                console.log(`${i + 1}. ${article.title}`);
                console.log(`   时间: ${article.timeText || '未知'}`);
                console.log(`   URL: ${article.url}`);
            });
            
            // 保存URL列表
            const urlList = articlesToProcess.map(a => a.url).join('\n');
            const outputFile = 'golf_com_recent.txt';
            await fs.writeFile(outputFile, urlList);
            console.log(`\n💾 URL列表已保存到: ${outputFile}`);
            
            console.log('\n📌 下一步操作:');
            console.log('1. 查看文章列表: cat golf_com_recent.txt');
            console.log('2. 处理这些文章: node process_article_list.js golf_com_recent.txt');
        }
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
    } finally {
        await browser.close();
        console.log('\n✨ 完成！');
    }
}

// 运行脚本
quickDiscoverGolf().catch(console.error);