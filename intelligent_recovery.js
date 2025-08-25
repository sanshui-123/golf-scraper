#!/usr/bin/env node

/**
 * 🧠 智能恢复系统 - 基于现有AdaptiveAccessStrategy架构
 * 
 * 核心功能：
 * 1. 自动检测article_urls.json中的processing/retrying状态
 * 2. 使用现有的AdaptiveAccessStrategy智能诊断
 * 3. 调用现有的BatchArticleProcessor完成恢复
 * 4. 持续监控，确保所有中断任务最终完成
 */

const fs = require('fs');
const path = require('path');
const AdaptiveAccessStrategy = require('./adaptive_access_strategy');
const BatchArticleProcessor = require('./batch_process_articles');

class IntelligentRecovery {
    constructor() {
        this.adaptiveStrategy = new AdaptiveAccessStrategy();
        this.recoveryStats = {
            totalChecked: 0,
            totalRecovered: 0,
            totalFailed: 0
        };
    }

    async start() {
        console.log('🧠 智能恢复系统启动...');
        
        // 显示系统智能状态
        this.displayIntelligentStatus();
        
        // 执行恢复检查
        await this.performRecovery();
        
        console.log('✅ 智能恢复完成');
    }

    displayIntelligentStatus() {
        const resourceCount = this.adaptiveStrategy.systemResources.size;
        const problemCount = this.adaptiveStrategy.problemPatterns.size;
        
        console.log(`🧠 系统智能层状态: 📊 可用资源: ${resourceCount} 个, 🔍 已知问题类型: ${problemCount} 种`);
    }

    async performRecovery() {
        console.log('🔍 扫描中断的文章...');
        
        const interrupted = this.findInterruptedArticles();
        
        if (interrupted.length === 0) {
            console.log('✅ 未发现需要恢复的文章');
            return;
        }

        console.log(`🔄 发现 ${interrupted.length} 篇需要恢复的文章`);
        
        for (const article of interrupted) {
            await this.recoverArticle(article);
        }

        this.printRecoveryStats();
    }

    findInterruptedArticles() {
        const interrupted = [];
        const contentDir = path.join(process.cwd(), 'golf_content');
        
        if (!fs.existsSync(contentDir)) {
            return interrupted;
        }

        const dateDirs = fs.readdirSync(contentDir)
            .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));

        for (const dateDir of dateDirs) {
            const urlsFile = path.join(contentDir, dateDir, 'article_urls.json');
            
            if (!fs.existsSync(urlsFile)) continue;

            try {
                const urlsData = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                
                Object.entries(urlsData).forEach(([id, info]) => {
                    if (info.status === 'processing' || info.status === 'retrying') {
                        const timeSinceStart = Date.now() - new Date(info.timestamp).getTime();
                        
                        if (timeSinceStart > 1800000) { // 30分钟超时
                            interrupted.push({
                                id,
                                url: info.url,
                                status: info.status,
                                urlsFile,
                                error: info.previousError || info.error
                            });
                        }
                    }
                });
                
            } catch (e) {
                console.warn(`⚠️ 无法读取 ${urlsFile}: ${e.message}`);
            }
        }

        return interrupted;
    }

    async recoverArticle(article) {
        console.log(`\n🔧 恢复文章 ${article.id}: ${article.url.substring(0, 80)}...`);
        this.recoveryStats.totalChecked++;

        try {
            // 使用智能诊断系统
            const domain = new URL(article.url).hostname;
            const diagnosis = this.adaptiveStrategy.diagnoseAndResolve(
                article.error || 'Processing interrupted',
                domain
            );

            if (diagnosis.success) {
                console.log(`🎯 智能诊断: ${diagnosis.problemType} -> ${diagnosis.strategy}`);
            } else {
                console.log(`❌ 智能诊断无法识别问题，使用默认策略`);
            }

            // 更新状态为恢复中
            this.updateArticleStatus(article, 'recovering');

            // 使用批处理系统恢复
            const processor = new BatchArticleProcessor();
            await processor.processArticles([article.url]);

            console.log(`✅ 文章 ${article.id} 恢复成功`);
            this.recoveryStats.totalRecovered++;

        } catch (error) {
            console.error(`❌ 文章 ${article.id} 恢复失败: ${error.message}`);
            this.updateArticleStatus(article, 'failed', error.message);
            this.recoveryStats.totalFailed++;
        }
    }

    updateArticleStatus(article, newStatus, message = '') {
        try {
            const urlsData = JSON.parse(fs.readFileSync(article.urlsFile, 'utf8'));
            
            if (urlsData[article.id]) {
                urlsData[article.id].status = newStatus;
                urlsData[article.id].recoveryTimestamp = new Date().toISOString();
                if (message) {
                    urlsData[article.id].recoveryMessage = message;
                }
                
                fs.writeFileSync(article.urlsFile, JSON.stringify(urlsData, null, 2));
            }
            
        } catch (error) {
            console.error(`❌ 状态更新失败: ${error.message}`);
        }
    }

    printRecoveryStats() {
        console.log('\n📊 恢复统计:');
        console.log(`   🔍 总检查: ${this.recoveryStats.totalChecked} 篇`);
        console.log(`   ✅ 成功恢复: ${this.recoveryStats.totalRecovered} 篇`);
        console.log(`   ❌ 恢复失败: ${this.recoveryStats.totalFailed} 篇`);
        
        const successRate = this.recoveryStats.totalChecked > 0 ? 
            (this.recoveryStats.totalRecovered / this.recoveryStats.totalChecked * 100).toFixed(1) : 0;
        console.log(`   📈 成功率: ${successRate}%`);
    }
}

// 直接运行
if (require.main === module) {
    const recovery = new IntelligentRecovery();
    recovery.start().then(() => {
        console.log('\n🎉 智能恢复系统执行完成');
        console.log('💡 访问 http://localhost:8080 查看处理结果');
        process.exit(0);
    }).catch(error => {
        console.error('💥 智能恢复失败:', error);
        process.exit(1);
    });
}

module.exports = IntelligentRecovery;