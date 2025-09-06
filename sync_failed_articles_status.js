#!/usr/bin/env node

/**
 * 同步failed_articles.json与master数据库的状态
 * 功能：
 * 1. 检查failed_articles.json中的pending_retry URL
 * 2. 如果在master数据库中已成功处理，更新状态为success
 * 3. 生成清理报告
 */

const fs = require('fs');
const path = require('path');

class FailedArticlesSyncer {
    constructor() {
        this.stats = {
            total: 0,
            synced: 0,
            stillPending: 0,
            byWebsite: {}
        };
    }
    
    async sync() {
        console.log('🔄 开始同步failed_articles.json与master数据库...\n');
        
        // 加载数据
        const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
        const masterDbPath = path.join(__dirname, 'master_history_database.json');
        
        if (!fs.existsSync(failedArticlesPath) || !fs.existsSync(masterDbPath)) {
            console.log('❌ 必需的文件不存在');
            return;
        }
        
        // 备份failed_articles.json
        const backupPath = `${failedArticlesPath}.backup_${Date.now()}`;
        fs.copyFileSync(failedArticlesPath, backupPath);
        console.log(`✅ 已备份到: ${backupPath}\n`);
        
        // 读取数据
        const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
        const masterDb = JSON.parse(fs.readFileSync(masterDbPath, 'utf8'));
        
        // 创建URL到master记录的映射
        const urlToMasterMap = {};
        for (const [hash, record] of Object.entries(masterDb)) {
            if (record.url) {
                urlToMasterMap[record.url] = record;
            }
        }
        
        // 同步状态
        for (const [url, data] of Object.entries(failedArticles)) {
            if (data.status === 'pending_retry') {
                this.stats.total++;
                
                // 检查是否在master数据库中已成功
                const masterRecord = urlToMasterMap[url];
                if (masterRecord && masterRecord.localFile) {
                    // 更新为成功状态
                    data.status = 'success';
                    data.syncedAt = new Date().toISOString();
                    data.localFile = masterRecord.localFile;
                    
                    this.stats.synced++;
                    
                    // 统计网站
                    try {
                        const hostname = new URL(url).hostname;
                        this.stats.byWebsite[hostname] = (this.stats.byWebsite[hostname] || 0) + 1;
                    } catch (e) {}
                } else {
                    this.stats.stillPending++;
                }
            }
        }
        
        // 保存更新后的数据
        fs.writeFileSync(failedArticlesPath, JSON.stringify(failedArticles, null, 2));
        
        // 显示统计
        this.showStats();
        
        // 生成真正需要处理的URL列表
        if (this.stats.stillPending > 0) {
            await this.generateTrulyPendingUrls(failedArticles);
        }
    }
    
    async generateTrulyPendingUrls(failedArticles) {
        const trulyPendingUrls = [];
        
        for (const [url, data] of Object.entries(failedArticles)) {
            if (data.status === 'pending_retry') {
                trulyPendingUrls.push(url);
            }
        }
        
        // 保存到文件
        const outputPath = `truly_pending_urls_${Date.now()}.txt`;
        fs.writeFileSync(outputPath, trulyPendingUrls.join('\n'));
        console.log(`\n📄 真正需要处理的URL已保存到: ${outputPath}`);
        console.log(`   共 ${trulyPendingUrls.length} 个URL`);
        
        // 显示前10个示例
        console.log('\n📌 前10个真正待处理的URL:');
        trulyPendingUrls.slice(0, 10).forEach((url, i) => {
            console.log(`   ${i + 1}. ${url}`);
        });
    }
    
    showStats() {
        console.log('\n📊 同步统计：');
        console.log(`   检查的pending_retry: ${this.stats.total}`);
        console.log(`   已成功处理（同步）: ${this.stats.synced}`);
        console.log(`   仍需处理: ${this.stats.stillPending}`);
        
        if (this.stats.synced > 0) {
            console.log('\n   已同步的网站分布:');
            for (const [website, count] of Object.entries(this.stats.byWebsite).sort((a, b) => b[1] - a[1])) {
                console.log(`   - ${website}: ${count}`);
            }
        }
        
        console.log('\n✅ 同步完成！');
        
        // 提供分析
        if (this.stats.synced > 0) {
            console.log('\n💡 分析：');
            console.log(`   ${this.stats.synced} 个URL实际上已经成功处理`);
            console.log('   这说明failed_articles.json的状态没有及时更新');
            console.log('   现在已经将它们标记为success');
        }
        
        if (this.stats.stillPending > 0) {
            console.log(`\n   还有 ${this.stats.stillPending} 个URL确实需要处理`);
            console.log('   可以使用生成的truly_pending_urls文件进行处理');
        }
    }
}

// 主函数
async function main() {
    const syncer = new FailedArticlesSyncer();
    await syncer.sync();
}

// 运行
main().catch(console.error);