#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 引入封装的模块
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
const ImageProcessor = require('./image_processor_final');

const urls = [
    'https://www.golfmonthly.com/news/phil-mickelson-tiger-woods-head-to-head-record',
    'https://www.golfmonthly.com/tips/my-short-game-was-utterly-horrific-until-i-discovered-this-magical-chip-shot'
];

async function fetchArticleContent(url) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        console.log(`\n📄 正在抓取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // 获取文章内容
        const article = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText || '';
            const paragraphs = Array.from(document.querySelectorAll('article p, .article-body p, .content p, main p'))
                .map(p => p.innerText.trim())
                .filter(text => text.length > 0);
            
            // 获取图片
            const images = Array.from(document.querySelectorAll('article img, .article-body img, main img'))
                .map(img => ({
                    src: img.src,
                    alt: img.alt || '',
                    title: img.title || ''
                }))
                .filter(img => img.src && !img.src.includes('data:'));
                
            return { 
                title, 
                content: paragraphs.join('\n\n'),
                images,
                url
            };
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
    
    // 创建今天的文件夹
    const today = new Date().toISOString().split('T')[0];
    const outputDir = path.join('golf_content', today);
    await fs.mkdir(outputDir, { recursive: true });
    
    // 初始化处理器
    const rewriter = new ArticleRewriterEnhanced();
    const imageProcessor = new ImageProcessor(outputDir);
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n📌 处理第 ${i + 1}/${urls.length} 篇文章`);
        console.log(`URL: ${url}`);
        
        // 1. 抓取文章
        const article = await fetchArticleContent(url);
        if (!article) {
            console.log('⚠️ 跳过此文章');
            continue;
        }
        
        // 2. 改写文章
        console.log('\n🔄 正在改写文章...');
        const rewrittenContent = await rewriter.rewriteArticle({
            title: article.title,
            content: article.content,
            url: article.url
        });
        
        if (!rewrittenContent) {
            console.log('⚠️ 改写失败，跳过此文章');
            continue;
        }
        
        // 3. 处理图片
        console.log('\n🖼️ 正在处理图片...');
        const processedImages = [];
        for (const img of article.images) {
            const processed = await imageProcessor.downloadAndSaveImage(img.src, img.alt);
            if (processed) {
                processedImages.push(processed);
            }
        }
        
        // 4. 保存结果
        const safeTitle = article.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
        const filename = `${i + 1}_${safeTitle}.json`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify({
            originalUrl: article.url,
            originalTitle: article.title,
            rewrittenContent: rewrittenContent,
            images: processedImages,
            processedAt: new Date().toISOString()
        }, null, 2));
        
        console.log(`\n✅ 文章处理完成: ${filename}`);
        
        if (i < urls.length - 1) {
            console.log('\n⏳ 等待2秒后处理下一篇...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\n✅ 全部处理完成！');
    console.log(`📁 文件保存在: ${outputDir}`);
}

processArticles().catch(console.error);