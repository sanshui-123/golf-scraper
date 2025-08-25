#!/usr/bin/env node

/**
 * 高级MyGolfSpy文章发现测试
 * 处理动态内容和Ajax加载
 */

const { chromium } = require('playwright');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');

async function advancedMyGolfSpyTest() {
    console.log('🔍 高级MyGolfSpy文章发现测试');
    console.log('═'.repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        // 创建MyGolfSpy处理器实例
        const myGolfSpyHandler = new MyGolfSpyImageHandler();
        
        // 加载cookies
        try {
            await myGolfSpyHandler.loadCookies(context);
            console.log('🍪 已加载保存的cookies');
        } catch (e) {
            console.log('📝 没有找到保存的cookies');
        }
        
        console.log('📍 访问MyGolfSpy新闻页面...');
        await page.goto('https://mygolfspy.com/news-opinion/', { 
            waitUntil: 'networkidle',
            timeout: 60000 
        });
        
        // 等待页面完全加载
        console.log('⏳ 等待内容加载...');
        await page.waitForTimeout(5000);
        
        // 处理弹窗
        await myGolfSpyHandler.handlePopups(page);
        await myGolfSpyHandler.saveCookies(context);
        
        // 深度分析页面结构
        console.log('\n📊 深度分析页面结构...');
        const analysis = await page.evaluate(() => {
            const result = {
                pageTitle: document.title,
                url: window.location.href,
                allElements: {},
                articles: [],
                possibleContainers: []
            };
            
            // 统计所有元素
            const allElements = document.querySelectorAll('*');
            allElements.forEach(elem => {
                const tagName = elem.tagName.toLowerCase();
                result.allElements[tagName] = (result.allElements[tagName] || 0) + 1;
            });
            
            // 查找所有包含链接的容器
            const containers = document.querySelectorAll('div, article, section, li');
            containers.forEach(container => {
                const links = container.querySelectorAll('a[href]');
                if (links.length > 0) {
                    links.forEach(link => {
                        const href = link.href;
                        // 过滤掉非文章链接
                        if (href.includes('mygolfspy.com') && 
                            !href.includes('#') && 
                            !href.includes('author') &&
                            !href.includes('category') &&
                            !href.includes('tag') &&
                            !href.includes('.jpg') &&
                            !href.includes('.png') &&
                            (href.includes('/news/') || 
                             href.includes('/instruction/') || 
                             href.includes('/review/') ||
                             href.includes('/first-look/') ||
                             href.includes('/news-opinion/'))) {
                            
                            // 获取标题
                            let title = link.textContent.trim();
                            if (!title) {
                                // 尝试从图片alt获取
                                const img = link.querySelector('img');
                                if (img) {
                                    title = img.alt || img.title || '';
                                }
                            }
                            
                            // 如果还是没有标题，查找附近的标题元素
                            if (!title || title.length < 10) {
                                const parent = link.closest('div, article, li');
                                if (parent) {
                                    const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
                                    if (heading) {
                                        title = heading.textContent.trim();
                                    }
                                }
                            }
                            
                            if (title && title.length > 10) {
                                // 查找日期
                                let date = null;
                                const parent = link.closest('div, article, li');
                                if (parent) {
                                    const dateElement = parent.querySelector('time, .date, .post-date, [class*="date"]');
                                    if (dateElement) {
                                        date = dateElement.getAttribute('datetime') || dateElement.textContent.trim();
                                    }
                                }
                                
                                // 记录容器信息
                                const containerInfo = {
                                    tag: container.tagName,
                                    classes: container.className,
                                    id: container.id
                                };
                                
                                result.articles.push({
                                    title: title,
                                    url: href,
                                    date: date,
                                    container: containerInfo
                                });
                                
                                // 记录可能的容器类名
                                if (container.className) {
                                    result.possibleContainers.push(container.className);
                                }
                            }
                        }
                    });
                }
            });
            
            // 去重
            result.articles = result.articles.filter((article, index, self) =>
                index === self.findIndex((a) => a.url === article.url)
            );
            
            // 查找特定的文章结构
            const specificSelectors = [
                '.post-box-big',
                '.post-box-small',
                '.jeg_post_title',
                '.jeg_thumb',
                '.post-item',
                '[class*="article"]',
                '[class*="post-"]'
            ];
            
            result.specificElements = {};
            specificSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        result.specificElements[selector] = elements.length;
                    }
                } catch (e) {
                    // 忽略
                }
            });
            
            return result;
        });
        
        // 显示分析结果
        console.log(`\n📄 页面标题: ${analysis.pageTitle}`);
        console.log(`🔗 当前URL: ${analysis.url}`);
        
        console.log('\n📊 页面元素统计:');
        const importantTags = ['article', 'section', 'div', 'a', 'h1', 'h2', 'h3', 'img'];
        importantTags.forEach(tag => {
            if (analysis.allElements[tag]) {
                console.log(`  ${tag}: ${analysis.allElements[tag]} 个`);
            }
        });
        
        console.log('\n🎯 特定选择器匹配:');
        Object.entries(analysis.specificElements).forEach(([selector, count]) => {
            console.log(`  ${selector}: ${count} 个`);
        });
        
        if (analysis.articles.length > 0) {
            console.log(`\n📰 找到 ${analysis.articles.length} 篇文章:`);
            
            // 分析容器模式
            const containerPatterns = {};
            analysis.articles.forEach(article => {
                const pattern = `${article.container.tag}.${article.container.classes.split(' ')[0]}`;
                containerPatterns[pattern] = (containerPatterns[pattern] || 0) + 1;
            });
            
            console.log('\n📦 文章容器模式:');
            Object.entries(containerPatterns)
                .sort((a, b) => b[1] - a[1])
                .forEach(([pattern, count]) => {
                    console.log(`  ${pattern}: ${count} 篇`);
                });
            
            // 显示前5篇文章
            console.log('\n📋 文章列表（前5篇）:');
            analysis.articles.slice(0, 5).forEach((article, index) => {
                console.log(`\n${index + 1}. ${article.title}`);
                console.log(`   URL: ${article.url}`);
                console.log(`   日期: ${article.date || '无日期'}`);
                console.log(`   容器: ${article.container.tag}${article.container.id ? '#' + article.container.id : ''}.${article.container.classes}`);
            });
            
            // 根据发现的模式更新选择器
            if (analysis.articles.length > 0) {
                const firstArticle = analysis.articles[0];
                const containerClass = firstArticle.container.classes.split(' ')[0];
                
                console.log('\n💡 建议的选择器:');
                console.log(`  主容器: .${containerClass}`);
                console.log(`  标题链接: .${containerClass} a[href*="/news/"], .${containerClass} a[href*="/instruction/"]`);
            }
        } else {
            console.log('\n❌ 未找到文章');
            
            // 尝试其他方法
            console.log('\n🔍 尝试查找所有链接...');
            const allLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return links
                    .filter(link => link.href.includes('mygolfspy.com') && 
                                   (link.href.includes('/news/') || 
                                    link.href.includes('/instruction/') ||
                                    link.href.includes('/review/')))
                    .slice(0, 10)
                    .map(link => ({
                        url: link.href,
                        text: link.textContent.trim(),
                        parent: link.parentElement.tagName + '.' + link.parentElement.className
                    }));
            });
            
            if (allLinks.length > 0) {
                console.log(`找到 ${allLinks.length} 个可能的文章链接:`);
                allLinks.forEach((link, index) => {
                    console.log(`${index + 1}. ${link.text || link.url}`);
                    console.log(`   父元素: ${link.parent}`);
                });
            }
        }
        
        // 截图
        await page.screenshot({ 
            path: 'mygolfspy_advanced_test.png',
            fullPage: true 
        });
        console.log('\n📸 已保存完整页面截图: mygolfspy_advanced_test.png');
        
        // 尝试直接访问一篇文章测试
        console.log('\n🔍 测试直接访问文章...');
        const testArticleUrl = 'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/';
        await page.goto(testArticleUrl, { waitUntil: 'networkidle' });
        
        const articleTest = await page.evaluate(() => {
            return {
                title: document.querySelector('h1, .entry-title')?.textContent.trim(),
                hasContent: !!document.querySelector('.entry-content, .post-content, article'),
                contentLength: document.body.textContent.length
            };
        });
        
        console.log('\n📄 文章测试结果:');
        console.log(`  标题: ${articleTest.title || '未找到'}`);
        console.log(`  有内容: ${articleTest.hasContent ? '是' : '否'}`);
        console.log(`  内容长度: ${articleTest.contentLength} 字符`);
        
    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        console.log('\n按回车键关闭浏览器...');
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });
        
        await browser.close();
    }
}

// 运行测试
console.log('启动高级MyGolfSpy测试...\n');
advancedMyGolfSpyTest().catch(console.error);