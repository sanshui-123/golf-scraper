const { chromium } = require('playwright');
const fs = require('fs').promises;

async function discoverGolfComFixed() {
    console.log('🏌️ Golf.com 修复版URL发现');
    console.log('═'.repeat(60));
    console.log('📌 只抓取最新文章URL，不进行时间过滤\n');
    
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    
    const allArticles = new Map(); // 使用Map去重
    
    // 扩展的页面列表
    const sections = [
        { url: 'https://golf.com/', name: '首页' },
        { url: 'https://golf.com/news/', name: '新闻' },
        { url: 'https://golf.com/news/?p=2', name: '新闻第2页' },
        { url: 'https://golf.com/instruction/', name: '教学' },
        { url: 'https://golf.com/gear/', name: '装备' },
        { url: 'https://golf.com/travel/', name: '旅游' },
        { url: 'https://golf.com/lifestyle/', name: '生活方式' }
    ];
    
    for (const section of sections) {
        console.log(`📄 扫描${section.name}: ${section.url}`);
        
        try {
            await page.goto(section.url, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            // 等待内容加载
            await page.waitForTimeout(3000);
            
            // 滚动页面以加载更多内容
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await page.waitForTimeout(1000);
            
            // 提取所有文章链接
            const articles = await page.evaluate(() => {
                const results = [];
                
                // 多种选择器策略
                const selectors = [
                    'article a[href*="/news/"][href$="/"]',
                    'article a[href*="/instruction/"][href$="/"]',
                    'article a[href*="/gear/"][href$="/"]',
                    'a.m-card--horizontal__title',
                    'a.m-card--vertical__title',
                    'h2 a[href*="golf.com"]',
                    'h3 a[href*="golf.com"]',
                    '.c-entry-box--compact__title a'
                ];
                
                const seenUrls = new Set();
                
                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(link => {
                        const href = link.href;
                        const title = link.textContent?.trim();
                        
                        // 基本过滤
                        if (href && 
                            !seenUrls.has(href) &&
                            !href.includes('/tag/') && 
                            !href.includes('/category/') &&
                            !href.includes('#') &&
                            title && title.length > 10) {
                            
                            seenUrls.add(href);
                            results.push({
                                url: href,
                                title: title
                            });
                        }
                    });
                });
                
                return results;
            });
            
            console.log(`  找到 ${articles.length} 篇文章`);
            
            // 添加到总集合
            articles.forEach(article => {
                if (!allArticles.has(article.url)) {
                    allArticles.set(article.url, article);
                }
            });
            
        } catch (error) {
            console.log(`  ❌ 扫描失败: ${error.message}`);
        }
    }
    
    await browser.close();
    
    // 转换为数组
    const uniqueArticles = Array.from(allArticles.values());
    console.log(`\n📊 总共找到 ${uniqueArticles.length} 篇独特文章`);
    
    // 保存结果
    if (process.argv.includes('--urls-only')) {
        // 只输出URL到控制台
        uniqueArticles.forEach(article => {
            console.log(article.url);
        });
    } else {
        // 显示详细信息
        console.log('\n最新文章列表:');
        uniqueArticles.slice(0, 20).forEach((article, i) => {
            console.log(`${i + 1}. ${article.title}`);
            console.log(`   URL: ${article.url}`);
        });
        
        if (uniqueArticles.length > 20) {
            console.log(`\n... 还有 ${uniqueArticles.length - 20} 篇文章`);
        }
    }
    
    // 保存到文件
    const urlList = uniqueArticles.map(a => a.url).join('\n');
    await fs.writeFile('golf_com_all_recent.txt', urlList);
    console.log(`\n💾 URL列表已保存到: golf_com_all_recent.txt`);
    
    // 保存详细信息
    await fs.writeFile('golf_com_details.json', JSON.stringify(uniqueArticles, null, 2));
    console.log(`💾 详细信息已保存到: golf_com_details.json`);
}

// 运行脚本
discoverGolfComFixed().catch(console.error);