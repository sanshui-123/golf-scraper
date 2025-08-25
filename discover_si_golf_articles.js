#!/usr/bin/env node

/**
 * Sports Illustrated Golf 内容发现脚本
 * 只抓取高尔夫相关文章，过滤其他运动内容
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function discoverSIGolfArticles(maxArticles = 50) {
    console.log('🏌️ Sports Illustrated Golf 内容发现');
    console.log('═'.repeat(60));
    console.log(`📌 目标: 抓取 ${maxArticles} 篇高尔夫文章（过滤其他运动）\n`);
    
    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        timeout: 60000
    });
    
    try {
        const page = await browser.newPage();
        
        // 设置默认超时
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(30000);
        
        const allArticles = new Map();
        
        // 要扫描的页面列表（SI Golf的各个栏目）
        const sections = [
            { url: 'https://www.si.com/golf', name: 'Golf主页' },
            { url: 'https://www.si.com/golf/news', name: '高尔夫新闻' },
            { url: 'https://www.si.com/golf/instruction', name: '高尔夫教学' },
            { url: 'https://www.si.com/golf/equipment', name: '高尔夫装备' },
            { url: 'https://www.si.com/golf/travel', name: '高尔夫旅游' },
            { url: 'https://www.si.com/golf/courses', name: '高尔夫球场' }
        ];
        
        // 排除的运动关键词
        const excludeKeywords = [
            'NBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'Tennis', 
            'Basketball', 'Football', 'Baseball', 'Hockey',
            'Olympics', 'UFC', 'Boxing', 'MMA', 'NASCAR',
            'Formula 1', 'F1', 'Cricket', 'Rugby'
        ];
        
        for (const section of sections) {
            console.log(`\n📄 扫描${section.name}: ${section.url}`);
            
            try {
                await page.goto(section.url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000); // 等待页面加载
                
                // 提取文章链接
                const sectionArticles = await page.evaluate(() => {
                    const articleData = [];
                    
                    // SI网站可能使用的文章链接选择器
                    const linkSelectors = [
                        'article a[href*="/golf/"]',
                        '.article-list a[href*="/golf/"]',
                        '.m-card a[href*="/golf/"]',
                        'h2 a[href*="/golf/"]',
                        'h3 a[href*="/golf/"]',
                        '.headline a[href*="/golf/"]',
                        '.media-object a[href*="/golf/"]',
                        'a.m-card--header[href*="/golf/"]'
                    ];
                    
                    const links = new Set();
                    linkSelectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(link => {
                            links.add(link);
                        });
                    });
                    
                    links.forEach(link => {
                        const url = link.href;
                        const title = (link.textContent || link.title || '').trim();
                        
                        // 基本过滤
                        if (!url || !title) return;
                        if (title.length < 10) return; // 标题太短
                        
                        // 必须是SI网站的链接
                        if (!url.includes('si.com')) return;
                        
                        // 必须包含 /golf/ 路径
                        if (!url.includes('/golf/')) return;
                        
                        // 排除非文章页面
                        const excludePatterns = [
                            /\/tag\//,
                            /\/category\//,
                            /\/author\//,
                            /\/page\/\d+/,
                            /\/search\//,
                            /#/
                        ];
                        
                        if (excludePatterns.some(pattern => pattern.test(url))) return;
                        
                        // 排除其他运动的URL
                        const otherSportsPatterns = [
                            /\/nba\//i, /\/nfl\//i, /\/mlb\//i, /\/nhl\//i,
                            /\/soccer\//i, /\/tennis\//i, /\/olympics\//i,
                            /\/mma\//i, /\/boxing\//i, /\/nascar\//i
                        ];
                        
                        if (otherSportsPatterns.some(pattern => pattern.test(url))) return;
                        
                        articleData.push({ 
                            url: url.split('?')[0], // 去除查询参数
                            title: title.substring(0, 150) // 限制标题长度
                        });
                    });
                    
                    return articleData;
                });
                
                // 二次过滤：检查标题中的运动关键词
                const filteredArticles = sectionArticles.filter(article => {
                    const titleLower = article.title.toLowerCase();
                    
                    // 排除包含其他运动关键词的文章
                    const hasOtherSports = excludeKeywords.some(keyword => 
                        titleLower.includes(keyword.toLowerCase())
                    );
                    
                    if (hasOtherSports) {
                        console.log(`  ⏭️ 过滤掉非高尔夫文章: ${article.title}`);
                        return false;
                    }
                    
                    return true;
                });
                
                console.log(`  找到 ${sectionArticles.length} 篇文章，过滤后保留 ${filteredArticles.length} 篇`);
                
                // 去重并添加到总列表
                filteredArticles.forEach(article => {
                    if (!allArticles.has(article.url)) {
                        allArticles.set(article.url, {
                            ...article,
                            section: section.name
                        });
                    }
                });
                
                // 如果已经收集够了，提前结束
                if (allArticles.size >= maxArticles) {
                    console.log(`\n✅ 已收集到目标数量的文章`);
                    break;
                }
                
            } catch (error) {
                console.error(`  ❌ 扫描${section.name}失败:`, error.message);
            }
        }
        
        // 转换为数组并限制数量
        let articles = Array.from(allArticles.values());
        articles = articles.slice(0, maxArticles);
        
        console.log('\n📊 扫描结果:');
        console.log(`  - 总共找到: ${articles.length} 篇高尔夫文章`);
        
        if (articles.length > 0) {
            console.log('\n最新文章列表:');
            articles.slice(0, 10).forEach((article, i) => {
                console.log(`${i + 1}. [${article.section}] ${article.title}`);
                console.log(`   URL: ${article.url}`);
            });
            
            if (articles.length > 10) {
                console.log(`\n... 还有 ${articles.length - 10} 篇文章`);
            }
        }
        
        await browser.close();
        
        // 生成标准URL文件
        if (articles.length > 0) {
            const urlFileContent = [
                '# Generated URLs for si.com/golf',
                `# Generated at: ${new Date().toISOString()}`,
                `# Total articles: ${articles.length}`,
                '#',
                ...articles.map(a => a.url)
            ].join('\n') + '\n';
            
            await fs.writeFile('deep_urls_si_com.txt', urlFileContent);
            console.log(`\n💾 已保存 ${articles.length} 个URL到 deep_urls_si_com.txt`);
            
            // 保存详细信息供分析
            await fs.writeFile('si_golf_details.json', 
                JSON.stringify(articles, null, 2));
            console.log(`💾 详细信息已保存到 si_golf_details.json`);
        }
        
        // 根据命令行参数决定输出
        if (process.argv.includes('--urls-only')) {
            // 符合框架要求：只输出URL到stdout
            articles.forEach(article => {
                console.log(article.url);
            });
        } else if (process.argv.includes('--auto-process')) {
            // 自动处理文章
            if (articles.length > 0) {
                console.log('\n🚀 开始处理文章...');
                const { spawn } = require('child_process');
                const processCmd = spawn('node', ['batch_process_articles.js', 'deep_urls_si_com.txt'], {
                    stdio: 'inherit'
                });
                
                processCmd.on('close', (code) => {
                    console.log(`处理完成，退出码: ${code}`);
                });
            }
        }
        
        return articles.length;
        
    } catch (error) {
        console.error('❌ 发生错误:', error);
        await browser.close();
        throw error;
    }
}

// 如果直接运行脚本
if (require.main === module) {
    // 从命令行参数获取文章数量，默认50
    const maxArticles = parseInt(process.argv[2]) || 50;
    
    discoverSIGolfArticles(maxArticles)
        .then(count => {
            console.log(`\n✅ 完成！找到 ${count} 篇高尔夫文章`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = discoverSIGolfArticles;