#!/usr/bin/env node

/**
 * URL积压监控脚本
 * 功能：
 * 1. 定期检查待处理URL数量
 * 2. 超过阈值时发出警告
 * 3. 可选自动触发清理
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PendingUrlsMonitor {
    constructor() {
        this.thresholds = {
            warning: 100,    // 警告阈值
            critical: 500,   // 严重阈值
            auto_clean: 1000 // 自动清理阈值
        };
        
        this.stats = {
            total: 0,
            byStatus: {},
            byWebsite: {}
        };
    }
    
    async checkPendingUrls() {
        console.log(`\n🔍 URL积压监控 - ${new Date().toLocaleString()}`);
        console.log('═'.repeat(60));
        
        // 收集统计数据
        this.collectStats();
        
        // 显示统计
        this.displayStats();
        
        // 检查阈值并采取行动
        await this.checkThresholds();
        
        // 记录到日志
        this.logStats();
        
        return this.stats.total;
    }
    
    collectStats() {
        // 重置统计
        this.stats = {
            total: 0,
            byStatus: {
                pending_retry: 0,
                failed: 0,
                never_processed: 0,
                incomplete: 0
            },
            byWebsite: {}
        };
        
        // 从failed_articles.json收集
        this.collectFromFailedArticles();
        
        // 从master_history_database.json收集
        this.collectFromMasterHistory();
        
        // 从URL文件收集未处理的
        this.collectFromUrlFiles();
    }
    
    collectFromFailedArticles() {
        try {
            const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
            if (fs.existsSync(failedArticlesPath)) {
                const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
                
                for (const [url, data] of Object.entries(failedArticles)) {
                    if (data.status === 'pending_retry' || data.status === 'failed') {
                        this.stats.total++;
                        this.stats.byStatus[data.status]++;
                        
                        // 按网站统计
                        const domain = new URL(url).hostname;
                        this.stats.byWebsite[domain] = (this.stats.byWebsite[domain] || 0) + 1;
                    }
                }
            }
        } catch (e) {
            console.error(`⚠️ 无法读取failed_articles.json: ${e.message}`);
        }
    }
    
    collectFromMasterHistory() {
        try {
            const historyDBPath = path.join(__dirname, 'master_history_database.json');
            if (fs.existsSync(historyDBPath)) {
                const historyDB = JSON.parse(fs.readFileSync(historyDBPath, 'utf8'));
                const processedUrls = new Set();
                
                for (const [hash, data] of Object.entries(historyDB.urls || {})) {
                    if (!data.originalUrl || processedUrls.has(data.originalUrl)) continue;
                    
                    if (data.status === 'failed' || data.status === 'pending_retry' || 
                        data.status === 'incomplete_processing') {
                        this.stats.total++;
                        this.stats.byStatus[data.status] = (this.stats.byStatus[data.status] || 0) + 1;
                        processedUrls.add(data.originalUrl);
                    }
                }
            }
        } catch (e) {
            console.error(`⚠️ 无法读取master_history_database.json: ${e.message}`);
        }
    }
    
    collectFromUrlFiles() {
        try {
            const urlFiles = fs.readdirSync(__dirname)
                .filter(f => f.startsWith('deep_urls_') && f.endsWith('.txt'));
            
            const historyDB = this.loadHistoryDB();
            let unprocessedCount = 0;
            
            for (const file of urlFiles) {
                const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
                const urls = content.split('\n')
                    .filter(line => line.trim() && line.startsWith('http'));
                
                for (const url of urls) {
                    const urlHash = this.createUrlHash(url);
                    const historyEntry = historyDB.urls && historyDB.urls[urlHash];
                    
                    if (!historyEntry || historyEntry.status === 'pending') {
                        unprocessedCount++;
                    }
                }
            }
            
            if (unprocessedCount > 0) {
                this.stats.total += unprocessedCount;
                this.stats.byStatus.never_processed = unprocessedCount;
            }
        } catch (e) {
            console.error(`⚠️ 无法读取URL文件: ${e.message}`);
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
    
    displayStats() {
        console.log('\n📊 待处理URL统计：');
        console.log(`   总计: ${this.stats.total} 个URL`);
        
        if (this.stats.total > 0) {
            console.log('\n   按状态分类:');
            for (const [status, count] of Object.entries(this.stats.byStatus)) {
                if (count > 0) {
                    console.log(`   - ${status}: ${count}`);
                }
            }
            
            console.log('\n   按网站分布 (前10):');
            const sortedWebsites = Object.entries(this.stats.byWebsite)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            for (const [site, count] of sortedWebsites) {
                console.log(`   - ${site}: ${count}`);
            }
        }
    }
    
    async checkThresholds() {
        const total = this.stats.total;
        
        if (total >= this.thresholds.auto_clean) {
            console.log(`\n🚨 严重警告：待处理URL数量(${total})超过自动清理阈值(${this.thresholds.auto_clean})`);
            
            if (process.argv.includes('--auto-clean')) {
                console.log('🤖 正在自动启动清理程序...');
                await this.autoClean();
            } else {
                console.log('💡 建议：运行 node monitor_pending_urls.js --auto-clean 自动清理');
            }
        } else if (total >= this.thresholds.critical) {
            console.log(`\n⚠️ 严重警告：待处理URL数量(${total})超过严重阈值(${this.thresholds.critical})`);
            console.log('💡 建议：立即运行 node process_all_pending_urls.js 清理积压');
        } else if (total >= this.thresholds.warning) {
            console.log(`\n⚠️ 警告：待处理URL数量(${total})超过警告阈值(${this.thresholds.warning})`);
            console.log('💡 建议：考虑运行清理程序');
        } else {
            console.log(`\n✅ 正常：待处理URL数量(${total})在正常范围内`);
        }
    }
    
    async autoClean() {
        return new Promise((resolve) => {
            const proc = spawn('node', ['process_all_pending_urls.js'], {
                stdio: 'inherit'
            });
            
            proc.on('exit', (code) => {
                console.log(`\n✅ 自动清理完成，退出码: ${code}`);
                resolve();
            });
        });
    }
    
    logStats() {
        const logFile = 'pending_urls_monitor.log';
        const logEntry = {
            timestamp: new Date().toISOString(),
            total: this.stats.total,
            byStatus: this.stats.byStatus,
            topWebsites: Object.entries(this.stats.byWebsite)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .reduce((obj, [site, count]) => {
                    obj[site] = count;
                    return obj;
                }, {})
        };
        
        // 追加到日志文件
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    }
    
    // 生成报告
    generateReport() {
        const reportFile = `pending_urls_report_${new Date().toISOString().split('T')[0]}.md`;
        let report = `# URL积压监控报告\n\n`;
        report += `生成时间：${new Date().toLocaleString()}\n\n`;
        
        report += `## 概况\n`;
        report += `- 待处理URL总数：${this.stats.total}\n`;
        report += `- 状态：${this.getStatusText()}\n\n`;
        
        report += `## 详细统计\n\n`;
        report += `### 按状态分类\n`;
        for (const [status, count] of Object.entries(this.stats.byStatus)) {
            if (count > 0) {
                report += `- ${status}: ${count}\n`;
            }
        }
        
        report += `\n### 按网站分布\n`;
        const sortedWebsites = Object.entries(this.stats.byWebsite)
            .sort((a, b) => b[1] - a[1]);
        
        for (const [site, count] of sortedWebsites) {
            report += `- ${site}: ${count}\n`;
        }
        
        report += `\n## 建议\n`;
        report += this.getRecommendations();
        
        fs.writeFileSync(reportFile, report);
        console.log(`\n📄 详细报告已生成: ${reportFile}`);
    }
    
    getStatusText() {
        const total = this.stats.total;
        if (total >= this.thresholds.auto_clean) return '🚨 严重积压';
        if (total >= this.thresholds.critical) return '⚠️ 严重警告';
        if (total >= this.thresholds.warning) return '⚠️ 警告';
        return '✅ 正常';
    }
    
    getRecommendations() {
        const total = this.stats.total;
        let recommendations = '';
        
        if (total >= this.thresholds.critical) {
            recommendations += '1. 立即运行清理程序：`node process_all_pending_urls.js`\n';
            recommendations += '2. 检查是否有系统性问题导致大量失败\n';
            recommendations += '3. 考虑增加自动重试机制\n';
        } else if (total >= this.thresholds.warning) {
            recommendations += '1. 定期运行清理程序\n';
            recommendations += '2. 监控失败原因，优化处理逻辑\n';
        } else {
            recommendations += '系统运行正常，继续保持定期监控。\n';
        }
        
        return recommendations;
    }
}

// 主函数
async function main() {
    const monitor = new PendingUrlsMonitor();
    
    // 检查命令行参数
    if (process.argv.includes('--help')) {
        console.log(`
URL积压监控工具

用法：
  node monitor_pending_urls.js [选项]

选项：
  --auto-clean    当超过阈值时自动运行清理
  --report        生成详细报告文件
  --set-warning N  设置警告阈值（默认100）
  --set-critical N 设置严重阈值（默认500）
  --help          显示帮助信息

示例：
  node monitor_pending_urls.js                    # 基本监控
  node monitor_pending_urls.js --auto-clean       # 带自动清理
  node monitor_pending_urls.js --report           # 生成报告
        `);
        return;
    }
    
    // 设置自定义阈值
    const warningIndex = process.argv.indexOf('--set-warning');
    if (warningIndex > -1 && process.argv[warningIndex + 1]) {
        monitor.thresholds.warning = parseInt(process.argv[warningIndex + 1]);
    }
    
    const criticalIndex = process.argv.indexOf('--set-critical');
    if (criticalIndex > -1 && process.argv[criticalIndex + 1]) {
        monitor.thresholds.critical = parseInt(process.argv[criticalIndex + 1]);
    }
    
    // 执行检查
    await monitor.checkPendingUrls();
    
    // 生成报告
    if (process.argv.includes('--report')) {
        monitor.generateReport();
    }
}

// 启动
main().catch(console.error);