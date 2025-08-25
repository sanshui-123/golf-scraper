#!/usr/bin/env node

/**
 * 专门处理失败URL的脚本
 * 只处理状态为"failed"的文章
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class FailedUrlsProcessor {
    constructor() {
        this.logFile = `failed_urls_processor_${Date.now()}.log`;
        this.tempFile = process.argv[2]; // 从命令行参数获取临时文件
    }
    
    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }
    
    async processFailedUrls() {
        try {
            // 如果提供了临时文件，使用它
            let failedUrls = [];
            
            if (this.tempFile && fs.existsSync(this.tempFile)) {
                // 从临时文件读取URL
                const content = fs.readFileSync(this.tempFile, 'utf8');
                failedUrls = content.split('\n').filter(url => url.trim());
                
                this.log(`📄 从临时文件读取 ${failedUrls.length} 个失败的URL`);
            } else {
                // 否则从数据库收集
                failedUrls = this.collectFailedUrls();
            }
            
            if (failedUrls.length === 0) {
                this.log('✅ 没有失败的URL需要处理');
                return;
            }
            
            this.log(`🔄 找到 ${failedUrls.length} 个失败的URL准备处理`);
            
            // 创建临时URL文件（如果还没有）
            const tempUrlFile = this.tempFile || `temp_failed_urls_${Date.now()}.txt`;
            if (!this.tempFile) {
                fs.writeFileSync(tempUrlFile, failedUrls.join('\n'));
            }
            
            // 使用批处理器处理，带上 --retry-failed 参数
            this.log('🚀 启动批处理器处理失败的URL...');
            const proc = spawn('node', ['batch_process_articles.js', tempUrlFile, '--retry-failed'], {
                stdio: 'inherit'
            });
            
            proc.on('exit', (code) => {
                this.log(`✅ 处理完成，退出码: ${code}`);
                
                // 清理临时文件
                if (fs.existsSync(tempUrlFile)) {
                    fs.unlinkSync(tempUrlFile);
                    this.log('🧹 已清理临时文件');
                }
                
                // 显示处理结果统计
                this.showStatistics();
            });
            
            proc.on('error', (error) => {
                this.log(`❌ 启动批处理器失败: ${error.message}`);
            });
            
        } catch (error) {
            this.log(`❌ 错误: ${error.message}`);
        }
    }
    
    collectFailedUrls() {
        const failedUrls = [];
        
        // 从master_history_database.json收集
        try {
            const historyDBPath = path.join(__dirname, 'master_history_database.json');
            if (fs.existsSync(historyDBPath)) {
                const historyDB = JSON.parse(fs.readFileSync(historyDBPath, 'utf8'));
                for (const [hash, data] of Object.entries(historyDB.urls || {})) {
                    if (data.status === 'failed' && data.originalUrl) {
                        failedUrls.push(data.originalUrl);
                    }
                }
                this.log(`📊 从历史数据库收集到 ${failedUrls.length} 个失败URL`);
            }
        } catch (e) {
            this.log(`⚠️ 无法读取历史数据库: ${e.message}`);
        }
        
        // 也可以从各个日期的article_urls.json收集
        try {
            const golfContentDir = path.join(__dirname, 'golf_content');
            if (fs.existsSync(golfContentDir)) {
                const dates = fs.readdirSync(golfContentDir)
                    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
                
                for (const date of dates) {
                    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
                    if (fs.existsSync(urlsFile)) {
                        const urlMapping = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                        for (const [num, data] of Object.entries(urlMapping)) {
                            if (typeof data === 'object' && data.status === 'failed') {
                                if (!failedUrls.includes(data.url)) {
                                    failedUrls.push(data.url);
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            this.log(`⚠️ 无法读取文章URL文件: ${e.message}`);
        }
        
        return [...new Set(failedUrls)]; // 去重
    }
    
    showStatistics() {
        try {
            // 重新统计失败的URL数量
            const currentFailedUrls = this.collectFailedUrls();
            this.log('\n📊 处理后统计:');
            this.log(`   剩余失败URL: ${currentFailedUrls.length}`);
            
            // 按网站分组显示
            const byWebsite = {};
            for (const url of currentFailedUrls) {
                try {
                    const domain = new URL(url).hostname;
                    byWebsite[domain] = (byWebsite[domain] || 0) + 1;
                } catch (e) {}
            }
            
            if (Object.keys(byWebsite).length > 0) {
                this.log('\n   按网站分布:');
                for (const [site, count] of Object.entries(byWebsite)) {
                    this.log(`   - ${site}: ${count}个`);
                }
            }
        } catch (e) {
            this.log(`⚠️ 无法生成统计: ${e.message}`);
        }
    }
}

// 主程序
if (require.main === module) {
    const processor = new FailedUrlsProcessor();
    processor.processFailedUrls();
}

module.exports = FailedUrlsProcessor;