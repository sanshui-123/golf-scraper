#!/usr/bin/env node

const puppeteer = require('puppeteer');

const urls = [
    'https://www.golfmonthly.com/news/phil-mickelson-tiger-woods-head-to-head-record',
    'https://www.golfmonthly.com/tips/my-short-game-was-utterly-horrific-until-i-discovered-this-magical-chip-shot'
];

async function fetchArticleContent(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log(`\n📄 正在抓取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // 获取文章内容
        const article = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText || '';
            const content = Array.from(document.querySelectorAll('p')).map(p => p.innerText).join('\n\n');
            return { title, content };
        });
        
        console.log(`✅ 成功获取文章: ${article.title}`);
        return article;
        
    } catch (error) {
        console.error(`❌ 抓取失败: ${error.message}`);
        return null;
    } finally {
        await browser.close();
    }
}

async function processArticles() {
    console.log(`\n🚀 开始处理 ${urls.length} 篇文章...\n`);
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n📌 处理第 ${i + 1}/${urls.length} 篇文章`);
        
        const article = await fetchArticleContent(url);
        
        if (article) {
            // 这里可以调用封装的改写器
            console.log(`\n标题: ${article.title}`);
            console.log(`内容长度: ${article.content.length} 字符`);
        }
        
        if (i < urls.length - 1) {
            console.log('\n⏳ 等待2秒后处理下一篇...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\n✅ 全部处理完成！');
}

processArticles().catch(console.error);