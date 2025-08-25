#!/usr/bin/env node

/**
 * Yardbarker Golf 内容发现脚本
 * 抓取高尔夫文章，过滤视频和外部链接
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class YardbarkerDiscoverer {
    constructor(options = {}) {
        this.maxArticles = options.maxArticles || 50;
        this.urlsOnly = options.urlsOnly || false;
        this.debug = options.debug || false;
        this.outputFile = 'deep_urls_yardbarker_com.txt';
        this.minContentLength = 500; // 最小内容长度
    }

    async discover() {
        console.log('🏌️ Yardbarker Golf 文章发现器');
        console.log('═'.repeat(60));
        console.log(`目标: 获取最多 ${this.maxArticles} 篇文章`);
        console.log('特性: 过滤外部链接、视频、测验文章\n');
        
        let browser;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ]
            });

            const context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            const page = await context.newPage();
            page.setDefaultTimeout(60000);
            
            const allArticles = new Map();
            
            // 访问主页面
            console.log('📄 访问 Yardbarker Golf 主页...');
            await page.goto('https://www.yardbarker.com/golf', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            // 等待页面加载
            await page.waitForTimeout(2000);
            
            // 滚动加载更多内容
            console.log('📜 滚动页面加载更多文章...');
            let previousHeight = 0;
            let scrollAttempts = 0;
            const maxScrolls = 8;
            
            while (scrollAttempts < maxScrolls) {
                previousHeight = await page.evaluate(() => document.body.scrollHeight);
                
                // 滚动到页面底部
                await page.evaluate(() => window.scrollBy(0, 1000));
                await page.waitForTimeout(1500);
                
                // 检查是否有"Load More"按钮
                const loadMoreButton = await page.$('button[class*="load-more"], button[class*="show-more"], a[class*="load-more"]');
                if (loadMoreButton) {
                    try {
                        await loadMoreButton.click();
                        console.log('   点击了"加载更多"按钮');
                        await page.waitForTimeout(2000);
                    } catch (e) {
                        // 按钮可能不可点击
                    }
                }
                
                const newHeight = await page.evaluate(() => document.body.scrollHeight);
                if (newHeight === previousHeight) {
                    console.log('   已到达页面底部');
                    break;
                }
                
                scrollAttempts++;
                
                // 如果已经收集足够的文章，提前退出
                const currentArticles = await page.evaluate(() => {
                    return document.querySelectorAll('a[href*="/golf/articles/"]').length;
                });
                
                if (currentArticles >= this.maxArticles * 1.5) {
                    console.log(`   已发现足够的文章链接 (${currentArticles})`);
                    break;
                }
            }
            
            // 提取文章链接
            const articles = await page.evaluate(() => {
                const articleData = [];
                const seenUrls = new Set();
                
                // 查找所有文章链接
                const links = document.querySelectorAll('a[href*="/golf/articles/"]');
                
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 获取时间信息
                    let timeInfo = null;
                    const listHead = link.closest('.list_head');
                    if (listHead) {
                        const timeElement = listHead.querySelector('.trending_time');
                        if (timeElement) {
                            timeInfo = timeElement.textContent.trim();
                        }
                    }
                    
                    // URL过滤条件
                    if (url && 
                        url.includes('yardbarker.com/golf/articles/') &&
                        !url.includes('/quiz') &&
                        !url.includes('/video/') &&
                        !url.includes('/gallery/') &&
                        !title.toLowerCase().includes('quiz') &&
                        title.length > 10 &&
                        !seenUrls.has(url)) {
                        
                        seenUrls.add(url);
                        
                        articleData.push({
                            url: url,
                            title: title,
                            time: timeInfo
                        });
                    }
                });
                
                return articleData;
            });
            
            console.log(`\n📊 初步发现 ${articles.length} 个文章链接`);
            
            // 验证文章（可选：检查是否为外部链接）
            if (articles.length > 0 && !this.urlsOnly) {
                console.log('\n🔍 验证文章质量...');
                const validatedArticles = [];
                
                for (let i = 0; i < Math.min(articles.length, 5); i++) {
                    const article = articles[i];
                    try {
                        console.log(`   检查: ${article.title.substring(0, 50)}...`);
                        await page.goto(article.url, { 
                            waitUntil: 'domcontentloaded',
                            timeout: 15000 
                        });
                        
                        // 检查是否有外部链接标记
                        const isExternal = await page.$eval('a[rel="nofollow"]', 
                            el => el && !el.href.includes('yardbarker.com')
                        ).catch(() => false);
                        
                        if (isExternal) {
                            console.log('     ⚠️ 外部链接文章，跳过');
                            continue;
                        }
                        
                        // 检查内容长度
                        const contentLength = await page.evaluate(() => {
                            const article = document.querySelector('.art_body, .article-body, [class*="article-content"]');
                            return article ? article.textContent.trim().length : 0;
                        });
                        
                        if (contentLength < 200) {
                            console.log(`     ⚠️ 内容过少 (${contentLength}字符)，可能是视频文章`);
                            continue;
                        }
                        
                        console.log('     ✅ 有效文章');
                        validatedArticles.push(article);
                        
                    } catch (error) {
                        console.log(`     ❌ 验证失败: ${error.message}`);
                    }
                }
                
                console.log(`\n验证完成，样本有效率: ${validatedArticles.length}/5`);
            }
            
            // 按时间排序（如果有时间信息）
            articles.sort((a, b) => {
                // 简单的时间排序：sec < min < hour < day
                const timeOrder = { 'sec': 1, 'min': 2, 'hour': 3, 'day': 4 };
                
                const getTimeValue = (time) => {
                    if (!time) return 999;
                    for (const unit of Object.keys(timeOrder)) {
                        if (time.includes(unit)) {
                            const num = parseInt(time) || 1;
                            return num * timeOrder[unit];
                        }
                    }
                    return 999;
                };
                
                return getTimeValue(a.time) - getTimeValue(b.time);
            });
            
            // 限制数量
            const finalArticles = articles.slice(0, this.maxArticles);
            
            console.log(`\n📊 最终保留 ${finalArticles.length} 篇文章`);
            
            // 保存结果
            const urls = finalArticles.map(a => a.url).join('\n');
            await fs.writeFile(this.outputFile, urls + '\n');
            console.log(`\n✅ URL已保存到: ${this.outputFile}`);
            
            if (this.urlsOnly) {
                console.log('\n生成的URL列表:');
                finalArticles.slice(0, 10).forEach((article, index) => {
                    console.log(`${article.url}`);
                    if (article.time) {
                        console.log(`   时间: ${article.time}`);
                    }
                });
                if (finalArticles.length > 10) {
                    console.log(`... 还有 ${finalArticles.length - 10} 个URL`);
                }
            }
            
            return finalArticles;
            
        } catch (error) {
            console.error('❌ 发现过程出错:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

// 命令行参数处理
if (require.main === module) {
    const args = process.argv.slice(2);
    const maxArticles = parseInt(args[0]) || 50;
    const urlsOnly = args.includes('--urls-only');
    const debug = args.includes('--debug');
    
    const discoverer = new YardbarkerDiscoverer({
        maxArticles,
        urlsOnly,
        debug
    });
    
    discoverer.discover()
        .then(articles => {
            console.log(`\n✅ 完成! 共发现 ${articles.length} 篇文章`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = YardbarkerDiscoverer;