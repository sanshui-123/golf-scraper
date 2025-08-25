#!/usr/bin/env node

/**
 * 🧠 统一解决方案大脑 - 回答您的核心问题
 * 
 * 问题：为什么我们有解决方案，但总是遇到旧问题？
 * 答案：缺乏统一的"问题识别 -> 解决方案路由"系统
 * 
 * 解决方案：创建智能路由器，自动识别问题类型并调用正确的脚本
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class UnifiedSolutionBrain {
    constructor() {
        // 🎯 核心问题模式库
        this.problemSolutions = new Map([
            // 文章处理中断问题
            ['processing_interrupted', {
                keywords: ['processing', 'retrying', 'interrupted', 'timeout', '中断'],
                solutions: ['intelligent_recovery.js'],
                description: '文章处理中断或状态异常'
            }],
            
            // MyGolfSpy 403错误
            ['mygolfspy_403', {
                keywords: ['403', 'forbidden', 'mygolfspy'],
                solutions: ['process_mygolfspy_rss.js'],
                description: 'MyGolfSpy网站403访问被拒绝'
            }],
            
            // 批量处理需求
            ['batch_processing', {
                keywords: ['batch', 'multiple', 'all sites', '批量', '所有网站'],
                solutions: ['auto_scrape_three_sites.js', 'ultra_batch_processor.js'],
                description: '批量处理多个网站文章'
            }],
            
            // 重复内容问题
            ['duplicate_content', {
                keywords: ['duplicate', 'repeated', '重复'],
                solutions: ['clean_duplicate_articles.js'],
                description: '重复内容清理'
            }],
            
            // HTTP 404错误
            ['http_404', {
                keywords: ['404', 'not found', '不存在'],
                solutions: ['enhanced_deep_scraper.js'],
                description: 'HTTP 404错误处理'
            }]
        ]);
        
        console.log(`🧠 统一解决方案大脑就绪 - 已注册 ${this.problemSolutions.size} 种问题解决方案`);
    }
    
    /**
     * 🎯 智能问题诊断和解决
     */
    async solve(problemDescription) {
        console.log(`🎯 分析问题: ${problemDescription}`);
        
        // 1. 问题模式匹配
        const matchedSolution = this.identifyProblemType(problemDescription);
        
        if (!matchedSolution) {
            console.log('❌ 未识别出问题类型，使用默认解决方案');
            return this.executeDefaultSolution();
        }
        
        console.log(`✅ 识别为: ${matchedSolution.description}`);
        
        // 2. 执行最佳解决方案
        const solutionScript = matchedSolution.solutions[0];
        console.log(`🔧 执行解决方案: ${solutionScript}`);
        
        return await this.executeScript(solutionScript);
    }
    
    /**
     * 🔍 识别问题类型
     */
    identifyProblemType(description) {
        const lowerDesc = description.toLowerCase();
        
        for (const [type, config] of this.problemSolutions.entries()) {
            for (const keyword of config.keywords) {
                if (lowerDesc.includes(keyword.toLowerCase())) {
                    return config;
                }
            }
        }
        
        return null;
    }
    
    /**
     * ⚡ 执行脚本
     */
    async executeScript(scriptName) {
        const scriptPath = path.join(process.cwd(), scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            console.error(`❌ 解决方案脚本不存在: ${scriptName}`);
            return { success: false, reason: 'script_not_found' };
        }
        
        try {
            console.log(`⚡ 正在执行: ${scriptName}`);
            
            const result = await this.runScript(scriptPath);
            
            console.log('✅ 解决方案执行完成');
            return { success: true, result: result };
            
        } catch (error) {
            console.error(`❌ 执行失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 🔧 运行脚本
     */
    async runScript(scriptPath) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath], {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ exitCode: code });
                } else {
                    reject(new Error(`Script exited with code ${code}`));
                }
            });
            
            child.on('error', (err) => {
                reject(err);
            });
        });
    }
    
    /**
     * 🔧 默认解决方案
     */
    async executeDefaultSolution() {
        console.log('🔧 执行默认解决方案: intelligent_recovery.js');
        return await this.executeScript('intelligent_recovery.js');
    }
    
    /**
     * 📊 显示可用解决方案
     */
    showAvailableSolutions() {
        console.log('📊 可用解决方案:');
        for (const [type, config] of this.problemSolutions.entries()) {
            console.log(`  🎯 ${config.description}`);
            console.log(`     关键词: ${config.keywords.join(', ')}`);
            console.log(`     解决方案: ${config.solutions.join(', ')}`);
            console.log('');
        }
    }
}

// 主入口
async function main() {
    const args = process.argv.slice(2);
    const brain = new UnifiedSolutionBrain();
    
    if (args.length === 0 || args[0] === '--help') {
        console.log('🧠 统一解决方案大脑 - 自动识别问题并调用正确解决方案');
        console.log('');
        console.log('用法:');
        console.log('  node unified_solution_brain.js "问题描述"');
        console.log('  node unified_solution_brain.js --list');
        console.log('');
        console.log('示例:');
        console.log('  node unified_solution_brain.js "有文章处理中断了"');
        console.log('  node unified_solution_brain.js "MyGolfSpy返回403错误"');
        console.log('  node unified_solution_brain.js "需要批量处理所有网站"');
        return;
    }
    
    if (args[0] === '--list') {
        brain.showAvailableSolutions();
        return;
    }
    
    const problemDescription = args.join(' ');
    const result = await brain.solve(problemDescription);
    
    if (result.success) {
        console.log('🎉 问题解决完成!');
    } else {
        console.log(`❌ 问题解决失败: ${result.error || result.reason}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 系统错误:', error.message);
        process.exit(1);
    });
}

module.exports = UnifiedSolutionBrain;