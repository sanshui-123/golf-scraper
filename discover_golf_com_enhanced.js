const { chromium } = require('playwright');
const fs = require('fs').promises;

async function discoverGolfComEnhanced() {
    console.log('🏌️ Golf.com 增强版URL发现 - 真正的24小时内文章');
    console.log('═'.repeat(60));
    console.log('📌 扫描多个页面，抓取24小时内的文章\n');
    
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
    
    const allArticles = new Map();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // 扩展的页面列表
    const sections = [
        { url: 'https://golf.com/', name: '首页' },
        { url: 'https://golf.com/news/', name: '新闻' },
        { url: 'https://golf.com/news/?p=2', name: '新闻第2页' },
        { url: 'https://golf.com/news/?p=3', name: '新闻第3页' },
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
                    '.c-entry-box--compact__title a',
                    'a[href*="/2025/"][href$="/"]' // 明确查找2025年的文章
                ];
                
                const seenUrls = new Set();
                const today = new Date();
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                
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
                            
                            // 检查URL中的日期
                            const urlDateMatch = href.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                            let isRecent = false;
                            let dateStr = '';
                            
                            if (urlDateMatch) {
                                const [_, year, month, day] = urlDateMatch;
                                const articleDate = new Date(year, month - 1, day);
                                const hoursDiff = (today - articleDate) / (1000 * 60 * 60);
                                isRecent = hoursDiff <= 24;
                                dateStr = `${year}-${month}-${day}`;
                            }
                            
                            // 如果URL有日期且是24小时内，或者没有日期但可能是新文章
                            if (isRecent || !urlDateMatch) {
                                seenUrls.add(href);
                                results.push({
                                    url: href,
                                    title: title,
                                    date: dateStr,
                                    isRecent: isRecent,
                                    hasDateInUrl: !!urlDateMatch
                                });
                            }
                        }
                    });
                });
                
                return results;
            });
            
            console.log(`  找到 ${articles.length} 篇文章`);
            const recentCount = articles.filter(a => a.isRecent).length;
            if (recentCount > 0) {
                console.log(`  ✅ 其中 ${recentCount} 篇为24小时内文章`);
            }
            
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
    
    // 转换为数组并排序
    const uniqueArticles = Array.from(allArticles.values());
    
    // 优先显示确认为24小时内的文章
    const recentArticles = uniqueArticles.filter(a => a.isRecent);
    const possiblyRecentArticles = uniqueArticles.filter(a => !a.hasDateInUrl);
    
    console.log('\n📊 扫描结果:');
    console.log(`  - 总共找到: ${uniqueArticles.length} 篇独特文章`);
    console.log(`  - 确认24小时内: ${recentArticles.length} 篇`);
    console.log(`  - 可能为新文章(无日期): ${possiblyRecentArticles.length} 篇`);
    
    // 合并结果，优先24小时内的文章
    const finalArticles = [...recentArticles, ...possiblyRecentArticles];
    
    // 保存结果
    if (process.argv.includes('--urls-only')) {
        // 只输出URL到控制台
        finalArticles.forEach(article => {
            console.log(article.url);
        });
    } else {
        // 显示详细信息
        console.log('\n最新文章列表:');
        finalArticles.slice(0, 20).forEach((article, i) => {
            console.log(`${i + 1}. ${article.title}`);
            console.log(`   URL: ${article.url}`);
            if (article.date) console.log(`   日期: ${article.date}`);
            console.log(`   状态: ${article.isRecent ? '✅ 24小时内' : '⚠️ 可能是新文章'}`);
        });
        
        if (finalArticles.length > 20) {
            console.log(`\n... 还有 ${finalArticles.length - 20} 篇文章`);
        }
    }
    
    // 保存到文件
    const urlList = finalArticles.map(a => a.url).join('\n');
    await fs.writeFile('deep_urls_golf_com.txt', urlList);
    console.log(`\n💾 URL列表已保存到: deep_urls_golf_com.txt`);
    
    // 保存详细信息
    await fs.writeFile('golf_com_enhanced_details.json', JSON.stringify(finalArticles, null, 2));
    console.log(`💾 详细信息已保存到: golf_com_enhanced_details.json`);
    
    return finalArticles.length;
}

// 运行脚本
if (require.main === module) {
    discoverGolfComEnhanced().catch(console.error);
}

module.exports = discoverGolfComEnhanced;