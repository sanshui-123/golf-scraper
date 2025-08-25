#!/usr/bin/env node

/**
 * 按顺序处理文章列表
 * 每处理完一篇就同步到网站
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 文章列表
const articles = [
    'https://www.golfmonthly.com/features/royal-portrush-course-guide-head-pro-gary-mcneill-shares-the-inside-track-on-the-2025-open-championship-venue',
    'https://www.golfmonthly.com/features/how-to-win-the-open-championship-two-time-champion-ernie-els-blueprint-for-major-success',
    'https://www.golfmonthly.com/features/how-to-think-like-a-single-figure-golfer-no-matter-your-handicap-for-fast-gains',
    'https://www.golfmonthly.com/news/camping-at-the-open-ive-tried-it-but-its-not-for-me',
    'https://www.golfmonthly.com/news/grant-horvat-rejects-pga-tour-barracuda-championship',
    'https://www.golfmonthly.com/news/bryson-dechambeau-outlines-changes-liv-golf-could-make-to-help-owgr-bid-after-strong-jon-rahm-comments',
    'https://www.golfmonthly.com/news/joel-dahmen-split-caddie-geno-bonnalie',
    'https://www.golfmonthly.com/tips/how-to-escape-a-deep-revetted-bunker',
    'https://www.golfmonthly.com/gear/why-the-travismathew-x-guinness-collab-might-be-the-best-weve-ever-seen'
];

async function processArticleList() {
    console.log('📋 开始按顺序处理文章列表...\n');
    console.log(`📊 共有 ${articles.length} 篇文章待处理\n`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < articles.length; i++) {
        const url = articles[i];
        const articleNum = i + 1;
        
        console.log('='.repeat(70));
        console.log(`📄 处理第 ${articleNum}/${articles.length} 篇文章`);
        console.log('='.repeat(70));
        console.log(`🔗 ${url}\n`);
        
        try {
            // 调用单篇文章处理脚本
            execSync(`node process_single_article.js "${url}"`, {
                stdio: 'inherit',
                cwd: __dirname
            });
            
            successCount++;
            console.log(`\n✅ 第 ${articleNum} 篇文章处理成功！`);
            console.log(`📊 进度: ${articleNum}/${articles.length} (${Math.round(articleNum/articles.length*100)}%)\n`);
            
            // 如果不是最后一篇，稍微等待一下
            if (i < articles.length - 1) {
                console.log('⏳ 等待5秒后继续下一篇...\n');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
        } catch (error) {
            failureCount++;
            console.error(`\n❌ 第 ${articleNum} 篇文章处理失败！`);
            console.error(`错误: ${error.message}\n`);
            
            // 询问是否继续
            console.log('⏳ 等待10秒后继续下一篇...\n');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    // 完成统计
    console.log('\n' + '='.repeat(70));
    console.log('🎉 所有文章处理完成！');
    console.log('='.repeat(70));
    console.log(`📊 处理统计:`);
    console.log(`   ✅ 成功: ${successCount} 篇`);
    console.log(`   ❌ 失败: ${failureCount} 篇`);
    console.log(`   📚 总计: ${articles.length} 篇`);
    console.log('\n📱 访问 http://localhost:8080 查看所有内容');
}

// 运行
if (require.main === module) {
    processArticleList().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}