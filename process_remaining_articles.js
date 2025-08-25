#!/usr/bin/env node

/**
 * 智能处理剩余文章脚本
 * 从状态文件动态读取待处理文章，使用优化后的批处理器
 */

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

async function processRemainingArticles() {
    console.log('📋 智能处理剩余文章系统启动...\n');
    
    try {
        // 读取处理状态
        const statusFile = path.join(__dirname, 'processing_status_report.json');
        if (!fs.existsSync(statusFile)) {
            console.log('❌ 未找到处理状态文件');
            return;
        }
        
        const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        
        // 获取待处理的URL
        const pendingUrls = status.pendingRetryArticles
            .filter(a => a.attemptCount < 3) // 只处理尝试次数少于3次的
            .map(a => a.url);
        const unprocessedUrls = status.unprocessedArticles || [];
        
        // 合并并去重
        const allUrls = [...new Set([...pendingUrls, ...unprocessedUrls])];
        
        console.log(`📊 发现 ${allUrls.length} 篇待处理文章\n`);
        
        if (allUrls.length === 0) {
            console.log('✅ 没有待处理的文章！');
            return;
        }
        
        // 分类显示
        const equipmentUrls = allUrls.filter(url => 
            url.includes('buying-advice') || 
            url.includes('best-') ||
            url.includes('gear') ||
            url.includes('equipment')
        );
        const newsUrls = allUrls.filter(url => !equipmentUrls.includes(url));
        
        console.log(`📦 装备类文章: ${equipmentUrls.length} 篇`);
        console.log(`📰 新闻类文章: ${newsUrls.length} 篇`);
        console.log('\n待处理文章列表：');
        
        // 优先处理装备类（通常更难处理）
        const sortedUrls = [...equipmentUrls, ...newsUrls];
        
        sortedUrls.forEach((url, index) => {
            const type = equipmentUrls.includes(url) ? '🛍️' : '📰';
            console.log(`${index + 1}. ${type} ${url.substring(url.lastIndexOf('/') + 1)}`);
        });
        
        console.log('\n🚀 开始智能批量处理...\n');
        
        const processor = new BatchProcessor();
        
        // 串行处理，一篇一篇来
        const batchSize = 1; // 每次只处理1篇，完全串行
        const totalArticles = sortedUrls.length;
        
        console.log(`📋 将逐篇串行处理 ${totalArticles} 篇文章`);
        console.log(`💡 智能等待机制已启用，确保流畅处理\n`);
        
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < sortedUrls.length; i += batchSize) {
            const batch = sortedUrls.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            
            console.log(`\n${'='.repeat(50)}`);
            console.log(`📄 处理第 ${i + 1}/${totalArticles} 篇文章`);
            console.log(`${'='.repeat(50)}\n`);
            
            try {
                const beforeCount = successCount;
                await processor.processArticles(batch);
                
                console.log(`\n✅ 第 ${i + 1} 篇文章处理完成`);
                successCount++;
                
                // 每篇文章处理后智能休息
                if (i + 1 < sortedUrls.length) {
                    const waitTime = (i + 1) % 5 === 0 ? 15000 : 5000; // 每5篇休息更长时间
                    console.log(`\n⏸️  休息${waitTime/1000}秒后继续下一篇...`);
                    console.log(`   (避免API过载，确保串行处理稳定)`);
                    
                    // 显示进度
                    const progress = Math.round((i + 1) / sortedUrls.length * 100);
                    console.log(`   📊 总进度: ${progress}% (${i + 1}/${sortedUrls.length})`);
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
            } catch (error) {
                console.error(`\n❌ 第 ${i + 1} 篇文章处理出错:`, error.message);
                failureCount++;
                
                // 出错后延长等待时间
                if (i + 1 < sortedUrls.length) {
                    console.log(`\n⚠️  出错后等待20秒再继续...`);
                    await new Promise(resolve => setTimeout(resolve, 20000));
                }
            }
        }
        
        // 处理完成，显示统计
        console.log('\n' + '='.repeat(50));
        console.log('🎉 所有文章串行处理完成！');
        console.log('='.repeat(50));
        
        // 重新读取状态，显示最终结果
        const finalStatus = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        
        console.log('\n📊 处理结果统计：');
        console.log(`✅ 成功处理: ${finalStatus.summary.successfullyProcessed} 篇`);
        console.log(`⏳ 待重试: ${finalStatus.summary.pendingRetry} 篇`);
        console.log(`❌ 未处理: ${finalStatus.summary.neverProcessed} 篇`);
        console.log(`📚 本地文章总数: ${finalStatus.summary.localArticlesCount} 篇`);
        
        // 如果还有失败的，显示建议
        if (finalStatus.summary.pendingRetry > 0) {
            console.log('\n💡 建议：');
            console.log('1. 稍后再次运行此脚本处理失败的文章');
            console.log('2. 检查网络连接和Claude API状态');
            console.log('3. 考虑手动处理特别长的文章');
        }
        
    } catch (error) {
        console.error('\n❌ 处理过程出错:', error);
    }
}

// 如果直接运行
if (require.main === module) {
    processRemainingArticles().then(() => {
        console.log('\n✅ 智能处理程序执行完成');
        console.log('💡 访问 http://localhost:8080 查看所有文章');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ 程序执行失败:', error);
        process.exit(1);
    });
}