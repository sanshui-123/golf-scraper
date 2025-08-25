#!/usr/bin/env node

/**
 * 重新处理GolfWRX文章以测试图片修复
 */

const path = require('path');
const fs = require('fs').promises;

async function reprocessArticles() {
    const dateStr = '2025-08-13';
    const articlesToReprocess = ['1583', '1585'];
    
    console.log('🔄 重新处理GolfWRX文章...\n');
    
    // 先备份原文件
    for (const articleNum of articlesToReprocess) {
        const mdPath = path.join('golf_content', dateStr, 'wechat_ready', `wechat_article_${articleNum}.md`);
        const htmlPath = path.join('golf_content', dateStr, 'wechat_html', `wechat_article_${articleNum}.html`);
        
        try {
            // 备份原文件
            await fs.copyFile(mdPath, mdPath + '.backup');
            await fs.copyFile(htmlPath, htmlPath + '.backup');
            console.log(`✅ 已备份文章 ${articleNum}`);
        } catch (error) {
            console.log(`⚠️  无法备份文章 ${articleNum}: ${error.message}`);
        }
    }
    
    // 从article_urls.json中删除这些文章
    const articleUrlsPath = path.join('golf_content', dateStr, 'article_urls.json');
    try {
        const articleUrls = JSON.parse(await fs.readFile(articleUrlsPath, 'utf8'));
        
        // 找到要重新处理的URL
        const urlsToReprocess = [];
        for (const [articleId, info] of Object.entries(articleUrls)) {
            if (articlesToReprocess.includes(articleId) && info.url && info.url.includes('golfwrx.com')) {
                urlsToReprocess.push(info.url);
                delete articleUrls[articleId];
            }
        }
        
        // 保存更新后的article_urls.json
        await fs.writeFile(articleUrlsPath, JSON.stringify(articleUrls, null, 2));
        
        console.log('\n📝 准备重新处理以下URL:');
        urlsToReprocess.forEach((url, idx) => {
            console.log(`${idx + 1}. ${url}`);
        });
        
        // 现在使用batch_process_articles处理这些URL
        if (urlsToReprocess.length > 0) {
            const BatchProcessor = require('./batch_process_articles');
            const processor = new BatchProcessor();
            
            console.log('\n🚀 开始重新处理...\n');
            await processor.processArticles(urlsToReprocess);
        }
        
    } catch (error) {
        console.error('❌ 处理失败:', error);
    }
}

reprocessArticles().catch(console.error);