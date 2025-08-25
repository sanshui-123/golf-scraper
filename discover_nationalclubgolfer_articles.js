#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * National Club Golfer文章URL抓取器
 * 特点：
 * - JavaScript渲染页面
 * - 支持懒加载图片处理
 * - 过滤视频类文章
 * - 主页和分类页面扫描
 */

// URL过滤函数 - 过滤掉分类页面、视频页面等
function isValidArticleUrl(url, text = '') {
    // 基本验证
    if (!url || !url.startsWith('https://www.nationalclubgolfer.com/')) return false;
    
    // 过滤已知的非文章页面
    const invalidPatterns = [
        /\/category\//,
        /\/tag\//,
        /\/author\//,
        /\/page\/\d+/,
        /\/wp-admin/,
        /\/wp-content/,
        /\/feed\//,
        /\?/,  // 查询参数
        /#/,   // 锚点
        /\/video\//,  // 视频页面
        /\/videos\//,
        /\/watch\//
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(url))) {
        return false;
    }
    
    // 检查URL路径深度和文章特征
    const urlPath = new URL(url).pathname;
    const pathParts = urlPath.split('/').filter(p => p);
    
    // 文章URL通常有特定的结构
    if (pathParts.length < 2 || pathParts.length > 4) {
        return false;
    }
    
    // 最后一部分应该是文章slug（包含连字符）
    const lastPart = pathParts[pathParts.length - 1];
    if (!lastPart.includes('-') && !lastPart.match(/^\d{4}$/)) {
        return false;
    }
    
    // 检查文本内容，过滤视频为主的内容
    const lowerText = text.toLowerCase();
    if (lowerText.includes('video:') || lowerText.includes('watch:')) {
        return false;
    }
    
    return true;
}

// 抓取文章URL
async function scrapeArticleUrls(maxUrls = 50) {
    console.log(`开始抓取 National Club Golfer 文章URL (目标: ${maxUrls}个)...`);
    
    const browser = await chromium.launch({
        headless: true,
        timeout: 60000
    });
    
    const urls = new Set();
    const visitedPages = new Set();
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        const page = await context.newPage();
        
        // 要扫描的页面列表
        const pagesToScan = [
            'https://www.nationalclubgolfer.com/',
            'https://www.nationalclubgolfer.com/news/'
        ];
        
        for (const pageUrl of pagesToScan) {
            if (urls.size >= maxUrls) break;
            if (visitedPages.has(pageUrl)) continue;
            
            visitedPages.add(pageUrl);
            console.log(`\n扫描页面: ${pageUrl}`);
            
            try {
                await page.goto(pageUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 20000
                });
                
                // 等待内容加载
                await page.waitForTimeout(2000);
                
                // 滚动页面以触发懒加载
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await page.waitForTimeout(1000);
                
                // 获取所有链接
                const links = await page.evaluate(() => {
                    const links = [];
                    // 查找所有可能的文章链接
                    const selectors = [
                        'article a',
                        '.post a',
                        '.article a',
                        '.entry a',
                        'h2 a',
                        'h3 a',
                        '.headline a',
                        '.title a'
                    ];
                    
                    const seenUrls = new Set();
                    
                    for (const selector of selectors) {
                        document.querySelectorAll(selector).forEach(a => {
                            const href = a.href;
                            const text = a.textContent || '';
                            if (href && !seenUrls.has(href)) {
                                seenUrls.add(href);
                                links.push({ url: href, text: text.trim() });
                            }
                        });
                    }
                    
                    return links;
                });
                
                // 过滤有效的文章URL
                for (const link of links) {
                    if (urls.size >= maxUrls) break;
                    
                    if (isValidArticleUrl(link.url, link.text)) {
                        urls.add(link.url);
                        console.log(`  ✓ 找到文章: ${link.url}`);
                    }
                }
                
                console.log(`  当前已收集 ${urls.size} 个URL`);
                
            } catch (error) {
                console.error(`  ✗ 扫描页面失败: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('抓取过程出错:', error);
    } finally {
        await browser.close();
    }
    
    return Array.from(urls);
}

// 生成URL文件
async function generateUrlFile(urls) {
    const urlFileName = 'deep_urls_nationalclubgolfer_com.txt';
    const urlFilePath = path.join(process.cwd(), urlFileName);
    
    // 生成文件内容
    const timestamp = new Date().toISOString();
    const fileContent = [
        `# National Club Golfer URLs`,
        `# Generated: ${timestamp}`,
        `# Total URLs: ${urls.length}`,
        '',
        ...urls,
        ''
    ].join('\n');
    
    // 写入文件
    await fs.writeFile(urlFilePath, fileContent, 'utf-8');
    console.log(`\n✓ URL文件已生成: ${urlFileName}`);
    console.log(`✓ 共${urls.length}个URL`);
    
    return urlFileName;
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const urlsOnly = args.includes('--urls-only');
    const maxUrls = parseInt(args.find(arg => !isNaN(arg))) || 50;
    
    try {
        // 抓取URL
        const urls = await scrapeArticleUrls(maxUrls);
        
        if (urls.length === 0) {
            console.error('\n✗ 未找到任何文章URL');
            process.exit(1);
        }
        
        // 生成URL文件
        const urlFile = await generateUrlFile(urls);
        
        // 输出URL供其他脚本使用
        if (urlsOnly) {
            console.log('\n生成的URL:');
            urls.forEach(url => console.log(url));
        }
        
        console.log('\n✓ National Club Golfer URL抓取完成!');
        
    } catch (error) {
        console.error('\n✗ 执行失败:', error);
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});