#!/usr/bin/env node

/**
 * 测试单个Golf.com文章
 */

const { chromium } = require('playwright');
const BatchArticleProcessor = require('./batch_process_articles');

async function testSingleArticle() {
    const testUrl = 'https://golf.com/news/joel-dahmen-geno-bonnalie-split-reveals/';
    console.log('🏌️ 测试Golf.com文章抓取');
    console.log('📄 文章URL:', testUrl);
    console.log('═'.repeat(60));
    
    const processor = new BatchArticleProcessor();
    
    try {
        // 初始化浏览器
        processor.browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        console.log('\n⏳ 开始处理文章...\n');
        
        // 处理文章
        const results = await processor.processArticles([testUrl]);
        
        if (results && results.length > 0) {
            const article = results[0];
            console.log('\n✅ 文章处理成功！\n');
            
            // 显示结果
            console.log('📊 处理结果：');
            console.log('─'.repeat(40));
            console.log(`标题: ${article.title}`);
            console.log(`内容长度: ${article.content.length} 字符`);
            console.log(`段落数: ${(article.content.match(/\n\n/g) || []).length}`);
            console.log(`图片总数: ${article.images.length}`);
            
            // 统计下载成功的图片
            const downloadedImages = article.images.filter(img => img.downloaded);
            console.log(`成功下载: ${downloadedImages.length} 张`);
            
            if (article.images.length > 0) {
                console.log('\n📷 图片详情：');
                console.log('─'.repeat(40));
                article.images.forEach((img, i) => {
                    const status = img.downloaded ? '✅' : '❌';
                    const filename = img.filename || '未下载';
                    console.log(`${i + 1}. ${status} ${filename}`);
                    if (img.alt) {
                        console.log(`   描述: ${img.alt}`);
                    }
                });
            }
            
            // 显示内容预览
            console.log('\n📝 内容预览（前500字符）：');
            console.log('─'.repeat(40));
            console.log(article.content.substring(0, 500) + '...\n');
            
            // 检查是否有AVIF格式图片
            const fs = require('fs');
            const path = require('path');
            let avifCount = 0;
            
            downloadedImages.forEach(img => {
                if (img.filename) {
                    const imagePath = path.join('./golf_content/images', img.filename);
                    if (fs.existsSync(imagePath) && img.filename.endsWith('.avif')) {
                        avifCount++;
                    }
                }
            });
            
            if (avifCount > 0) {
                console.log(`\n🎯 检测到 ${avifCount} 张AVIF格式图片（新一代高效格式）`);
            }
            
            // 保存完整结果
            const outputFile = './test_golf_article_result.json';
            const fs2 = require('fs').promises;
            await fs2.writeFile(outputFile, JSON.stringify(article, null, 2));
            console.log(`\n💾 完整结果已保存到: ${outputFile}`);
            
        } else {
            console.error('\n❌ 文章处理失败：未能获取文章内容');
        }
        
    } catch (error) {
        console.error('\n❌ 处理出错:', error.message);
        console.error('\n错误详情:');
        console.error(error.stack);
    } finally {
        if (processor.browser) {
            await processor.browser.close();
        }
        console.log('\n✨ 测试完成！');
    }
}

// 运行测试
testSingleArticle().catch(console.error);