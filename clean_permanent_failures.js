#!/usr/bin/env node

/**
 * 清理永久失败的URL
 * 功能：
 * 1. 识别无法恢复的失败（404、403等）
 * 2. 将其标记为permanent_failed
 * 3. 清理pending_retry队列
 */

const fs = require('fs');
const path = require('path');

class PermanentFailureCleaner {
    constructor() {
        this.permanentFailureReasons = [
            'HTTP 404',
            'HTTP 403',
            '文章不存在或已被删除',
            'Target page, context or browser has been closed',
            '实时赛事报道内容过长'
        ];
        
        this.stats = {
            total: 0,
            cleaned: 0,
            byReason: {}
        };
    }
    
    async clean() {
        console.log('🧹 开始清理永久失败的URL...\n');
        
        // 加载failed_articles.json
        const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
        if (!fs.existsSync(failedArticlesPath)) {
            console.log('❌ failed_articles.json 不存在');
            return;
        }
        
        // 备份原文件
        const backupPath = `${failedArticlesPath}.backup_${Date.now()}`;
        fs.copyFileSync(failedArticlesPath, backupPath);
        console.log(`✅ 已备份到: ${backupPath}\n`);
        
        // 读取数据
        const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
        
        // 处理每个URL
        for (const [url, data] of Object.entries(failedArticles)) {
            if (data.status === 'pending_retry') {
                this.stats.total++;
                
                // 检查是否是永久失败
                if (this.isPermanentFailure(data)) {
                    // 标记为永久失败
                    data.status = 'permanent_failed';
                    data.cleanedAt = new Date().toISOString();
                    
                    this.stats.cleaned++;
                    
                    // 统计原因
                    const reason = this.getFailureCategory(data.reason);
                    this.stats.byReason[reason] = (this.stats.byReason[reason] || 0) + 1;
                }
            }
        }
        
        // 保存更新后的数据
        fs.writeFileSync(failedArticlesPath, JSON.stringify(failedArticles, null, 2));
        
        // 显示统计
        this.showStats();
    }
    
    isPermanentFailure(data) {
        if (!data.reason) return false;
        
        // 检查是否包含永久失败的关键词
        for (const keyword of this.permanentFailureReasons) {
            if (data.reason.includes(keyword)) {
                return true;
            }
        }
        
        // 检查尝试次数（超过3次的也标记为永久失败）
        if (data.attemptCount && data.attemptCount >= 3) {
            return true;
        }
        
        // 检查时间（超过7天的标记为永久失败）
        if (data.lastAttempt) {
            const daysSinceLastAttempt = (Date.now() - new Date(data.lastAttempt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastAttempt > 7) {
                return true;
            }
        }
        
        return false;
    }
    
    getFailureCategory(reason) {
        if (!reason) return '未知原因';
        
        if (reason.includes('404')) return 'HTTP 404 - 页面不存在';
        if (reason.includes('403')) return 'HTTP 403 - 访问被拒绝';
        if (reason.includes('实时赛事')) return '实时赛事报道';
        if (reason.includes('contentSize')) return '代码错误 - contentSize';
        if (reason.includes('内容无效')) return '内容无效';
        if (reason.includes('缺少标题')) return '缺少标题';
        if (reason.includes('不包含中文')) return '改写失败';
        if (reason.includes('closed')) return '浏览器关闭';
        if (reason.includes('Timeout')) return '超时错误';
        
        return reason.substring(0, 50) + '...';
    }
    
    showStats() {
        console.log('\n📊 清理统计：');
        console.log(`   待处理总数: ${this.stats.total}`);
        console.log(`   已清理数量: ${this.stats.cleaned}`);
        console.log(`   剩余待处理: ${this.stats.total - this.stats.cleaned}`);
        
        if (this.stats.cleaned > 0) {
            console.log('\n   按原因分类:');
            for (const [reason, count] of Object.entries(this.stats.byReason).sort((a, b) => b[1] - a[1])) {
                console.log(`   - ${reason}: ${count}`);
            }
        }
        
        console.log('\n✅ 清理完成！');
        
        // 提供后续建议
        if (this.stats.total - this.stats.cleaned > 0) {
            console.log('\n💡 建议：');
            console.log(`   还有 ${this.stats.total - this.stats.cleaned} 个URL可能可以重试`);
            console.log('   运行以下命令处理剩余的URL:');
            console.log('   node process_failed_urls.js');
        }
    }
    
    // 额外功能：生成清理报告
    async generateReport() {
        const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                total: 0,
                byStatus: {},
                byWebsite: {}
            },
            details: []
        };
        
        for (const [url, data] of Object.entries(failedArticles)) {
            report.summary.total++;
            
            // 按状态统计
            const status = data.status || 'unknown';
            report.summary.byStatus[status] = (report.summary.byStatus[status] || 0) + 1;
            
            // 按网站统计
            try {
                const hostname = new URL(url).hostname;
                report.summary.byWebsite[hostname] = (report.summary.byWebsite[hostname] || 0) + 1;
            } catch (e) {}
            
            // 记录详情
            if (data.status === 'permanent_failed') {
                report.details.push({
                    url,
                    reason: data.reason,
                    lastAttempt: data.lastAttempt,
                    attemptCount: data.attemptCount
                });
            }
        }
        
        // 保存报告
        const reportPath = `failed_articles_report_${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    }
}

// 主函数
async function main() {
    const cleaner = new PermanentFailureCleaner();
    
    // 执行清理
    await cleaner.clean();
    
    // 如果有--report参数，生成报告
    if (process.argv.includes('--report')) {
        await cleaner.generateReport();
    }
}

// 运行
main().catch(console.error);