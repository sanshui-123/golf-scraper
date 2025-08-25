#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

async function processAllOneByOne() {
    console.log('🚀 开始逐个处理所有未处理的文章...\n');
    console.log('📌 每处理完一篇文章会立即同步到网页\n');
    
    // 读取失败文章列表
    const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
    
    // 获取所有待处理的URL
    const pendingUrls = Object.entries(failedArticles)
        .filter(([url, data]) => {
            return data.status === 'pending_retry' && 
                   url.startsWith('https://www.golfmonthly.com/') &&
                   !url.includes('example.com') &&
                   !url.match(/^url\d+$/);
        })
        .map(([url]) => url);
    
    // 运行发现脚本获取所有未处理的文章
    console.log('🔍 扫描网站获取所有文章...\n');
    const { execSync } = require('child_process');
    
    try {
        // 运行发现脚本并捕获输出
        const output = execSync('node discover_recent_articles.js --ignore-time 2>&1', { 
            encoding: 'utf8',
            input: 'n\n' // 自动回答"否"，不立即处理
        });
        
        // 从输出中提取新文章URL
        const newArticleUrls = [];
        const lines = output.split('\n');
        let inNewArticlesList = false;
        
        for (const line of lines) {
            if (line.includes('🆕 新文章列表:')) {
                inNewArticlesList = true;
                continue;
            }
            if (inNewArticlesList && line.match(/^\d+\./)) {
                // 提取URL
                const urlMatch = line.match(/https:\/\/www\.golfmonthly\.com\/[^\s]+/);
                if (urlMatch) {
                    newArticleUrls.push(urlMatch[0]);
                }
            }
            if (line.includes('是否处理这些新文章')) {
                break;
            }
        }
        
        // 合并所有需要处理的URL（去重）
        const allUrls = [...new Set([...pendingUrls, ...newArticleUrls])];
        
        console.log(`\n📊 总共找到 ${allUrls.length} 篇需要处理的文章\n`);
        
        if (allUrls.length === 0) {
            console.log('✅ 太好了！所有文章都已经处理完成！');
            return;
        }
        
        // 创建批处理器实例
        const processor = new BatchProcessor();
        
        // 统计信息
        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;
        
        // 逐个处理每篇文章
        for (let i = 0; i < allUrls.length; i++) {
            const url = allUrls[i];
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📄 处理进度: ${i + 1}/${allUrls.length}`);
            console.log(`🔗 URL: ${url}`);
            console.log(`${'='.repeat(60)}\n`);
            
            try {
                // 处理单篇文章
                await processor.processArticles([url]);
                
                // 检查处理结果
                const updatedFailed = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
                if (updatedFailed[url] && updatedFailed[url].status === 'success') {
                    successCount++;
                    console.log(`\n✅ 成功处理并同步到网页！`);
                } else if (updatedFailed[url] && updatedFailed[url].reason.includes('跳过')) {
                    skipCount++;
                    console.log(`\n⏭️  文章被跳过（内容过长或其他原因）`);
                } else {
                    failCount++;
                    console.log(`\n❌ 处理失败，稍后可以重试`);
                }
                
                // 显示实时统计
                console.log(`\n📊 当前统计: 成功 ${successCount} | 失败 ${failCount} | 跳过 ${skipCount}`);
                
                // 如果不是最后一篇，休息3秒
                if (i < allUrls.length - 1) {
                    console.log('\n⏳ 休息3秒后继续下一篇...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                
            } catch (error) {
                console.error(`\n❌ 处理出错: ${error.message}`);
                failCount++;
            }
        }
        
        // 最终统计
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 处理完成统计：');
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ 成功处理: ${successCount} 篇`);
        console.log(`❌ 处理失败: ${failCount} 篇`);
        console.log(`⏭️  跳过处理: ${skipCount} 篇`);
        console.log(`📄 总计处理: ${allUrls.length} 篇`);
        console.log(`\n🌐 访问管理系统查看: http://localhost:8080`);
        
    } catch (error) {
        console.error('执行出错:', error.message);
    }
}

// 运行处理
processAllOneByOne();