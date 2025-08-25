const { chromium } = require('playwright');

async function checkTodaysArticles() {
    console.log('🔍 检查各网站今日最新文章\n');
    
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    const results = {};
    
    // 1. Golf.com
    console.log('1️⃣ 检查 Golf.com...');
    try {
        const page = await context.newPage();
        await page.goto('https://golf.com/news/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const golfComArticles = await page.evaluate(() => {
            const articles = [];
            // 更广泛的选择器
            const links = document.querySelectorAll('a[href*="/news/"][href$="/"]');
            const today = new Date();
            
            links.forEach(link => {
                const href = link.href;
                const title = link.textContent?.trim();
                
                // 检查URL中的日期
                const urlMatch = href.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                if (urlMatch) {
                    const [_, year, month, day] = urlMatch;
                    const articleDate = new Date(year, month - 1, day);
                    const daysDiff = (today - articleDate) / (1000 * 60 * 60 * 24);
                    
                    if (daysDiff <= 1 && title && title.length > 10) {
                        articles.push({
                            url: href,
                            title: title.substring(0, 50) + '...',
                            date: `${year}-${month}-${day}`,
                            daysAgo: Math.floor(daysDiff)
                        });
                    }
                }
            });
            
            // 去重
            const unique = Array.from(new Map(articles.map(a => [a.url, a])).values());
            return unique.slice(0, 10);
        });
        
        results['Golf.com'] = golfComArticles;
        await page.close();
    } catch (e) {
        console.log('❌ Golf.com 访问失败:', e.message);
        results['Golf.com'] = [];
    }
    
    // 2. Golf Monthly
    console.log('\n2️⃣ 检查 Golf Monthly...');
    try {
        const page = await context.newPage();
        await page.goto('https://www.golfmonthly.com/news', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const golfMonthlyArticles = await page.evaluate(() => {
            const articles = [];
            // 查找所有文章链接
            document.querySelectorAll('a[href*="/news/"]').forEach(link => {
                const href = link.href;
                const title = link.textContent?.trim();
                
                // 检查是否有时间标记
                const parent = link.closest('article') || link.parentElement;
                const timeText = parent?.textContent || '';
                
                if (title && title.length > 10 && 
                    (timeText.includes('hour') || timeText.includes('today') || 
                     timeText.includes('minute') || href.includes('2025'))) {
                    articles.push({
                        url: href,
                        title: title.substring(0, 50) + '...',
                        timeIndicator: timeText.includes('hour') ? 'hours ago' : 
                                     timeText.includes('today') ? 'today' : 'recent'
                    });
                }
            });
            
            return Array.from(new Set(articles.map(a => a.url)))
                .map(url => articles.find(a => a.url === url))
                .slice(0, 10);
        });
        
        results['Golf Monthly'] = golfMonthlyArticles;
        await page.close();
    } catch (e) {
        console.log('❌ Golf Monthly 访问失败:', e.message);
        results['Golf Monthly'] = [];
    }
    
    // 3. GolfWRX (通过RSS)
    console.log('\n3️⃣ 检查 GolfWRX RSS...');
    try {
        const page = await context.newPage();
        await page.goto('https://www.golfwrx.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const rssContent = await page.content();
        const matches = rssContent.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        results['GolfWRX'] = matches.slice(0, 10).map(item => {
            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
            const linkMatch = item.match(/<link>(.*?)<\/link>/);
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
            
            return {
                url: linkMatch ? linkMatch[1] : '',
                title: titleMatch ? titleMatch[1].substring(0, 50) + '...' : '',
                pubDate: pubDateMatch ? pubDateMatch[1] : ''
            };
        }).filter(a => a.url);
        
        await page.close();
    } catch (e) {
        console.log('❌ GolfWRX RSS 访问失败:', e.message);
        results['GolfWRX'] = [];
    }
    
    await browser.close();
    
    // 输出结果
    console.log('\n📊 检查结果:\n');
    
    for (const [site, articles] of Object.entries(results)) {
        console.log(`${site}: 找到 ${articles.length} 篇最新文章`);
        if (articles.length > 0) {
            articles.slice(0, 3).forEach((a, i) => {
                console.log(`  ${i+1}. ${a.title}`);
                console.log(`     ${a.url}`);
                if (a.date) console.log(`     日期: ${a.date}`);
                if (a.pubDate) console.log(`     发布: ${a.pubDate}`);
                if (a.timeIndicator) console.log(`     时间: ${a.timeIndicator}`);
            });
            if (articles.length > 3) {
                console.log(`  ... 还有 ${articles.length - 3} 篇`);
            }
        }
        console.log('');
    }
    
    // 保存新发现的URL
    const allNewUrls = [];
    for (const articles of Object.values(results)) {
        allNewUrls.push(...articles.map(a => a.url));
    }
    
    require('fs').writeFileSync('today_new_articles.txt', allNewUrls.join('\n'));
    console.log(`\n💾 已保存 ${allNewUrls.length} 个新URL到 today_new_articles.txt`);
}

checkTodaysArticles().catch(console.error);