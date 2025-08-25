#!/usr/bin/env node

/**
 * 处理仍然失败的真实高尔夫文章
 */

const BatchProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

async function processRemainingFailedArticles() {
    console.log('📋 开始处理仍然失败的高尔夫文章...\n');
    
    try {
        // 读取失败文章记录
        const failedFile = path.join(__dirname, 'failed_articles.json');
        if (!fs.existsSync(failedFile)) {
            console.log('❌ 未找到失败文章记录文件');
            return;
        }
        
        const failedData = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
        
        // 筛选真实的高尔夫文章（排除测试URL）
        const realArticles = [];
        for (const [url, info] of Object.entries(failedData)) {
            if (info.status === 'pending_retry' && 
                url.includes('golfmonthly.com') && 
                !url.includes('example.com') && 
                !url.startsWith('url')) {
                realArticles.push(url);
            }
        }
        
        console.log(`📊 发现 ${realArticles.length} 篇真实的高尔夫文章需要重试\n`);
        
        if (realArticles.length === 0) {
            console.log('✅ 没有需要重试的真实文章！');
            return;
        }
        
        // 按类型分类
        const equipmentUrls = realArticles.filter(url => 
            url.includes('buying-advice') || 
            url.includes('best-') ||
            url.includes('gear') ||
            url.includes('equipment') ||
            url.includes('prime-day') ||
            url.includes('amazon')
        );
        const newsUrls = realArticles.filter(url => url.includes('/news/'));
        const tipsUrls = realArticles.filter(url => url.includes('/tips/'));
        const featuresUrls = realArticles.filter(url => url.includes('/features/'));
        const otherUrls = realArticles.filter(url => 
            !equipmentUrls.includes(url) && 
            !newsUrls.includes(url) && 
            !tipsUrls.includes(url) && 
            !featuresUrls.includes(url)
        );
        
        console.log(`🛍️ 装备类文章: ${equipmentUrls.length} 篇`);
        console.log(`📰 新闻文章: ${newsUrls.length} 篇`);
        console.log(`💡 技巧文章: ${tipsUrls.length} 篇`);
        console.log(`📝 专题文章: ${featuresUrls.length} 篇`);
        console.log(`🔄 其他文章: ${otherUrls.length} 篇\n`);
        
        // 优先处理装备类文章（之前的主要问题），然后按难度排序
        const sortedUrls = [...equipmentUrls, ...featuresUrls, ...newsUrls, ...tipsUrls, ...otherUrls];
        
        console.log('📋 处理顺序:');
        sortedUrls.forEach((url, index) => {
            let type = '🔄';
            if (equipmentUrls.includes(url)) type = '🛍️';
            else if (newsUrls.includes(url)) type = '📰';
            else if (tipsUrls.includes(url)) type = '💡';
            else if (featuresUrls.includes(url)) type = '📝';
            
            const fileName = url.substring(url.lastIndexOf('/') + 1);
            console.log(`${index + 1}. ${type} ${fileName}`);
        });
        
        console.log('\n🚀 开始重新处理失败的文章...\n');
        
        const processor = new BatchProcessor();
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < sortedUrls.length; i++) {
            const url = sortedUrls[i];
            
            console.log('='.repeat(70));
            console.log(`📄 重新处理第 ${i + 1}/${sortedUrls.length} 篇文章`);
            console.log('='.repeat(70));
            console.log(`🔗 ${url}\n`);
            
            try {
                // 处理单篇文章
                await processor.processArticles([url]);
                successCount++;
                console.log(`\n✅ 第 ${i + 1} 篇文章处理成功！`);
                
                // 处理成功后等待
                if (i < sortedUrls.length - 1) {
                    console.log('⏳ 等待5秒后继续下一篇...\n');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                failureCount++;
                console.error(`\n❌ 第 ${i + 1} 篇文章仍然失败！`);
                console.error(`错误: ${error.message}\n`);
                
                // 失败后等待更长时间
                if (i < sortedUrls.length - 1) {
                    console.log('⏳ 等待10秒后继续下一篇...\n');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
        }
        
        // 完成统计
        console.log('\n' + '='.repeat(70));
        console.log('🎉 失败文章重新处理完成！');
        console.log('='.repeat(70));
        console.log(`📊 处理统计:`);
        console.log(`   ✅ 成功: ${successCount} 篇`);
        console.log(`   ❌ 仍失败: ${failureCount} 篇`);
        console.log(`   📚 总计: ${sortedUrls.length} 篇`);
        console.log('\n📱 访问 http://localhost:8080 查看所有内容');
        
    } catch (error) {
        console.error('\n❌ 处理过程出错:', error);
    }
}

// 运行
if (require.main === module) {
    processRemainingFailedArticles().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}