#!/usr/bin/env node

/**
 * 智能失败文章过滤器
 * 功能：
 * 1. 根据失败原因智能分类
 * 2. 自动标记永久失败
 * 3. 集成到主处理流程
 * 4. 提供详细的统计报告
 */

const fs = require('fs');
const path = require('path');

class IntelligentFailureFilter {
    constructor() {
        // 永久失败模式（不应重试）
        this.permanentFailurePatterns = [
            // HTTP错误
            { pattern: /HTTP 404/, category: 'not_found', description: '页面不存在' },
            { pattern: /HTTP 403/, category: 'forbidden', description: '访问被拒绝' },
            { pattern: /HTTP 410/, category: 'gone', description: '内容已永久删除' },
            
            // 内容问题
            { pattern: /实时赛事报道/, category: 'live_content', description: '实时内容不适合处理' },
            { pattern: /视频内容/, category: 'video_content', description: '视频内容无法处理' },
            { pattern: /图片集/, category: 'gallery', description: '图片集内容' },
            
            // 技术限制
            { pattern: /contentSize is not defined/, category: 'code_error', description: '代码错误需修复' },
            { pattern: /urlsWithNumbers is not defined/, category: 'code_error', description: '代码错误需修复' },
            { pattern: /Target page.*closed/, category: 'browser_error', description: '浏览器错误' },
            
            // 内容无效
            { pattern: /内容过短.*[0-9]+字符/, category: 'invalid_content', description: '内容太短' },
            { pattern: /缺少标题/, category: 'invalid_content', description: '文章结构不完整' },
            { pattern: /文章内容无效/, category: 'invalid_content', description: '内容无效' }
        ];
        
        // 临时失败模式（可以重试）
        this.temporaryFailurePatterns = [
            { pattern: /Timeout.*exceeded/, category: 'timeout', description: '超时错误' },
            { pattern: /net::ERR_/, category: 'network', description: '网络错误' },
            { pattern: /ECONNREFUSED/, category: 'network', description: '连接被拒绝' },
            { pattern: /改写结果不包含中文/, category: 'rewrite_error', description: '改写失败' }
        ];
        
        this.stats = {
            total: 0,
            permanent: 0,
            temporary: 0,
            unknown: 0,
            byCategory: {},
            byWebsite: {}
        };
    }
    
    async filterFailures() {
        console.log('🔍 开始智能过滤失败文章...\n');
        
        const failedArticlesPath = 'failed_articles.json';
        if (!fs.existsSync(failedArticlesPath)) {
            console.log('❌ failed_articles.json 不存在');
            return;
        }
        
        // 备份
        const backupPath = `${failedArticlesPath}.backup_${Date.now()}`;
        fs.copyFileSync(failedArticlesPath, backupPath);
        console.log(`✅ 已备份到: ${backupPath}\n`);
        
        // 读取数据
        const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
        
        // 处理每个失败的文章
        for (const [url, data] of Object.entries(failedArticles)) {
            if (data.status === 'pending_retry' || !data.status) {
                this.stats.total++;
                
                // 分析失败类型
                const failureType = this.analyzeFailure(data);
                
                if (failureType.type === 'permanent') {
                    // 标记为永久失败
                    data.status = 'permanent_failed';
                    data.failureCategory = failureType.category;
                    data.failureDescription = failureType.description;
                    data.filteredAt = new Date().toISOString();
                    this.stats.permanent++;
                    
                    // 统计分类
                    this.stats.byCategory[failureType.category] = 
                        (this.stats.byCategory[failureType.category] || 0) + 1;
                    
                } else if (failureType.type === 'temporary') {
                    // 检查重试次数
                    if ((data.attemptCount || 0) >= 3) {
                        // 超过3次也标记为永久失败
                        data.status = 'permanent_failed';
                        data.failureCategory = 'max_retries';
                        data.failureDescription = '超过最大重试次数';
                        data.filteredAt = new Date().toISOString();
                        this.stats.permanent++;
                    } else {
                        this.stats.temporary++;
                    }
                } else {
                    this.stats.unknown++;
                }
                
                // 统计网站
                try {
                    const hostname = new URL(url).hostname;
                    this.stats.byWebsite[hostname] = (this.stats.byWebsite[hostname] || 0) + 1;
                } catch (e) {}
            }
        }
        
        // 保存更新后的数据
        fs.writeFileSync(failedArticlesPath, JSON.stringify(failedArticles, null, 2));
        
        // 显示统计
        this.showStats();
        
        // 生成优化建议
        this.generateOptimizationSuggestions();
    }
    
