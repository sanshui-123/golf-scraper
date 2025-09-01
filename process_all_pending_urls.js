#!/usr/bin/env node

/**
 * 处理所有待处理URL的综合脚本
 * 功能：
 * 1. 收集所有状态的待处理URL（failed、pending_retry、incomplete_processing等）
 * 2. 对URL进行智能分类
 * 3. 使用智能并发控制器批量处理
 * 4. 遵守最大2个并发的核心规则
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PendingUrlsProcessor {
    constructor() {
        this.logFile = `pending_urls_processor_${Date.now()}.log`;
        this.categorizedUrls = {
            retry_failed: [],      // 需要重试的失败URL
            never_processed: [],   // 从未处理过的URL
            incomplete: [],        // 处理不完整的URL
            timeout: [],          // 超时的URL
            error_403: [],        // 403错误的URL
            other_errors: []      // 其他错误的URL
        };
    }
    
    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }
    
    async collectAllPendingUrls() {
        this.log('🔍 开始收集所有待处理的URL...');
        
        // 1. 从 failed_articles.json 收集
        this.collectFromFailedArticles();
        
        // 2. 从 master_history_database.json 收集
        this.collectFromMasterHistory();
        
        // 3. 从当前URL文件收集未处理的
        this.collectFromUrlFiles();
        
        // 显示统计
        this.showStatistics();
        
        return this.getAllUrls();
    }
    
    collectFromFailedArticles() {
        try {
            const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
            if (fs.existsSync(failedArticlesPath)) {
                const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
                
                for (const [url, data] of Object.entries(failedArticles)) {
                    if (data.status === 'pending_retry' || data.status === 'failed') {
                        // 根据失败原因分类
                        if (data.reason && data.reason.includes('403')) {
                            this.categorizedUrls.error_403.push(url);
                        } else if (data.reason && data.reason.includes('Timeout')) {
                            this.categorizedUrls.timeout.push(url);
                        } else if (data.status === 'pending_retry') {
                            this.categorizedUrls.retry_failed.push(url);
                        } else {
                            this.categorizedUrls.other_errors.push(url);
                        }
                    }
                }
                
                this.log(`📄 从failed_articles.json收集到 ${this.getTotalCount()} 个URL`);
            }
        } catch (e) {
            this.log(`⚠️ 无法读取failed_articles.json: ${e.message}`);
        }
    }
    
    collectFromMasterHistory() {
        try {
            const historyDBPath = path.join(__dirname, 'master_history_database.json');
            if (fs.existsSync(historyDBPath)) {
                const historyDB = JSON.parse(fs.readFileSync(historyDBPath, 'utf8'));
                
                for (const [hash, data] of Object.entries(historyDB.urls || {})) {
                    const url = data.originalUrl;
                    if (!url) continue;
                    
                    // 跳过已经在其他列表中的URL
                    if (this.isUrlAlreadyCollected(url)) continue;
                    
                    if (data.status === 'failed' || data.status === 'pending_retry') {
                        this.categorizedUrls.retry_failed.push(url);
                    } else if (data.status === 'incomplete_processing') {
                        this.categorizedUrls.incomplete.push(url);
                    }
                }
                
                this.log(`📊 从master_history_database.json收集到 ${this.getTotalCount()} 个URL（累计）`);
            }
        } catch (e) {
            this.log(`⚠️ 无法读取master_history_database.json: ${e.message}`);
        }
    }
    
    collectFromUrlFiles() {
        try {
            // 获取所有URL文件
            const urlFiles = fs.readdirSync(__dirname)
                .filter(f => f.startsWith('deep_urls_') && f.endsWith('.txt'));
            
            const historyDB = this.loadHistoryDB();
            let newUrlsCount = 0;
            
            for (const file of urlFiles) {
                const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
                const urls = content.split('\n')
                    .filter(line => line.trim() && line.startsWith('http'));
                
                for (const url of urls) {
                    // 检查是否已经处理过
                    const urlHash = this.createUrlHash(url);
                    const historyEntry = historyDB.urls && historyDB.urls[urlHash];
                    
                    if (!historyEntry || historyEntry.status === 'pending') {
                        if (!this.isUrlAlreadyCollected(url)) {
                            this.categorizedUrls.never_processed.push(url);
                            newUrlsCount++;
                        }
                    }
                }
            }
            
            if (newUrlsCount > 0) {
                this.log(`📝 从URL文件中发现 ${newUrlsCount} 个未处理的URL`);
            }
        } catch (e) {
            this.log(`⚠️ 无法读取URL文件: ${e.message}`);
        }
    }
    
    loadHistoryDB() {
        try {
            const historyDBPath = path.join(__dirname, 'master_history_database.json');
            if (fs.existsSync(historyDBPath)) {
                return JSON.parse(fs.readFileSync(historyDBPath, 'utf8'));
            }
        } catch (e) {}
        return { urls: {} };
    }
    
    createUrlHash(url) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(url).digest('hex');
    }
    
    isUrlAlreadyCollected(url) {
        for (const category of Object.values(this.categorizedUrls)) {
            if (category.includes(url)) return true;
        }
        return false;
    }
    
    getTotalCount() {
        return Object.values(this.categorizedUrls)
            .reduce((sum, arr) => sum + arr.length, 0);
    }
    
    getAllUrls() {
        const allUrls = [];
        for (const category of Object.values(this.categorizedUrls)) {
            allUrls.push(...category);
        }
        return [...new Set(allUrls)]; // 去重
    }
    
    showStatistics() {
        this.log('\n📊 URL分类统计：');
        this.log(`   需要重试的失败URL: ${this.categorizedUrls.retry_failed.length}`);
        this.log(`   从未处理过的URL: ${this.categorizedUrls.never_processed.length}`);
        this.log(`   处理不完整的URL: ${this.categorizedUrls.incomplete.length}`);
        this.log(`   超时错误的URL: ${this.categorizedUrls.timeout.length}`);
        this.log(`   403错误的URL: ${this.categorizedUrls.error_403.length}`);
        this.log(`   其他错误的URL: ${this.categorizedUrls.other_errors.length}`);
        this.log(`   总计: ${this.getTotalCount()} 个待处理URL\n`);
        
        // 按网站分组显示
        this.showByWebsite();
    }
    
    showByWebsite() {
        const byWebsite = {};
        const allUrls = this.getAllUrls();
        
        for (const url of allUrls) {
            try {
                const domain = new URL(url).hostname;
                byWebsite[domain] = (byWebsite[domain] || 0) + 1;
            } catch (e) {}
        }
        
        if (Object.keys(byWebsite).length > 0) {
            this.log('   按网站分布:');
            const sorted = Object.entries(byWebsite)
                .sort((a, b) => b[1] - a[1]);
            
            for (const [site, count] of sorted) {
                this.log(`   - ${site}: ${count}个`);
            }
            this.log('');
        }
    }
    
    async processUrls() {
        const allUrls = await this.collectAllPendingUrls();
        
        if (allUrls.length === 0) {
            this.log('✅ 没有待处理的URL');
            return;
        }
        
        // 创建临时URL文件
        const tempUrlFile = `temp_all_pending_urls_${Date.now()}.txt`;
        fs.writeFileSync(tempUrlFile, allUrls.join('\n'));
        
        this.log(`📝 已创建临时文件: ${tempUrlFile}`);
        this.log(`🚀 启动智能并发控制器处理 ${allUrls.length} 个URL...`);
        this.log('⚠️ 核心规则：最大并发数 2 个进程');
        
        // 使用智能并发控制器
        const proc = spawn('node', ['intelligent_concurrent_controller.js', tempUrlFile], {
            stdio: 'inherit'
        });
        
        proc.on('exit', (code) => {
            this.log(`\n✅ 处理完成，退出码: ${code}`);
            
            // 清理临时文件
            try {
                fs.unlinkSync(tempUrlFile);
                this.log('🧹 已清理临时文件');
            } catch (e) {}
            
            // 显示处理后的统计
            this.showFinalStatistics();
        });
    }
    
    showFinalStatistics() {
        this.log('\n📊 处理完成后统计：');
        
        // 重新收集统计
        this.categorizedUrls = {
            retry_failed: [],
            never_processed: [],
            incomplete: [],
            timeout: [],
            error_403: [],
            other_errors: []
        };
        
        this.collectFromFailedArticles();
        this.collectFromMasterHistory();
        
        this.log(`   剩余待处理URL: ${this.getTotalCount()}`);
        this.showByWebsite();
    }
}

// 主函数
async function main() {
    const processor = new PendingUrlsProcessor();
    
    // 如果提供了参数 --stats-only，只显示统计
    if (process.argv.includes('--stats-only')) {
        await processor.collectAllPendingUrls();
        return;
    }
    
    // 否则执行处理
    await processor.processUrls();
}

// 启动
main().catch(console.error);