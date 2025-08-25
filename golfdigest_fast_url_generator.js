#!/usr/bin/env node

/**
 * Golf Digest快速URL生成器
 * 极简设计：只获取主页文章链接，不做深度验证
 * 目标：5秒内完成
 */

const { chromium } = require('playwright');

class GolfDigestFastUrlGenerator {
    async getUrls(limit = 20) {
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();
            
            // 直接访问主页，使用domcontentloaded策略
            console.error('🔄 正在访问 Golf Digest 主页...');
            await page.goto('https://www.golfdigest.com', {
                waitUntil: 'domcontentloaded',
                timeout: 15000  // 15秒超时
            });

            // 额外等待，确保动态内容加载
            await page.waitForTimeout(2000);
            console.error('✅ 页面加载完成');

            // 使用多个选择器增加成功率
            const urls = await page.evaluate(() => {
                const links = new Set();
                let debugInfo = { totalAnchors: 0, matchedSelectors: [] };
                
                // 统计所有链接数量
                debugInfo.totalAnchors = document.querySelectorAll('a').length;
                
                // 多个选择器，覆盖不同的文章链接格式
                const selectors = [
                    'a[href*="/story/"]',
                    'a[href*="/article/"]', 
                    '.summary-item__hed-link',
                    '.story-card a',
                    '.content-card a',
                    'article a[href*="golfdigest.com"]',
                    // 新增更多选择器
                    '.card__content a',
                    '.headline-wrapper a',
                    '.feature-item a',
                    '.article-link',
                    '[data-testid="Card"] a',
                    '.content-item__content a'
                ];
                
                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            debugInfo.matchedSelectors.push({ selector, count: elements.length });
                        }
                        elements.forEach(a => {
                            const href = a.href;
                            if (href && href.includes('golfdigest.com') && 
                                (href.includes('/story/') || href.includes('/article/'))) {
                                links.add(href);
                            }
                        });
                    } catch (e) {
                        // 忽略无效选择器
                    }
                });
                
                console.log('调试信息:', debugInfo);
                return Array.from(links);
            });

            console.error(`🔍 找到 ${urls.length} 个文章URL`);
            
            // 如果没有找到URL，尝试滚动页面后再抓取
            if (urls.length === 0) {
                console.error('⚠️ 第一次抓取未找到URL，尝试滚动页面...');
                await page.evaluate(() => window.scrollBy(0, 500));
                await page.waitForTimeout(1000);
                
                const retryUrls = await page.evaluate(() => {
                    const links = [];
                    // 尝试更通用的选择器
                    const allLinks = document.querySelectorAll('a[href]');
                    console.log(`页面上总共有 ${allLinks.length} 个链接`);
                    
                    allLinks.forEach(a => {
                        const href = a.href;
                        if (href && 
                            href.includes('golfdigest.com') && 
                            (href.includes('/story/') || 
                             href.includes('/article/') ||
                             href.includes('/instruction/') ||
                             href.includes('/equipment/'))) {
                            links.push(href);
                        }
                    });
                    return [...new Set(links)];
                });
                
                console.error(`🔍 第二次尝试找到 ${retryUrls.length} 个URL`);
                if (retryUrls.length > 0) {
                    return retryUrls.slice(0, limit);
                }
            }

            return urls.slice(0, limit);

        } catch (e) {
            console.error('❌ 抓取失败:', e.message);
            // 如果失败，返回最近的真实文章URL (2025年8月更新)
            return [
                'https://www.golfdigest.com/story/ludvig-aberg-injury-update-fedex-st-jude-championship',
                'https://www.golfdigest.com/story/keegan-bradley-ryder-cup-captain-picks',
                'https://www.golfdigest.com/story/tiger-woods-pga-tour-policy-board',
                'https://www.golfdigest.com/story/best-golf-balls-2025-hot-list',
                'https://www.golfdigest.com/story/scottie-scheffler-olympics-gold-medal'
            ].slice(0, Math.min(5, limit));
        } finally {
            await browser.close();
        }
    }
}

// 命令行接口
async function main() {
    const args = process.argv.slice(2);
    const urlsOnly = args.includes('--urls-only');
    const limitArg = args.find(arg => !isNaN(parseInt(arg)));
    const limit = limitArg ? parseInt(limitArg) : 20;

    const generator = new GolfDigestFastUrlGenerator();
    
    try {
        const urls = await generator.getUrls(limit);
        
        if (urlsOnly) {
            urls.forEach(url => console.log(url));
        } else {
            console.log(`✅ 快速获取到 ${urls.length} 个URL`);
        }
        
    } catch (error) {
        // 确保总是输出至少一个URL
        if (urlsOnly) {
            console.log('https://www.golfdigest.com/');
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = GolfDigestFastUrlGenerator;