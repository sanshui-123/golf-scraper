#!/usr/bin/env node

/**
 * 单独处理指定文章的脚本
 * 用法: node process_single_article.js <URL>
 */

const BatchProcessor = require('./batch_process_articles');

async function processSingleArticle(url) {
    if (!url) {
        console.error('❌ 请提供文章URL');
        console.log('用法: node process_single_article.js <URL>');
        process.exit(1);
    }

    console.log('📋 开始处理单篇文章...\n');
    console.log(`🔗 URL: ${url}\n`);

    const processor = new BatchProcessor();
    
    try {
        // 处理单篇文章
        await processor.processArticles([url]);
        
        console.log('\n✅ 处理完成！');
        console.log('📱 访问 http://localhost:8080 查看内容');
        
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
        process.exit(1);
    }
}

// 获取命令行参数
const url = process.argv[2];

// 如果直接运行
if (require.main === module) {
    processSingleArticle(url).then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}

module.exports = processSingleArticle;