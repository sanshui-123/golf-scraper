/**
 * MyGolfSpy 文章结构分析脚本
 */

const { chromium } = require('playwright');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');

async function analyzeMyGolfSpyArticles() {
    console.log('🔍 分析 MyGolfSpy 文章结构...\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    const imageHandler = new MyGolfSpyImageHandler();
    
    try {
        // 1. 访问主页
        console.log('📍 访问 MyGolfSpy 主页...');
        await page.goto('https://mygolfspy.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // 2. 等待内容加载
        console.log('⏳ 等待内容加载...');
        await page.waitForTimeout(8000);
        
        // 3. 处理弹窗
        console.log('🔍 处理可能的弹窗...');
        await imageHandler.handlePopups(page);
        await page.waitForTimeout(2000);
        
        // 4. 滚动触发加载
        console.log('📜 滚动页面...');
        await page.evaluate(() => {
            window.scrollTo(0, 1000);
        });
        await page.waitForTimeout(3000);
        
        // 5. 分析文章结构
        console.log('\n📊 分析文章结构...');
        
        const articleAnalysis = await page.evaluate(() => {
            const results = {
                foundSelectors: [],
                articleData: [],
                detailedStructure: []
            };
            
            // 测试各种可能的文章容器选择器
            const testSelectors = [
                // 通用文章选择器
                'article',
                '.article',
                '.post',
                '.entry',
                
                // 特定结构
                '.post-list-wrapper',
                '.post-list',
                '.post-item',
                '.article-item',
                '.content-item',
                
                // 包含post的类
                '[class*="post-"]:not(style):not(script)',
                '[class*="article-"]:not(style):not(script)',
                
                // 特定于MyGolfSpy
                '.jeg_post',
                '.jeg_postblock',
                '.post-wrapper',
                '.entry-wrapper',
                
                // 尝试更具体的选择器
                'div[class*="post-image-tag"]',
                'div[class*="post-content"]',
                '.latest-posts article',
                '.recent-posts article',
                'main article',
                '.content-area article'
            ];
            
            // 测试每个选择器
            testSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0 && elements.length < 100) { // 避免选中太多无关元素
                        // 检查是否包含链接
                        let hasLinks = false;
                        elements.forEach(el => {
                            if (el.querySelector('a[href*="/"]')) {
                                hasLinks = true;
                            }
                        });
                        
                        if (hasLinks) {
                            results.foundSelectors.push({
                                selector: selector,
                                count: elements.length,
                                sample: elements[0].className || elements[0].tagName
                            });
                        }
                    }
                } catch (e) {}
            });
            
            // 深度分析：查找所有包含文章链接的容器
            const allContainers = new Set();
            
            // 查找所有看起来像文章标题的链接
            const titleLinks = document.querySelectorAll('a[href*="/buyers-guides/"], a[href*="/news-opinion/"], a[href*="/reviews/"]');
            
            titleLinks.forEach(link => {
                const text = link.textContent.trim();
                // 过滤有效的文章标题
                if (text.length > 15 && text.length < 200 && !text.includes('Read More')) {
                    // 查找包含此链接的最近容器
                    let container = link.parentElement;
                    let depth = 0;
                    
                    while (container && depth < 10) {
                        // 检查容器是否包含日期或其他文章元素
                        const hasDate = container.textContent.includes('ago') || 
                                      container.querySelector('time, [class*="date"], [class*="meta"]');
                        
                        if (hasDate || container.className.includes('post') || 
                            container.className.includes('article') || 
                            container.className.includes('item')) {
                            
                            if (!allContainers.has(container)) {
                                allContainers.add(container);
                                
                                // 获取详细信息
                                const dateEl = container.querySelector('time, [class*="date"], [class*="meta"]');
                                results.detailedStructure.push({
                                    containerClass: container.className,
                                    containerTag: container.tagName,
                                    title: text,
                                    url: link.href,
                                    hasDate: !!dateEl,
                                    dateText: dateEl ? dateEl.textContent.trim() : null,
                                    parentClass: container.parentElement ? container.parentElement.className : null
                                });
                            }
                            break;
                        }
                        
                        container = container.parentElement;
                        depth++;
                    }
                }
            });
            
            // 获取前10篇文章的详细数据
            const containers = Array.from(allContainers).slice(0, 10);
            
            containers.forEach(container => {
                const link = container.querySelector('a[href*="/"]');
                if (link) {
                    const title = link.textContent.trim();
                    const url = link.href;
                    
                    // 查找日期
                    let date = null;
                    const datePatterns = [
                        /(\d+)\s*(hours?|days?|weeks?|months?)\s*ago/i,
                        /\d{1,2}\/\d{1,2}\/\d{2,4}/,
                        /\w+\s+\d{1,2},\s+\d{4}/
                    ];
                    
                    const containerText = container.textContent;
                    for (const pattern of datePatterns) {
                        const match = containerText.match(pattern);
                        if (match) {
                            date = match[0];
                            break;
                        }
                    }
                    
                    results.articleData.push({
                        title: title,
                        url: url,
                        date: date,
                        containerClass: container.className
                    });
                }
            });
            
            return results;
        });
        
        // 6. 输出分析结果
        console.log('\n✅ 找到的选择器:');
        articleAnalysis.foundSelectors.forEach(item => {
            console.log(`- ${item.selector}: ${item.count} 个元素 (示例: ${item.sample})`);
        });
        
        console.log('\n📰 详细结构分析 (前5个):');
        articleAnalysis.detailedStructure.slice(0, 5).forEach((item, i) => {
            console.log(`\n${i + 1}. ${item.title}`);
            console.log(`   容器: ${item.containerTag}.${item.containerClass}`);
            console.log(`   URL: ${item.url}`);
            console.log(`   有日期: ${item.hasDate}`);
            console.log(`   日期文本: ${item.dateText}`);
            console.log(`   父元素: ${item.parentClass}`);
        });
        
        console.log('\n📋 提取的文章数据:');
        articleAnalysis.articleData.forEach((article, i) => {
            console.log(`\n${i + 1}. ${article.title}`);
            console.log(`   URL: ${article.url}`);
            console.log(`   日期: ${article.date || '未找到'}`);
            console.log(`   容器类: ${article.containerClass}`);
        });
        
        // 7. 基于分析结果，提供最佳选择器建议
        console.log('\n💡 建议的选择器:');
        if (articleAnalysis.detailedStructure.length > 0) {
            // 统计最常见的容器类
            const classCount = {};
            articleAnalysis.detailedStructure.forEach(item => {
                const classes = item.containerClass.split(' ');
                classes.forEach(cls => {
                    if (cls && cls.includes('post') || cls.includes('article')) {
                        classCount[cls] = (classCount[cls] || 0) + 1;
                    }
                });
            });
            
            const sortedClasses = Object.entries(classCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            
            console.log('最常见的文章容器类:');
            sortedClasses.forEach(([cls, count]) => {
                console.log(`- .${cls} (出现 ${count} 次)`);
            });
        }
        
        // 8. 等待30秒供手动检查
        console.log('\n⏸️ 浏览器将在30秒后关闭...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await browser.close();
    }
}

// 运行分析
analyzeMyGolfSpyArticles().catch(console.error);