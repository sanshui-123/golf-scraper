#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 加载网站配置
const websiteConfigs = JSON.parse(fs.readFileSync('./website_configs.json', 'utf8'));

async function testSingleArticle(url) {
    console.log('\n🧪 测试单篇文章抓取...');
    console.log(`URL: ${url}`);
    
    // 获取网站配置
    const getDomain = (url) => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return null;
        }
    };
    
    const domain = getDomain(url);
    const siteConfig = websiteConfigs[domain];
    
    if (!siteConfig) {
        console.log(`⚠️ 未找到 ${domain} 的配置，使用默认选择器`);
    } else {
        console.log(`✅ 使用 ${siteConfig.name} 的配置`);
    }
    
    const selectors = siteConfig?.selectors || {
        title: 'h1',
        article: 'article, main, .content',
        content: 'p, h2, h3',
        images: 'img'
    };
    
    const browser = await chromium.launch({
        headless: true,
        executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('\n⏳ 加载页面...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 等待内容加载
        try {
            await page.waitForSelector(selectors.article || 'article', { timeout: 5000 });
        } catch (e) {
            await page.waitForSelector(selectors.title || 'h1', { timeout: 5000 });
        }
        
        console.log('✅ 页面加载完成');
        
        // 提取内容
        const data = await page.evaluate((selectors) => {
            const title = document.querySelector(selectors.title)?.innerText || '未找到标题';
            const article = document.querySelector(selectors.article);
            const contentContainer = article || document.querySelector('main') || document.body;
            
            // 提取文章内容
            const paragraphs = Array.from(contentContainer.querySelectorAll(selectors.content));
            const content = paragraphs
                .map(p => p.innerText.trim())
                .filter(text => text.length > 20)
                .slice(0, 10)  // 只显示前10段
                .join('\n\n');
            
            // 提取图片
            const images = [];
            const contentImgs = contentContainer.querySelectorAll(selectors.images || 'img');
            contentImgs.forEach((img, index) => {
                if (img.src && 
                    !img.closest('a') && 
                    !img.classList.contains('thumbnail') &&
                    !img.classList.contains('thumb') &&
                    img.width > 200) {
                    images.push({
                        index: index + 1,
                        src: img.src,
                        alt: img.alt || '无描述',
                        width: img.width,
                        height: img.height
                    });
                }
            });
            
            return { title, content, images, totalParagraphs: paragraphs.length };
        }, selectors);
        
        // 显示结果
        console.log('\n📊 抓取结果：');
        console.log('=====================================');
        console.log(`📌 标题: ${data.title}`);
        console.log(`📝 段落数: ${data.totalParagraphs}`);
        console.log(`🖼️ 图片数: ${data.images.length}`);
        
        console.log('\n📄 内容预览:');
        console.log('-------------------------------------');
        console.log(data.content.substring(0, 500) + '...');
        
        if (data.images.length > 0) {
            console.log('\n🖼️ 图片列表:');
            console.log('-------------------------------------');
            data.images.slice(0, 5).forEach(img => {
                console.log(`${img.index}. ${img.alt} (${img.width}x${img.height})`);
                console.log(`   ${img.src.substring(0, 80)}...`);
            });
            if (data.images.length > 5) {
                console.log(`   ... 还有 ${data.images.length - 5} 张图片`);
            }
        }
        
        // 保存测试结果
        const testDir = './test_results';
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }
        
        const filename = `test_${domain}_${Date.now()}.json`;
        const filepath = path.join(testDir, filename);
        fs.writeFileSync(filepath, JSON.stringify({
            url,
            domain,
            siteConfig: siteConfig?.name || 'Unknown',
            ...data,
            testedAt: new Date().toISOString()
        }, null, 2));
        
        console.log(`\n💾 测试结果已保存到: ${filepath}`);
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    } finally {
        await browser.close();
    }
}

// 命令行使用
if (require.main === module) {
    const url = process.argv[2];
    
    if (!url) {
        console.log('\n使用方法:');
        console.log('  node test_single_article.js <URL>');
        console.log('\n示例:');
        console.log('  node test_single_article.js "https://golf.com/instruction/..."');
        console.log('\n支持的网站:');
        Object.entries(websiteConfigs).forEach(([domain, config]) => {
            console.log(`  - ${config.name} (${domain})`);
        });
        process.exit(0);
    }
    
    testSingleArticle(url).catch(console.error);
}

module.exports = testSingleArticle;