#!/usr/bin/env node

/**
 * API失败处理指南
 * 
 * 当Claude API调用失败时的处理方案
 */

const fs = require('fs');
const path = require('path');

class APIFailureHandler {
    constructor() {
        this.failedArticlesLog = path.join(process.cwd(), 'failed_articles.json');
    }

    // 记录失败的文章
    logFailedArticle(url, reason, attemptCount = 1) {
        let failedArticles = {};
        
        if (fs.existsSync(this.failedArticlesLog)) {
            failedArticles = JSON.parse(fs.readFileSync(this.failedArticlesLog, 'utf8'));
        }
        
        failedArticles[url] = {
            reason,
            attemptCount,
            lastAttempt: new Date().toISOString(),
            status: 'pending_retry'
        };
        
        fs.writeFileSync(this.failedArticlesLog, JSON.stringify(failedArticles, null, 2));
        console.log(`📝 已记录失败文章: ${url}`);
    }

    // 获取需要重试的文章
    getFailedArticles() {
        if (!fs.existsSync(this.failedArticlesLog)) {
            return [];
        }
        
        const failedArticles = JSON.parse(fs.readFileSync(this.failedArticlesLog, 'utf8'));
        return Object.entries(failedArticles)
            .filter(([url, info]) => info.status === 'pending_retry')
            .map(([url, info]) => ({ url, ...info }));
    }

    // 标记文章为成功
    markAsSuccess(url) {
        if (!fs.existsSync(this.failedArticlesLog)) {
            return;
        }
        
        const failedArticles = JSON.parse(fs.readFileSync(this.failedArticlesLog, 'utf8'));
        if (failedArticles[url]) {
            failedArticles[url].status = 'success';
            failedArticles[url].completedAt = new Date().toISOString();
            fs.writeFileSync(this.failedArticlesLog, JSON.stringify(failedArticles, null, 2));
            console.log(`✅ 标记为成功: ${url}`);
        }
    }

    // 生成失败报告
    generateReport() {
        if (!fs.existsSync(this.failedArticlesLog)) {
            console.log('✅ 没有失败的文章');
            return;
        }
        
        const failedArticles = JSON.parse(fs.readFileSync(this.failedArticlesLog, 'utf8'));
        const pending = [];
        const success = [];
        
        Object.entries(failedArticles).forEach(([url, info]) => {
            if (info.status === 'pending_retry') {
                pending.push({ url, ...info });
            } else if (info.status === 'success') {
                success.push({ url, ...info });
            }
        });
        
        console.log('\n📊 API失败处理报告');
        console.log('==================\n');
        
        if (pending.length > 0) {
            console.log(`❌ 待重试文章 (${pending.length}):`);
            pending.forEach((item, i) => {
                console.log(`   ${i + 1}. ${item.url}`);
                console.log(`      原因: ${item.reason}`);
                console.log(`      尝试次数: ${item.attemptCount}`);
                console.log(`      最后尝试: ${new Date(item.lastAttempt).toLocaleString()}`);
            });
            console.log('');
        }
        
        if (success.length > 0) {
            console.log(`✅ 已成功文章 (${success.length}):`);
            success.forEach((item, i) => {
                console.log(`   ${i + 1}. ${item.url}`);
            });
        }
    }
}

// 命令行执行
if (require.main === module) {
    const handler = new APIFailureHandler();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'report':
            handler.generateReport();
            break;
            
        case 'retry':
            const failed = handler.getFailedArticles();
            if (failed.length > 0) {
                console.log('\n待重试的URL列表:');
                const urls = failed.map(f => f.url);
                console.log(JSON.stringify(urls, null, 2));
                
                // 创建临时URL文件
                const tempFile = `retry_urls_${Date.now()}.json`;
                fs.writeFileSync(tempFile, JSON.stringify(urls));
                console.log(`\n已保存到: ${tempFile}`);
                console.log('运行以下命令重试:');
                console.log(`node run_batch_processor.js ${tempFile}`);
            } else {
                console.log('✅ 没有需要重试的文章');
            }
            break;
            
        case 'clear':
            if (fs.existsSync(handler.failedArticlesLog)) {
                fs.unlinkSync(handler.failedArticlesLog);
                console.log('✅ 已清除失败记录');
            }
            break;
            
        default:
            console.log('API失败处理工具');
            console.log('================\n');
            console.log('用法:');
            console.log('  node api_failure_handler.js report  - 查看失败报告');
            console.log('  node api_failure_handler.js retry   - 生成重试URL列表');
            console.log('  node api_failure_handler.js clear   - 清除所有记录');
    }
}

module.exports = APIFailureHandler;