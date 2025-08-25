#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');
const { execSync } = require('child_process');

async function continuousProcessing() {
    console.log('🔄 开始持续处理所有未处理的文章...\n');
    console.log('⚡ 程序将持续运行直到所有文章处理完成\n');
    
    const processor = new BatchProcessor();
    let totalProcessed = 0;
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    while (true) {
        // 获取最新的未处理文章
        console.log('🔍 扫描未处理的文章...\n');
        
        try {
            // 运行发现脚本
            const output = execSync('node discover_recent_articles.js --ignore-time 2>&1', { 
                encoding: 'utf8',
                input: 'n\n'
            });
            
            // 提取新文章URL
            const newArticleUrls = [];
            const lines = output.split('\n');
            let inNewArticlesList = false;
            
            for (const line of lines) {
                if (line.includes('🆕 新文章列表:')) {
                    inNewArticlesList = true;
                    continue;
                }
                if (inNewArticlesList && line.match(/^\d+\./)) {
                    const urlMatch = line.match(/https:\/\/www\.golfmonthly\.com\/[^\s]+/);
                    if (urlMatch) {
                        newArticleUrls.push(urlMatch[0]);
                    }
                }
                if (line.includes('是否处理这些新文章')) {
                    break;
                }
            }
            
            // 同时检查failed_articles.json中的待处理文章
            const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
            const pendingUrls = Object.entries(failedArticles)
                .filter(([url, data]) => {
                    return data.status === 'pending_retry' && 
                           url.startsWith('https://www.golfmonthly.com/') &&
                           !url.includes('example.com') &&
                           !url.match(/^url\d+$/);
                })
                .map(([url]) => url);
            
            // 合并并去重
            const allUrls = [...new Set([...newArticleUrls, ...pendingUrls])];
            
            if (allUrls.length === 0) {
                console.log('✅ 太棒了！所有文章都已经处理完成！\n');
                break;
            }
            
            console.log(`📊 找到 ${allUrls.length} 篇待处理文章\n`);
            
            // 逐个处理
            for (const url of allUrls) {
                totalProcessed++;
                const type = url.includes('buying-advice') ? '🛍️ 装备类' : '📰 新闻类';
                
                console.log(`\n${'='.repeat(60)}`);
                console.log(`📄 总处理数: ${totalProcessed}`);
                console.log(`${type} ${url}`);
                console.log(`${'='.repeat(60)}\n`);
                
                try {
                    await processor.processArticles([url]);
                    
                    // 检查结果
                    const updatedFailed = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
                    if (updatedFailed[url] && updatedFailed[url].status === 'success') {
                        successCount++;
                        console.log(`\n✅ 成功处理并同步到网页！`);
                    } else if (updatedFailed[url] && updatedFailed[url].reason && updatedFailed[url].reason.includes('跳过')) {
                        skipCount++;
                        console.log(`\n⏭️ 文章被跳过`);
                    } else {
                        failCount++;
                        console.log(`\n❌ 处理失败`);
                    }
                    
                    console.log(`\n📊 累计统计: 成功 ${successCount} | 失败 ${failCount} | 跳过 ${skipCount}`);
                    
                    // 休息2秒
                    console.log('\n⏳ 休息2秒...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                } catch (error) {
                    console.error(`\n❌ 处理错误: ${error.message}`);
                    failCount++;
                }
            }
            
            // 检查是否还有未处理的，如果有则继续循环
            console.log('\n🔄 检查是否还有未处理的文章...\n');
            
        } catch (error) {
            console.error('扫描出错:', error.message);
            break;
        }
    }
    
    // 最终统计
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 所有文章处理完成！');
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 最终统计:`);
    console.log(`   ✅ 成功处理: ${successCount} 篇`);
    console.log(`   ❌ 处理失败: ${failCount} 篇`);
    console.log(`   ⏭️ 跳过处理: ${skipCount} 篇`);
    console.log(`   📄 总计处理: ${totalProcessed} 次`);
    console.log(`\n🌐 访问管理系统查看所有文章: http://localhost:8080`);
}

// 运行持续处理
continuousProcessing().catch(error => {
    console.error('程序出错:', error);
});