    analyzeFailure(data) {
        if (!data.reason) {
            return { type: 'unknown', category: 'no_reason', description: '无失败原因' };
        }
        
        // 检查永久失败模式
        for (const pattern of this.permanentFailurePatterns) {
            if (pattern.pattern.test(data.reason)) {
                return {
                    type: 'permanent',
                    category: pattern.category,
                    description: pattern.description
                };
            }
        }
        
        // 检查临时失败模式
        for (const pattern of this.temporaryFailurePatterns) {
            if (pattern.pattern.test(data.reason)) {
                return {
                    type: 'temporary',
                    category: pattern.category,
                    description: pattern.description
                };
            }
        }
        
        // 基于时间判断
        if (data.lastAttempt) {
            const daysSince = (Date.now() - new Date(data.lastAttempt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 7) {
                return {
                    type: 'permanent',
                    category: 'stale',
                    description: '超过7天未成功'
                };
            }
        }
        
        return { type: 'unknown', category: 'unknown', description: '未知失败类型' };
    }
    
    showStats() {
        console.log('\n📊 智能过滤统计：');
        console.log(`   分析总数: ${this.stats.total}`);
        console.log(`   永久失败: ${this.stats.permanent} (${(this.stats.permanent/this.stats.total*100).toFixed(1)}%)`);
        console.log(`   临时失败: ${this.stats.temporary} (${(this.stats.temporary/this.stats.total*100).toFixed(1)}%)`);
        console.log(`   未知类型: ${this.stats.unknown}`);
        
        if (Object.keys(this.stats.byCategory).length > 0) {
            console.log('\n   失败分类:');
            const sortedCategories = Object.entries(this.stats.byCategory)
                .sort((a, b) => b[1] - a[1]);
            for (const [category, count] of sortedCategories) {
                const pattern = this.permanentFailurePatterns.find(p => p.category === category);
                const desc = pattern ? pattern.description : category;
                console.log(`   - ${desc}: ${count}`);
            }
        }
        
        if (Object.keys(this.stats.byWebsite).length > 0) {
            console.log('\n   按网站统计:');
            const sortedWebsites = Object.entries(this.stats.byWebsite)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            for (const [website, count] of sortedWebsites) {
                console.log(`   - ${website}: ${count}`);
            }
        }
    }
    
    generateOptimizationSuggestions() {
        console.log('\n💡 优化建议：');
        
        // 代码错误建议
        if (this.stats.byCategory.code_error > 0) {
            console.log(`   ⚠️  发现 ${this.stats.byCategory.code_error} 个代码错误，建议修复相关bug`);
        }
        
        // 网络错误建议
        if (this.stats.temporary > 20) {
            console.log(`   ⚠️  有 ${this.stats.temporary} 个临时失败，可能需要优化网络重试策略`);
        }
        
        // 效率提升建议
        const efficiencyGain = (this.stats.permanent / this.stats.total * 100).toFixed(0);
        console.log(`   ✅ 过滤永久失败后，可减少 ${efficiencyGain}% 的无效处理`);
        
        // 后续操作建议
        if (this.stats.temporary > 0) {
            console.log(`\n   📝 后续操作：`);
            console.log(`   1. 运行 node intelligent_concurrent_controller.js 处理新文章`);
            console.log(`   2. ${this.stats.temporary} 个临时失败的文章会自动重试`);
            console.log(`   3. 定期运行此过滤器保持队列清洁`);
        }
    }
    
    // 集成到主流程的方法
    static async cleanBeforeProcessing() {
        const filter = new IntelligentFailureFilter();
        
        // 快速检查是否需要清理
        const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
        const pendingCount = Object.values(failedArticles)
            .filter(item => item.status === 'pending_retry').length;
        
        if (pendingCount > 50) {
            console.log(`\n⚠️  检测到 ${pendingCount} 个待重试文章，执行智能过滤...`);
            await filter.filterFailures();
            return true;
        }
        
        return false;
    }
}

// 主函数
async function main() {
    const filter = new IntelligentFailureFilter();
    await filter.filterFailures();
    
    // 生成详细报告
    if (process.argv.includes('--report')) {
        const report = {
            timestamp: new Date().toISOString(),
            stats: filter.stats,
            recommendations: []
        };
        
        if (filter.stats.byCategory.code_error > 0) {
            report.recommendations.push({
                type: 'bug_fix',
                priority: 'high',
                description: '修复contentSize和urlsWithNumbers相关错误'
            });
        }
        
        if (filter.stats.permanent > 100) {
            report.recommendations.push({
                type: 'process_optimization',
                priority: 'medium',
                description: '考虑定期自动运行过滤器'
            });
        }
        
        const reportPath = `intelligent_filter_report_${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    }
}

// 导出供其他模块使用
module.exports = IntelligentFailureFilter;

// 如果直接运行
if (require.main === module) {
    main().catch(console.error);
}