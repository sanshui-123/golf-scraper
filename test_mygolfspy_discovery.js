#!/usr/bin/env node

/**
 * 测试MyGolfSpy文章发现功能
 * 调试Cloudflare验证和文章抓取
 */

const { chromium } = require('playwright');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');

async function testMyGolfSpyDiscovery() {
    console.log('🔍 测试MyGolfSpy文章发现功能');
    console.log('═'.repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false, // 使用有头模式以便观察
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security'
        ]
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US'
        });
        
        const page = await context.newPage();
        
        // 创建MyGolfSpy处理器实例
        const myGolfSpyHandler = new MyGolfSpyImageHandler();
        
        console.log('📍 访问MyGolfSpy主页...');
        await page.goto('https://mygolfspy.com/', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        // 等待Cloudflare验证
        console.log('⏳ 等待页面加载和可能的Cloudflare验证...');
        await page.waitForTimeout(5000);
        
        // 检查是否有Cloudflare挑战
        const hasCloudflareChallenge = await page.evaluate(() => {
            const title = document.title.toLowerCase();
            const body = document.body.textContent.toLowerCase();
            return title.includes('just a moment') || 
                   body.includes('checking your browser') ||
                   body.includes('cloudflare');
        });
        
        if (hasCloudflareChallenge) {
            console.log('⚠️  检测到Cloudflare验证，等待通过...');
            
            // 等待验证完成（最多30秒）
            try {
                await page.waitForFunction(() => {
                    const title = document.title.toLowerCase();
                    return !title.includes('just a moment') && 
                           !title.includes('checking');
                }, { timeout: 30000 });
                
                console.log('✅ Cloudflare验证已通过');
            } catch (e) {
                console.log('❌ Cloudflare验证超时');
                
                // 尝试手动解决
                console.log('💡 请手动完成验证，然后按回车继续...');
                await new Promise(resolve => {
                    process.stdin.once('data', () => resolve());
                });
            }
        }
        
        // 再次等待页面稳定
        await page.waitForTimeout(3000);
        
        // 加载cookies（如果有）
        try {
            await myGolfSpyHandler.loadCookies(context);
            console.log('🍪 已加载保存的cookies');
        } catch (e) {
            console.log('📝 没有找到保存的cookies');
        }
        
        // 处理可能的弹窗
        console.log('🔍 检查并处理弹窗...');
        await myGolfSpyHandler.handlePopups(page);
        
        // 保存cookies
        await myGolfSpyHandler.saveCookies(context);
        
        // 分析页面结构
        console.log('\n📊 分析页面结构...');
        const pageInfo = await page.evaluate(() => {
            const info = {
                title: document.title,
                url: window.location.href,
                hasArticles: false,
                selectors: {
                    found: [],
                    notFound: []
                },
                articles: []
            };
            
            // 测试各种可能的文章选择器
            const selectorsToTest = [
                // 通用文章选择器
                'article',
                'article.post',
                'article.type-post',
                '.post-item',
                '.article-item',
                
                // MyGolfSpy特定选择器
                '.jeg_post',
                '.jeg_postblock',
                '.jeg_postblock_content',
                '.jeg_block_content article',
                '.jnews_block_content article',
                
                // 列表项选择器
                '.post-list-item',
                '.content-list article',
                '.article-list-item',
                
                // 其他可能的选择器
                '[class*="post-"]',
                '[class*="article-"]',
                '.entry',
                '.hentry'
            ];
            
            // 测试每个选择器
            selectorsToTest.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        info.selectors.found.push({
                            selector: selector,
                            count: elements.length
                        });
                    } else {
                        info.selectors.notFound.push(selector);
                    }
                } catch (e) {
                    // 忽略无效选择器
                }
            });
            
            // 尝试提取文章信息
            const articleContainers = document.querySelectorAll('article, .jeg_post, .post-item');
            
            articleContainers.forEach((container, index) => {
                if (index >= 10) return; // 只获取前10篇
                
                // 查找链接
                const linkSelectors = ['h3 a', 'h2 a', 'h1 a', '.entry-title a', '.post-title a', 'a[href*="/news/"]', 'a[href*="/instruction/"]'];
                let link = null;
                let title = null;
                
                for (const selector of linkSelectors) {
                    const linkElement = container.querySelector(selector);
                    if (linkElement && linkElement.href) {
                        link = linkElement.href;
                        title = linkElement.textContent.trim();
                        break;
                    }
                }
                
                // 如果没找到，尝试更通用的方法
                if (!link) {
                    const anyLink = container.querySelector('a[href]');
                    if (anyLink && anyLink.href.includes('mygolfspy.com') && 
                        !anyLink.href.includes('#') && 
                        !anyLink.href.includes('author')) {
                        link = anyLink.href;
                        title = anyLink.textContent.trim() || anyLink.getAttribute('title') || 'No title';
                    }
                }
                
                // 查找时间
                let time = null;
                const timeSelectors = ['time', '.date', '.post-date', '.entry-date', '.jeg_meta_date'];
                for (const selector of timeSelectors) {
                    const timeElement = container.querySelector(selector);
                    if (timeElement) {
                        time = timeElement.getAttribute('datetime') || 
                               timeElement.textContent.trim();
                        break;
                    }
                }
                
                if (link && title) {
                    info.articles.push({
                        title: title,
                        url: link,
                        time: time || 'No time found',
                        container: container.tagName + '.' + container.className.split(' ').slice(0, 2).join('.')
                    });
                }
            });
            
            info.hasArticles = info.articles.length > 0;
            
            return info;
        });
        
        // 显示结果
        console.log(`\n📄 页面标题: ${pageInfo.title}`);
        console.log(`🔗 当前URL: ${pageInfo.url}`);
        
        console.log('\n✅ 找到的选择器:');
        pageInfo.selectors.found.forEach(item => {
            console.log(`  - ${item.selector}: ${item.count} 个元素`);
        });
        
        if (pageInfo.hasArticles) {
            console.log(`\n📰 找到 ${pageInfo.articles.length} 篇文章:`);
            pageInfo.articles.forEach((article, index) => {
                console.log(`\n${index + 1}. ${article.title}`);
                console.log(`   URL: ${article.url}`);
                console.log(`   时间: ${article.time}`);
                console.log(`   容器: ${article.container}`);
            });
        } else {
            console.log('\n❌ 未找到文章');
            
            // 尝试滚动页面
            console.log('\n📜 尝试滚动页面加载更多内容...');
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(3000);
            
            // 再次检查
            const articlesAfterScroll = await page.evaluate(() => {
                return document.querySelectorAll('article, .jeg_post, .post-item').length;
            });
            
            console.log(`滚动后找到 ${articlesAfterScroll} 个可能的文章容器`);
        }
        
        // 截图保存当前页面状态
        await page.screenshot({ 
            path: 'mygolfspy_discovery_test.png',
            fullPage: false 
        });
        console.log('\n📸 已保存页面截图: mygolfspy_discovery_test.png');
        
        // 测试特定页面
        console.log('\n🔍 测试具体的文章列表页面...');
        const testPages = [
            'https://mygolfspy.com/news-opinion/',
            'https://mygolfspy.com/instruction/',
            'https://mygolfspy.com/reviews/'
        ];
        
        for (const testUrl of testPages) {
            console.log(`\n📍 访问: ${testUrl}`);
            try {
                await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000);
                
                const articleCount = await page.evaluate(() => {
                    return document.querySelectorAll('article, .jeg_post').length;
                });
                
                console.log(`  找到 ${articleCount} 篇文章`);
                
                if (articleCount > 0) {
                    // 获取第一篇文章的信息
                    const firstArticle = await page.evaluate(() => {
                        const article = document.querySelector('article, .jeg_post');
                        if (!article) return null;
                        
                        const link = article.querySelector('a[href]');
                        return {
                            html: article.outerHTML.substring(0, 500) + '...',
                            link: link ? link.href : null,
                            title: link ? link.textContent.trim() : null
                        };
                    });
                    
                    if (firstArticle) {
                        console.log(`  第一篇文章标题: ${firstArticle.title}`);
                        console.log(`  链接: ${firstArticle.link}`);
                        console.log(`  HTML预览:\n${firstArticle.html}`);
                    }
                }
            } catch (e) {
                console.log(`  ❌ 访问失败: ${e.message}`);
            }
        }
        
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
console.log('启动MyGolfSpy文章发现测试...\n');
testMyGolfSpyDiscovery().catch(console.error);