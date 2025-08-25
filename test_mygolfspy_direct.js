/**
 * 直接访问 MyGolfSpy 文章列表页面
 */

const { chromium } = require('playwright');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');

async function testDirectPages() {
    console.log('🔍 测试 MyGolfSpy 不同页面...\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const imageHandler = new MyGolfSpyImageHandler();
    
    // 测试不同的页面
    const testUrls = [
        { name: '主页', url: 'https://mygolfspy.com/' },
        { name: '新闻页', url: 'https://mygolfspy.com/news-opinion/' },
        { name: '评测页', url: 'https://mygolfspy.com/reviews/' },
        { name: '买家指南', url: 'https://mygolfspy.com/buyers-guides/' }
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\n📍 测试 ${testUrl.name}: ${testUrl.url}`);
        
        const page = await context.newPage();
        
        try {
            await page.goto(testUrl.url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await page.waitForTimeout(5000);
            
            // 处理弹窗
            await imageHandler.handlePopups(page);
            await page.waitForTimeout(2000);
            
            // 分析页面
            const pageData = await page.evaluate(() => {
                const data = {
                    title: document.title,
                    articleCount: 0,
                    articles: [],
                    possibleSelectors: []
                };
                
                // 查找所有可能的文章链接
                const links = document.querySelectorAll('a[href*="/"]');
                const articleLinks = new Map();
                
                links.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    // 过滤文章链接
                    if (text.length > 20 && text.length < 200 &&
                        (href.includes('/buyers-guides/') || 
                         href.includes('/news-opinion/') || 
                         href.includes('/reviews/') ||
                         href.includes('/first-look/')) &&
                        !href.endsWith('/buyers-guides/') &&
                        !href.endsWith('/news-opinion/') &&
                        !href.endsWith('/reviews/') &&
                        !articleLinks.has(href)) {
                        
                        // 查找包含这个链接的容器
                        let container = link.parentElement;
                        let foundContainer = null;
                        let depth = 0;
                        
                        while (container && depth < 8) {
                            const className = container.className || '';
                            const id = container.id || '';
                            
                            // 检查是否是文章容器
                            if (className.includes('post') || 
                                className.includes('article') || 
                                className.includes('item') ||
                                className.includes('entry') ||
                                container.tagName === 'ARTICLE') {
                                foundContainer = container;
                                break;
                            }
                            
                            container = container.parentElement;
                            depth++;
                        }
                        
                        articleLinks.set(href, {
                            title: text,
                            url: href,
                            container: foundContainer ? {
                                tag: foundContainer.tagName,
                                class: foundContainer.className,
                                id: foundContainer.id
                            } : null
                        });
                    }
                });
                
                // 转换为数组
                data.articles = Array.from(articleLinks.values()).slice(0, 10);
                data.articleCount = articleLinks.size;
                
                // 统计容器类型
                const containerStats = {};
                data.articles.forEach(article => {
                    if (article.container && article.container.class) {
                        const classes = article.container.class.split(' ');
                        classes.forEach(cls => {
                            if (cls) {
                                containerStats[cls] = (containerStats[cls] || 0) + 1;
                            }
                        });
                    }
                });
                
                // 找出最常见的容器类
                data.possibleSelectors = Object.entries(containerStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([cls, count]) => ({ selector: `.${cls}`, count }));
                
                return data;
            });
            
            console.log(`\n✅ ${testUrl.name} 分析结果:`);
            console.log(`标题: ${pageData.title}`);
            console.log(`找到文章数: ${pageData.articleCount}`);
            
            if (pageData.articles.length > 0) {
                console.log('\n前5篇文章:');
                pageData.articles.slice(0, 5).forEach((article, i) => {
                    console.log(`\n${i + 1}. ${article.title}`);
                    console.log(`   URL: ${article.url}`);
                    if (article.container) {
                        console.log(`   容器: ${article.container.tag}.${article.container.class}`);
                    }
                });
                
                if (pageData.possibleSelectors.length > 0) {
                    console.log('\n可能的选择器:');
                    pageData.possibleSelectors.forEach(sel => {
                        console.log(`- ${sel.selector} (${sel.count}次)`);
                    });
                }
            }
            
        } catch (error) {
            console.error(`❌ ${testUrl.name} 出错:`, error.message);
        } finally {
            await page.close();
        }
    }
    
    console.log('\n✅ 测试完成');
    console.log('⏸️ 浏览器将在20秒后关闭...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    await browser.close();
}

// 运行测试
testDirectPages().catch(console.error);