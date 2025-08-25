#!/usr/bin/env node

/**
 * 中国高尔夫网 (golf.net.cn) 内容发现脚本
 * 抓取最新的高尔夫文章
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function discoverGolfNetCnArticles(maxArticles = 50) {
    console.log('🏌️ 中国高尔夫网内容发现');
    console.log('═'.repeat(60));
    console.log(`📌 目标: 抓取 ${maxArticles} 篇最新文章\n`);
    
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
        
        // 要扫描的页面列表
        const sections = [
            { url: 'https://www.golf.net.cn/', name: '首页' },
            { url: 'https://www.golf.net.cn/news/', name: '高尔夫资讯' },
            { url: 'https://www.golf.net.cn/zhishi/', name: '高尔夫知识' },
            { url: 'https://www.golf.net.cn/qiuchang/', name: '高尔夫球场' }
        ];
        
        for (const section of sections) {
            console.log(`\n📄 扫描${section.name}: ${section.url}`);
            
            try {
                await page.goto(section.url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000); // 等待页面加载
                
                // 提取文章链接
                const sectionArticles = await page.evaluate(() => {
                    const articleData = [];
                    
                    // 查找所有可能的文章链接
                    // 1. 查找带有标题的链接
                    const linkSelectors = [
                        'a[href*=".html"]',
                        '.article-list a',
                        '.news-list a',
                        '.content a[href*="/zhishi/"]',
                        '.content a[href*="/news/"]',
                        '.content a[href*="/qiuchang/"]',
                        'h2 a',
                        'h3 a',
                        '.title a'
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
                        
                        // 过滤条件
                        if (!url || !title) return;
                        if (title.length < 5) return; // 标题太短可能不是文章
                        if (!url.includes('.html')) return; // 必须是HTML文件
                        if (url.includes('#')) return; // 跳过锚点链接
                        
                        // 排除非文章页面
                        const excludePatterns = [
                            /index\.html$/,
                            /\/page\/\d+/,
                            /\/tag\//,
                            /\/category\//,
                            /\/search\//
                        ];
                        
                        if (excludePatterns.some(pattern => pattern.test(url))) return;
                        
                        // 必须是站内链接
                        if (!url.includes('golf.net.cn')) return;
                        
                        // 尝试从URL中提取日期信息（如果有）
                        let publishTime = null;
                        const dateMatch = url.match(/(\d{4})\/(\d{2})\/(\d{2})/);
                        if (dateMatch) {
                            publishTime = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                        }
                        
                        articleData.push({ 
                            url: url.replace(/\?.*$/, ''), // 去除查询参数
                            title: title.substring(0, 100), // 限制标题长度
                            publishTime
                        });
                    });
                    
                    return articleData;
                });
                
                console.log(`  找到 ${sectionArticles.length} 篇文章`);
                
                // 去重并添加到总列表
                sectionArticles.forEach(article => {
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
        console.log(`  - 总共找到: ${articles.length} 篇独特文章`);
        
        if (articles.length > 0) {
            console.log('\n最新文章列表:');
            articles.slice(0, 10).forEach((article, i) => {
                console.log(`${i + 1}. [${article.section}] ${article.title}`);
                console.log(`   URL: ${article.url}`);
                if (article.publishTime) {
                    console.log(`   时间: ${article.publishTime}`);
                }
            });
            
            if (articles.length > 10) {
                console.log(`\n... 还有 ${articles.length - 10} 篇文章`);
            }
        }
        
        await browser.close();
        
        // 生成标准URL文件
        if (articles.length > 0) {
            const urlFileContent = [
                '# Generated URLs for golf.net.cn',
                `# Generated at: ${new Date().toISOString()}`,
                `# Total articles: ${articles.length}`,
                '#',
                ...articles.map(a => a.url)
            ].join('\n') + '\n';
            
            await fs.writeFile('deep_urls_golf_net_cn.txt', urlFileContent);
            console.log(`\n💾 已保存 ${articles.length} 个URL到 deep_urls_golf_net_cn.txt`);
            
            // 保存详细信息供分析
            await fs.writeFile('golf_net_cn_details.json', 
                JSON.stringify(articles, null, 2));
            console.log(`💾 详细信息已保存到 golf_net_cn_details.json`);
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
                const processCmd = spawn('node', ['batch_process_articles.js', 'deep_urls_golf_net_cn.txt'], {
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
    
    discoverGolfNetCnArticles(maxArticles)
        .then(count => {
            console.log(`\n✅ 完成！找到 ${count} 篇文章`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = discoverGolfNetCnArticles;