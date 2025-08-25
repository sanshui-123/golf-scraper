#!/usr/bin/env node

/**
 * 处理新发现的2篇文章
 */

const BatchProcessor = require('./batch_process_articles');

async function processTwoNewArticles() {
    console.log('📋 开始处理新发现的2篇文章...\n');
    
    const articles = [
        'https://www.golfmonthly.com/news/after-missing-out-on-over-usd650-000-this-month-world-no-1-amateur-lottie-woad-expected-to-turn-professional-ahead-of-aig-womens-open',
        'https://www.golfmonthly.com/news/its-one-of-the-greatest-joys-of-my-life-but-does-it-feel-the-deepest-wants-and-desires-of-my-heart-absolutely-not-scottie-schefflers-epic-five-minute-answer-on-why-pro-golf-doesnt-fulfil-him'
    ];
    
    console.log('📊 发现 2 篇新文章:');
    articles.forEach((url, index) => {
        const fileName = url.substring(url.lastIndexOf('/') + 1);
        console.log(`${index + 1}. ${fileName}`);
    });
    
    console.log('\n🚀 开始处理文章...\n');
    
    try {
        const processor = new BatchProcessor();
        await processor.processArticles(articles);
        
        console.log('\n✅ 新文章处理完成！');
        console.log('📱 访问 http://localhost:8080 查看内容');
        
    } catch (error) {
        console.error('\n❌ 处理过程出错:', error);
    }
}

// 运行
if (require.main === module) {
    processTwoNewArticles().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}