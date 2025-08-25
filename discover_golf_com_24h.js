#!/usr/bin/env node

/**
 * Golf.com 内容发现脚本 - 增强版
 * 真正搜索24小时内的最新文章
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function discoverGolfCom24h() {
    console.log('🏌️ Golf.com 24小时内容发现 - 增强版');
    console.log('═'.repeat(60));
    console.log('📌 真正筛选24小时内的文章\n');
    
    const browser = await chromium.launch({ 
        headless: false,
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
        page.setDefaultNavigationTimeout(60000);
        
        const allArticles = new Map();
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        // 访问Golf.com主页和各个分类页面
        const sections = [
            { url: 'https://golf.com/', name: '首页' },
            { url: 'https://golf.com/news/', name: '新闻' },
            { url: 'https://golf.com/news/?p=2', name: '新闻第2页' },
            { url: 'https://golf.com/instruction/', name: '教学' },
            { url: 'https://golf.com/gear/', name: '装备' },
            { url: 'https://golf.com/travel/', name: '旅游' }
        ];
        
        for (const section of sections) {
            console.log(`\n📄 扫描${section.name}: ${section.url}`);
            
            try {
                // 使用更宽松的加载策略和更长的超时时间
                await page.goto(section.url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 60000 
                });
                
                // 等待关键元素出现
                try {
                    await page.waitForSelector('.m-card, .c-entry-group-labels__item, article', {
                        timeout: 10000
                    });
                } catch (e) {
                    console.log('  ⚠️  页面可能未完全加载，继续处理...');
                }
                
                await page.waitForTimeout(2000);
                
                // 提取文章信息
                const sectionArticles = await page.evaluate(() => {
                    const articleData = [];
                    const today = new Date();
                    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                    
                    // Golf.com特定选择器
                    const selectors = [
                        '.g-article-prev',
                        '.m-card--horizontal',
                        '.m-card--vertical', 
                        '.m-card',
                        '.c-entry-group-labels__item',
                        'article[class*="card"]',
                        'article',
                        'a[href*="/2025/"][href$="/"]' // 查找2025年的文章
                    ];
                    
                    const containers = document.querySelectorAll(selectors.join(', '));
                    
                    containers.forEach(container => {
                        // 查找链接
                        let linkElement = container.querySelector('a[href*="/news/"], a[href*="/instruction/"], a[href*="/gear/"], a[href*="/travel/"]');
                        
                        if (!linkElement && container.tagName === 'A') {
                            linkElement = container;
                        }
                        
                        if (!linkElement) {
                            const allLinks = container.querySelectorAll('a[href]');
                            for (const link of allLinks) {
                                if (link.href && (link.href.includes('/news/') || 
                                    link.href.includes('/instruction/') || 
                                    link.href.includes('/gear/') || 
                                    link.href.includes('/travel/'))) {
                                    linkElement = link;
                                    break;
                                }
                            }
                        }
                        
                        if (!linkElement) return;
                        
                        const url = linkElement.href;
                        
                        // 增强的过滤规则，避免抓取分类页面
                        // 检查URL结构
                        const urlPath = url.replace('https://golf.com', '').replace(/\/$/, '');
                        const pathSegments = urlPath.split('/').filter(seg => seg);
                        
                        // 跳过非文章链接的情况
                        if (!url || 
                            url.includes('#') || 
                            url.includes('page=') || 
                            url.includes('/tag/') || 
                            url.includes('/category/') ||
                            url.includes('/author/') ||
                            url.includes('/search/')) {
                            return;
                        }
                        
                        // 跳过明确的分类页面
                        // 只有1个路径段的肯定是分类页 (如 /news/, /instruction/)
                        if (pathSegments.length === 1) {
                            return;
                        }
                        
                        // 检查是否为已知的分类页面模式
                        const lastSegment = pathSegments[pathSegments.length - 1];
                        
                        // 已知的分类关键词（这些作为最后一个段时通常是分类页）
                        const categoryKeywords = [
                            'page', 'category', 'tag', 'author',
                            'best-of', 'how-to', 'tips-and-tricks',
                            // Golf装备分类
                            'drivers', 'irons', 'wedges', 'putters', 'balls',
                            'woods', 'hybrids', 'shafts', 'grips', 'bags'
                        ];
                        
                        // 如果URL完全匹配这些模式，则为分类页
                        const categoryPatterns = [
                            /\/instruction\/tips\/?$/,
                            /\/instruction\/basics\/?$/,
                            /\/instruction\/rules\/?$/,  // 确认的分类页
                            /\/gear\/best\/?$/,
                            /\/gear\/reviews\/?$/,
                            /\/news\/page\/\d+\/?$/,
                            // 装备分类页面
                            /\/gear\/drivers\/?$/,
                            /\/gear\/irons\/?$/,
                            /\/gear\/wedges\/?$/,
                            /\/gear\/putters\/?$/,
                            /\/gear\/balls\/?$/,
                            /\/gear\/woods\/?$/,
                            /\/gear\/hybrids\/?$/
                        ];
                        
                        if (categoryPatterns.some(pattern => pattern.test(url))) {
                            return;
                        }
                        
                        // 如果最后一个段是纯分类词（无连字符），可能是分类页
                        if (pathSegments.length === 2 && categoryKeywords.includes(lastSegment)) {
                            return;
                        }
                        
                        // 对于2段路径，倾向于保留（Golf.com的文章经常是2段）
                        // 只过滤明显的分类页
                        
                        // 获取标题
                        let title = container.querySelector('h2, h3, h4, .g-article-prev__title')?.textContent?.trim() || '';
                        
                        if (!title) {
                            title = linkElement.textContent?.trim() || '';
                        }
                        
                        if (!title || title.length < 5) return;
                        
                        // 查找时间信息
                        let publishTime = null;
                        let publishDate = null;
                        let isRecent = false;
                        
                        // 1. 检查URL中的日期
                        const urlDateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                        if (urlDateMatch) {
                            const [_, year, month, day] = urlDateMatch;
                            publishDate = new Date(year, month - 1, day);
                            publishTime = publishDate.toISOString();
                            const hoursDiff = (today - publishDate) / (1000 * 60 * 60);
                            isRecent = hoursDiff <= 24;
                        }
                        
                        // 2. 查找time元素
                        if (!publishTime) {
                            const timeElement = container.querySelector('time[datetime]');
                            if (timeElement) {
                                publishTime = timeElement.getAttribute('datetime');
                                publishDate = new Date(publishTime);
                                const hoursDiff = (today - publishDate) / (1000 * 60 * 60);
                                isRecent = hoursDiff <= 24;
                            }
                        }
                        
                        // 3. 查找相对时间文本
                        if (!publishTime) {
                            const textContent = container.textContent || '';
                            const relativeTimeMatch = textContent.match(/(\d+)\s*(hour|hr|hours|hrs|minute|min)\s*ago/i);
                            if (relativeTimeMatch) {
                                const amount = parseInt(relativeTimeMatch[1]);
                                const unit = relativeTimeMatch[2].toLowerCase();
                                if (unit.includes('hour')) {
                                    publishDate = new Date(Date.now() - amount * 60 * 60 * 1000);
                                } else {
                                    publishDate = new Date(Date.now() - amount * 60 * 1000);
                                }
                                publishTime = publishDate.toISOString();
                                isRecent = true;
                            }
                        }
                        
                        // 4. "today" 或 "1 day ago"
                        if (!publishTime) {
                            const textContent = container.textContent || '';
                            if (textContent.toLowerCase().includes('today')) {
                                publishDate = new Date();
                                publishTime = publishDate.toISOString();
                                isRecent = true;
                            } else if (textContent.match(/1\s*day\s*ago/i)) {
                                publishDate = yesterday;
                                publishTime = publishDate.toISOString();
                                isRecent = true;
                            }
                        }
                        
                        // 只添加24小时内的文章或无法确定时间的文章
                        if (url && title && (isRecent || !publishTime)) {
                            articleData.push({ 
                                url, 
                                title, 
                                publishTime,
                                hasTime: !!publishTime,
                                isRecent: isRecent
                            });
                        }
                    });
                    
                    return articleData;
                });
                
                const recentCount = sectionArticles.filter(a => a.isRecent).length;
                console.log(`  找到 ${sectionArticles.length} 篇文章${recentCount > 0 ? `，其中 ${recentCount} 篇为24小时内` : ''}`);
                
                // 去重并添加到总列表
                sectionArticles.forEach(article => {
                    if (!allArticles.has(article.url)) {
                        allArticles.set(article.url, {
                            ...article,
                            section: section.name
                        });
                    }
                });
                
            } catch (error) {
                console.error(`  ❌ 扫描${section.name}失败:`, error.message);
            }
        }
        
        // 转换为数组
        const articles = Array.from(allArticles.values());
        
        // 分类统计
        const recentArticles = articles.filter(a => a.isRecent);
        const possiblyRecentArticles = articles.filter(a => !a.hasTime);
        
        console.log('\n📊 扫描结果:');
        console.log(`  - 总共找到: ${articles.length} 篇独特文章`);
        console.log(`  - 确认24小时内: ${recentArticles.length} 篇`);
        console.log(`  - 可能为新文章(无时间): ${possiblyRecentArticles.length} 篇`);
        
        // 合并结果，优先24小时内的文章
        const finalArticles = [...recentArticles, ...possiblyRecentArticles];
        
        if (finalArticles.length > 0) {
            console.log('\n最近文章列表:');
            finalArticles.slice(0, 10).forEach((article, i) => {
                const timeStr = article.publishTime ? 
                    new Date(article.publishTime).toLocaleString('zh-CN') : 
                    '(时间未知)';
                console.log(`${i + 1}. [${article.section}] ${article.title}`);
                console.log(`   URL: ${article.url}`);
                console.log(`   时间: ${timeStr} ${article.isRecent ? '✅' : ''}`);
            });
            
            if (finalArticles.length > 10) {
                console.log(`\n... 还有 ${finalArticles.length - 10} 篇文章`);
            }
        }
        
        await browser.close();
        
        // 保存文章URL列表
        if (finalArticles.length > 0) {
            const urlList = finalArticles.map(a => a.url).join('\n');
            await fs.writeFile('deep_urls_golf_com.txt', urlList);
            console.log(`\n💾 已保存 ${finalArticles.length} 个URL到 deep_urls_golf_com.txt`);
            
            // 保存详细信息供分析
            await fs.writeFile('golf_com_24h_details.json', 
                JSON.stringify(finalArticles, null, 2));
            console.log(`💾 详细信息已保存到 golf_com_24h_details.json`);
        }
        
        // 根据命令行参数决定输出
        if (process.argv.includes('--urls-only')) {
            // 只输出URL
            finalArticles.forEach(article => {
                console.log(article.url);
            });
        } else if (process.argv.includes('--auto-process')) {
            // 自动处理文章
            if (finalArticles.length > 0) {
                console.log('\n🚀 开始处理文章...');
                const { spawn } = require('child_process');
                const processCmd = spawn('node', ['batch_process_articles.js', 'deep_urls_golf_com.txt'], {
                    stdio: 'inherit'
                });
                
                processCmd.on('close', (code) => {
                    console.log(`处理完成，退出码: ${code}`);
                });
            }
        }
        
        return finalArticles.length;
        
    } catch (error) {
        console.error('❌ 发生错误:', error);
        await browser.close();
        throw error;
    }
}

// 如果直接运行脚本
if (require.main === module) {
    discoverGolfCom24h()
        .then(count => {
            console.log(`\n✅ 完成！找到 ${count} 篇文章`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = discoverGolfCom24h;