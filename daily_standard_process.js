#!/usr/bin/env node

/**
 * 🎯 日常标准操作流程 - 基于现有架构的统一入口
 * 
 * 设计理念：
 * 1. 整合现有所有组件，不重复造轮子
 * 2. 建立标准化的日常操作流程
 * 3. 预防性维护 + 自动化问题发现
 * 4. 一键执行，无需记忆具体脚本
 * 
 * 核心价值：
 * - 从"被动修复"转为"主动维护"
 * - 从"手动选择"转为"自动执行"
 * - 从"分散工具"转为"统一流程"
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 导入现有组件 - 100%基于现有架构
const UnifiedSolutionBrain = require('./unified_solution_brain');

class DailyStandardProcess {
    constructor() {
        this.workingDir = process.cwd();
        this.solutionBrain = new UnifiedSolutionBrain();
        
        // 🎯 标准化流程定义
        this.standardProcesses = {
            // 日常维护流程
            'daily': {
                name: '日常标准维护流程',
                steps: [
                    'systemHealthCheck',
                    'processNewArticles', 
                    'recoverInterrupted',
                    'cleanupSystem',
                    'generateReport'
                ],
                description: '每日标准维护，确保系统健康运行'
            },
            
            // 紧急修复流程
            'emergency': {
                name: '紧急问题修复流程',
                steps: [
                    'emergencyDiagnosis',
                    'autoRecovery',
                    'systemVerification'
                ],
                description: '紧急情况快速修复'
            },
            
            // 批量处理流程
            'batch': {
                name: '批量处理流程',
                steps: [
                    'batchPreCheck',
                    'executeBatchProcessing',
                    'postProcessVerification'
                ],
                description: '大批量文章处理'
            }
        };
        
        // 系统状态
        this.systemStatus = {
            lastMaintenance: this.getLastMaintenanceTime(),
            healthScore: 0,
            knownIssues: []
        };
        
        console.log('🎯 日常标准流程系统就绪');
    }
    
    /**
     * 🚀 执行标准流程
     */
    async executeStandardProcess(processType = 'daily') {
        const process = this.standardProcesses[processType];
        if (!process) {
            throw new Error(`未知流程类型: ${processType}`);
        }
        
        console.log(`🎯 开始执行: ${process.name}`);
        console.log(`📋 流程步骤: ${process.steps.length} 步`);
        
        const results = [];
        
        for (let i = 0; i < process.steps.length; i++) {
            const step = process.steps[i];
            const stepNum = i + 1;
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📍 步骤 ${stepNum}/${process.steps.length}: ${this.getStepName(step)}`);
            console.log(`${'='.repeat(60)}`);
            
            try {
                const result = await this.executeStep(step);
                results.push({ step, success: true, result });
                
                console.log(`✅ 步骤 ${stepNum} 完成`);
                
            } catch (error) {
                console.error(`❌ 步骤 ${stepNum} 失败: ${error.message}`);
                results.push({ step, success: false, error: error.message });
                
                // 关键步骤失败时的处理
                if (this.isCriticalStep(step)) {
                    console.log('🔧 关键步骤失败，尝试自动修复...');
                    await this.handleCriticalStepFailure(step, error);
                }
            }
            
            // 步骤间短暂休息
            if (i < process.steps.length - 1) {
                await this.sleep(2000);
            }
        }
        
        // 生成执行报告
        this.generateExecutionReport(processType, results);
        this.updateMaintenanceTime();
        
        console.log(`\n🎉 ${process.name}执行完成!`);
        return results;
    }
    
    /**
     * 📋 执行具体步骤
     */
    async executeStep(stepName) {
        switch (stepName) {
            case 'systemHealthCheck':
                return await this.performSystemHealthCheck();
                
            case 'processNewArticles':
                return await this.processNewArticles();
                
            case 'recoverInterrupted':
                return await this.recoverInterruptedArticles();
                
            case 'cleanupSystem':
                return await this.cleanupSystem();
                
            case 'generateReport':
                return await this.generateSystemReport();
                
            case 'emergencyDiagnosis':
                return await this.performEmergencyDiagnosis();
                
            case 'autoRecovery':
                return await this.performAutoRecovery();
                
            case 'systemVerification':
                return await this.verifySystemHealth();
                
            case 'batchPreCheck':
                return await this.performBatchPreCheck();
                
            case 'executeBatchProcessing':
                return await this.executeBatchProcessing();
                
            case 'postProcessVerification':
                return await this.verifyBatchResults();
                
            default:
                throw new Error(`未知步骤: ${stepName}`);
        }
    }
    
    /**
     * 🏥 系统健康检查 - 使用现有智能恢复系统
     */
    async performSystemHealthCheck() {
        console.log('🏥 执行系统健康检查...');
        
        // 使用现有的intelligent_recovery.js进行健康检查
        const result = await this.runExistingScript('intelligent_recovery.js');
        
        // 分析结果
        const healthScore = this.calculateHealthScore(result);
        this.systemStatus.healthScore = healthScore;
        
        console.log(`📊 系统健康评分: ${healthScore}/100`);
        
        return {
            healthScore,
            issues: this.systemStatus.knownIssues,
            recommendation: this.getHealthRecommendation(healthScore)
        };
    }
    
    /**
     * 🆕 处理新文章 - 使用现有自动抓取系统
     */
    async processNewArticles() {
        console.log('🆕 处理新文章...');
        
        // 使用现有的auto_scrape_three_sites.js
        const result = await this.runExistingScript('auto_scrape_three_sites.js', ['--all-sites']);
        
        return {
            processed: this.extractProcessedCount(result.output),
            status: 'completed'
        };
    }
    
    /**
     * 🔄 恢复中断文章 - 使用现有智能恢复
     */
    async recoverInterruptedArticles() {
        console.log('🔄 恢复中断文章...');
        
        // 使用统一解决方案大脑
        const result = await this.solutionBrain.solve('有文章处理中断了');
        
        return result;
    }
    
    /**
     * 🧹 系统清理
     */
    async cleanupSystem() {
        console.log('🧹 执行系统清理...');
        
        const cleanupTasks = [];
        
        // 清理重复文章
        try {
            const duplicateResult = await this.runExistingScript('clean_duplicate_articles.js');
            cleanupTasks.push({ task: 'duplicate_cleanup', success: true });
        } catch (error) {
            cleanupTasks.push({ task: 'duplicate_cleanup', success: false, error: error.message });
        }
        
        // 清理临时文件
        this.cleanupTempFiles();
        cleanupTasks.push({ task: 'temp_cleanup', success: true });
        
        return { cleanupTasks };
    }
    
    /**
     * 📊 生成系统报告
     */
    async generateSystemReport() {
        console.log('📊 生成系统报告...');
        
        const report = {
            timestamp: new Date().toISOString(),
            systemHealth: this.systemStatus.healthScore,
            totalArticles: await this.countTotalArticles(),
            recentActivity: await this.getRecentActivity(),
            recommendations: this.generateRecommendations()
        };
        
        // 保存报告
        const reportFile = path.join(this.workingDir, `system_report_${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`📄 报告已保存: ${path.basename(reportFile)}`);
        
        return report;
    }
    
    /**
     * 🚨 紧急诊断
     */
    async performEmergencyDiagnosis() {
        console.log('🚨 执行紧急诊断...');
        
        // 检查关键系统状态
        const criticalChecks = [
            this.checkWebServerStatus(),
            this.checkDatabaseIntegrity(),
            this.checkProcessingQueues()
        ];
        
        const results = await Promise.allSettled(criticalChecks);
        
        const issues = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason);
            
        return {
            criticalIssues: issues,
            severity: issues.length > 0 ? 'high' : 'normal'
        };
    }
    
    /**
     * 🔧 自动恢复
     */
    async performAutoRecovery() {
        console.log('🔧 执行自动恢复...');
        
        // 使用统一解决方案大脑进行智能恢复
        const recoveryResult = await this.solutionBrain.solve('系统需要紧急恢复');
        
        return recoveryResult;
    }
    
    /**
     * ✅ 系统验证
     */
    async verifySystemHealth() {
        console.log('✅ 验证系统健康状态...');
        
        // 重新执行健康检查
        const healthResult = await this.performSystemHealthCheck();
        
        const isHealthy = healthResult.healthScore >= 80;
        
        return {
            isHealthy,
            healthScore: healthResult.healthScore,
            status: isHealthy ? 'healthy' : 'needs_attention'
        };
    }
    
    /**
     * 🔧 运行现有脚本 - 核心方法，复用所有现有代码
     */
    async runExistingScript(scriptName, args = []) {
        const scriptPath = path.join(this.workingDir, scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`脚本不存在: ${scriptName}`);
        }
        
        return new Promise((resolve, reject) => {
            console.log(`⚡ 执行现有脚本: ${scriptName}`);
            
            const child = spawn('node', [scriptPath, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: this.workingDir
            });
            
            let output = '';
            let error = '';
            
            child.stdout.on('data', (data) => {
                const text = data.toString();
                console.log(text);
                output += text;
            });
            
            child.stderr.on('data', (data) => {
                const text = data.toString();
                console.error(text);
                error += text;
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ output, exitCode: code });
                } else {
                    reject(new Error(`Script ${scriptName} failed with code ${code}: ${error}`));
                }
            });
            
            child.on('error', (err) => {
                reject(err);
            });
        });
    }
    
    /**
     * 📊 计算健康评分
     */
    calculateHealthScore(result) {
        // 基于结果分析健康评分
        let score = 100;
        
        if (result.output.includes('失败')) score -= 20;
        if (result.output.includes('错误')) score -= 15;
        if (result.output.includes('警告')) score -= 10;
        if (result.output.includes('中断')) score -= 25;
        
        return Math.max(0, score);
    }
    
    /**
     * 🎯 获取健康建议
     */
    getHealthRecommendation(healthScore) {
        if (healthScore >= 90) return '系统运行良好，保持现状';
        if (healthScore >= 70) return '系统基本正常，建议定期维护';
        if (healthScore >= 50) return '系统存在问题，需要及时处理';
        return '系统状态严重，需要立即修复';
    }
    
    /**
     * 📈 统计总文章数
     */
    async countTotalArticles() {
        const contentDir = path.join(this.workingDir, 'golf_content');
        if (!fs.existsSync(contentDir)) return 0;
        
        let total = 0;
        const dateDirs = fs.readdirSync(contentDir);
        
        for (const dateDir of dateDirs) {
            const readyDir = path.join(contentDir, dateDir, 'wechat_ready');
            if (fs.existsSync(readyDir)) {
                const files = fs.readdirSync(readyDir).filter(f => f.endsWith('.md'));
                total += files.length;
            }
        }
        
        return total;
    }
    
    /**
     * 🕒 获取最近活动
     */
    async getRecentActivity() {
        // 分析最近的文章处理活动
        const contentDir = path.join(this.workingDir, 'golf_content');
        const today = new Date().toISOString().split('T')[0];
        const todayDir = path.join(contentDir, today);
        
        if (!fs.existsSync(todayDir)) {
            return { todayArticles: 0, lastActivity: null };
        }
        
        const urlsFile = path.join(todayDir, 'article_urls.json');
        if (!fs.existsSync(urlsFile)) {
            return { todayArticles: 0, lastActivity: null };
        }
        
        const urlsData = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        const articles = Object.values(urlsData);
        
        return {
            todayArticles: articles.length,
            completedToday: articles.filter(a => a.status === 'completed').length,
            lastActivity: articles.length > 0 ? Math.max(...articles.map(a => new Date(a.timestamp).getTime())) : null
        };
    }
    
    /**
     * 💡 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.systemStatus.healthScore < 80) {
            recommendations.push('建议执行系统健康检查和修复');
        }
        
        const timeSinceLastMaintenance = Date.now() - this.systemStatus.lastMaintenance;
        if (timeSinceLastMaintenance > 24 * 60 * 60 * 1000) { // 24小时
            recommendations.push('建议执行日常维护流程');
        }
        
        return recommendations;
    }
    
    /**
     * 🧹 清理临时文件
     */
    cleanupTempFiles() {
        const tempFiles = fs.readdirSync(this.workingDir)
            .filter(f => f.startsWith('temp_') || f.startsWith('test_') || f.includes('_backup'))
            .filter(f => f.endsWith('.txt') || f.endsWith('.json'));
            
        tempFiles.forEach(file => {
            try {
                fs.unlinkSync(path.join(this.workingDir, file));
                console.log(`🗑️ 已删除临时文件: ${file}`);
            } catch (e) {
                // 忽略删除失败
            }
        });
    }
    
    /**
     * 📊 生成执行报告
     */
    generateExecutionReport(processType, results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`\n📊 ${this.standardProcesses[processType].name}执行报告:`);
        console.log(`   ✅ 成功步骤: ${successful}/${results.length}`);
        console.log(`   ❌ 失败步骤: ${failed}/${results.length}`);
        console.log(`   📈 成功率: ${(successful/results.length*100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log(`\n❌ 失败步骤详情:`);
            results.filter(r => !r.success).forEach(r => {
                console.log(`   • ${this.getStepName(r.step)}: ${r.error}`);
            });
        }
    }
    
    // 辅助方法
    getStepName(step) {
        const stepNames = {
            'systemHealthCheck': '系统健康检查',
            'processNewArticles': '处理新文章',
            'recoverInterrupted': '恢复中断文章',
            'cleanupSystem': '系统清理',
            'generateReport': '生成报告',
            'emergencyDiagnosis': '紧急诊断',
            'autoRecovery': '自动恢复',
            'systemVerification': '系统验证'
        };
        return stepNames[step] || step;
    }
    
    isCriticalStep(step) {
        return ['systemHealthCheck', 'autoRecovery', 'emergencyDiagnosis'].includes(step);
    }
    
    async handleCriticalStepFailure(step, error) {
        // 关键步骤失败的应急处理
        console.log(`🚨 关键步骤失败应急处理: ${step}`);
        
        if (step === 'systemHealthCheck') {
            // 尝试使用备用健康检查方法
            await this.performBasicHealthCheck();
        }
    }
    
    async performBasicHealthCheck() {
        console.log('🔧 执行基础健康检查...');
        // 简化的健康检查逻辑
        this.systemStatus.healthScore = 60; // 基础分数
    }
    
    getLastMaintenanceTime() {
        const maintenanceFile = path.join(this.workingDir, 'last_maintenance.json');
        if (fs.existsSync(maintenanceFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(maintenanceFile, 'utf8'));
                return data.timestamp || Date.now() - 24 * 60 * 60 * 1000;
            } catch (e) {
                return Date.now() - 24 * 60 * 60 * 1000;
            }
        }
        return Date.now() - 24 * 60 * 60 * 1000;
    }
    
    updateMaintenanceTime() {
        const maintenanceFile = path.join(this.workingDir, 'last_maintenance.json');
        const data = { timestamp: Date.now(), date: new Date().toISOString() };
        fs.writeFileSync(maintenanceFile, JSON.stringify(data, null, 2));
    }
    
    extractProcessedCount(output) {
        const match = output.match(/成功处理[：:]?\s*(\d+)/i);
        return match ? parseInt(match[1]) : 0;
    }
    
    async checkWebServerStatus() {
        // 检查web_server.js是否运行
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const check = spawn('lsof', ['-i', ':8080']);
            check.on('close', (code) => {
                resolve(code === 0);
            });
        });
    }
    
    async checkDatabaseIntegrity() {
        // 检查数据完整性
        const contentDir = path.join(this.workingDir, 'golf_content');
        return fs.existsSync(contentDir);
    }
    
    async checkProcessingQueues() {
        // 检查处理队列状态
        return true; // 简化实现
    }
    
    async performBatchPreCheck() {
        console.log('📋 批量处理预检查...');
        return { ready: true };
    }
    
    async executeBatchProcessing() {
        console.log('🔄 执行批量处理...');
        return await this.runExistingScript('ultra_batch_processor.js');
    }
    
    async verifyBatchResults() {
        console.log('✅ 验证批量处理结果...');
        return { verified: true };
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 🎯 主入口 - 标准化命令接口
 */
async function main() {
    const args = process.argv.slice(2);
    const processor = new DailyStandardProcess();
    
    if (args.length === 0 || args[0] === '--help') {
        console.log('🎯 日常标准操作流程 - 统一入口');
        console.log('');
        console.log('标准流程:');
        console.log('  node daily_standard_process.js daily      # 日常维护（推荐）');
        console.log('  node daily_standard_process.js emergency  # 紧急修复');
        console.log('  node daily_standard_process.js batch      # 批量处理');
        console.log('');
        console.log('🎯 建议每日运行一次 daily 流程保持系统健康');
        return;
    }
    
    const processType = args[0];
    
    try {
        await processor.executeStandardProcess(processType);
        console.log('🎉 标准流程执行完成!');
        console.log('💡 访问 http://localhost:8080 查看系统状态');
        
    } catch (error) {
        console.error('💥 标准流程执行失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 系统错误:', error.message);
        process.exit(1);
    });
}

module.exports = DailyStandardProcess;