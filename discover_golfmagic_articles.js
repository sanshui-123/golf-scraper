const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * Golf Magic 文章 URL 抓取脚本
 * 
 * 使用说明:
 * node discover_golfmagic_articles.js [数量] [--urls-only]
 * 
 * 参数:
 * - 数量: 要抓取的文章数量，默认50
 * - --urls-only: 只输出URL列表，不抓取内容
 * 
 * 示例:
 * node discover_golfmagic_articles.js 50 --urls-only
 */

const MAX_ARTICLES = parseInt(process.argv[2]) || 50;
const URLS_ONLY = process.argv.includes('--urls-only');

// Golf Magic 主要页面
const PAGES_TO_SCAN = [
    'https://www.golfmagic.com',
    'https://www.golfmagic.com/news',
    'https://www.golfmagic.com/equipment',
    'https://www.golfmagic.com/features',
    'https://www.golfmagic.com/golf-equipment/reviews'
];

async function discoverGolfMagicArticles() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const uniqueUrls = new Set();
    
    for (const pageUrl of PAGES_TO_SCAN) {
        if (uniqueUrls.size >= MAX_ARTICLES) break;
        
        console.error(`扫描页面: ${pageUrl}`);
        const page = await context.newPage();
        
        try {
            await page.goto(pageUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 
            });
            
            // 等待内容加载
            await page.waitForTimeout(2000);
            
            // 滚动页面以加载更多内容
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                await page.waitForTimeout(1000);
            }
            
            // 获取所有文章链接
            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href]');
                const baseUrl = 'https://www.golfmagic.com';
                const articleLinks = new Set();
                
                anchors.forEach(a => {
                    let href = a.getAttribute('href');
                    if (!href) return;
                    
                    // 转换相对URL为绝对URL
                    if (href.startsWith('/')) {
                        href = baseUrl + href;
                    }
                    
                    // 只处理golfmagic.com的链接
                    if (!href.includes('golfmagic.com')) return;
                    
                    // 排除明显的非文章页面
                    const excludePatterns = [
                        '/tag/', '/author/', '/category/', '/search',
                        '/login', '/register', '/subscribe', '/contact',
                        '/privacy', '/terms', '/about', '/advertise',
                        '/page/', '?', '#', '.jpg', '.png', '.pdf'
                    ];
                    
                    if (excludePatterns.some(pattern => href.includes(pattern))) return;
                    
                    // Golf Magic文章URL特征分析
                    const urlPath = href.replace('https://www.golfmagic.com/', '');
                    const urlParts = urlPath.split('/').filter(p => p);
                    
                    // 排除明显的分类页面
                    const categoryPages = [
                        'news', 'equipment', 'features', 'tour', 'betting', 'rules',
                        'reviews', 'pga-tour', 'liv-golf', 'dp-world-tour', 'ryder-cup',
                        'presidents-cup', 'us-masters', 'us-pga', 'us-open', 
                        'open-championship', 'lpga-tour', 'clubs', 'balls', 'bags'
                    ];
                    
                    // 如果URL只有一层且是已知分类，跳过
                    if (urlParts.length === 1 && categoryPages.includes(urlParts[0])) {
                        return;
                    }
                    
                    // 文章URL通常满足以下条件：
                    // 1. 至少有2层路径 (category/article-slug)
                    // 2. 最后一部分通常较长（超过15个字符）
                    // 3. 最后一部分包含多个连字符（表示文章标题）
                    const lastPart = urlParts[urlParts.length - 1] || '';
                    const hyphenCount = (lastPart.match(/-/g) || []).length;
                    
                    if (urlParts.length >= 2 && 
                        lastPart.length > 15 && 
                        hyphenCount >= 2 && 
                        !href.endsWith('/')) {
                        articleLinks.add(href);
                    }
                });
                
                return Array.from(articleLinks);
            });
            
            // 添加到唯一URL集合
            links.forEach(url => {
                if (uniqueUrls.size < MAX_ARTICLES) {
                    uniqueUrls.add(url);
                }
            });
            
            console.error(`当前已收集 ${uniqueUrls.size} 个URL`);
            
        } catch (error) {
            console.error(`获取页面失败 ${pageUrl}:`, error.message);
        } finally {
            await page.close();
        }
    }
    
    await browser.close();
    
    const urlArray = Array.from(uniqueUrls);
    console.error(`\n总共发现 ${urlArray.length} 篇Golf Magic文章`);
    
    if (URLS_ONLY) {
        // URL-only 模式：生成标准格式的URL文件
        const urlFileName = 'deep_urls_golfmagic_com.txt';
        const fileContent = [
            `# Golf Magic URLs`,
            `# Generated: ${new Date().toISOString()}`,
            `# Total: ${urlArray.length} articles`,
            '',
            ...urlArray,
            ''
        ].join('\n');
        
        await fs.writeFile(urlFileName, fileContent);
        console.error(`URL已保存到: ${urlFileName}`);
        
        // 同时输出到stdout供主程序读取
        urlArray.forEach(url => console.log(url));
    } else {
        // 正常模式：抓取文章内容
        console.log(JSON.stringify({ articles: urlArray }));
    }
}

// 运行脚本
discoverGolfMagicArticles().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
});