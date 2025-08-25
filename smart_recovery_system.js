#!/usr/bin/env node

/**
 * 🧠 智能恢复系统 - 基于现有adaptive_access_strategy.js的状态管理
 * 
 * 设计理念：
 * 1. 100%基于现有代码，不重复造轮子
 * 2. 利用已有的AdaptiveAccessStrategy智能诊断能力
 * 3. 自动检测和恢复article_urls.json中的中断状态
 * 4. 集成Ultra处理器和批处理系统
 * 
 * 核心功能：
 * - 智能状态检测：processing/retrying状态的文章
 * - 自动恢复处理：使用最适合的处理器
 * - 持续监控：确保所有文章最终处理完成
 * - 历史学习：记录成功恢复的策略
 */

const fs = require('fs');
const path = require('path');
const AdaptiveAccessStrategy = require('./adaptive_access_strategy');
const BatchArticleProcessor = require('./batch_process_articles');

class SmartRecoverySystem {
    constructor(options = {}) {
        this.config = {
            checkInterval: 300000,  // 5分钟检查一次
            maxRetryAttempts: 3,
            stateFile: path.join(process.cwd(), 'recovery_state.json'),
            ...options
        };
        
        // 使用现有的智能策略
        this.adaptiveStrategy = new AdaptiveAccessStrategy();
        
        // 系统状态
        this.recoveryState = {
            lastCheck: 0,
            recoveredArticles: new Set(),
            failedRecovery: new Map(),
            totalRecovered: 0
        };
        
        this.initialize();
    }
    
    /**
     * 🚀 系统初始化
     */
    initialize() {
        console.log('🧠 智能恢复系统启动...');
        console.log('📋 基于现有AdaptiveAccessStrategy架构');
        
        // 显示智能系统状态
        this.displaySystemIntelligence();
        
        // 加载历史状态
        this.loadRecoveryState();
        
        // 立即执行一次检查
        this.performRecoveryCheck();
        
        // 启动定期检查
        this.startPeriodicChecks();
        
        console.log('✅ 智能恢复系统就绪');
    }
    
    /**
     * 🎯 显示系统智能状态
     */
    displaySystemIntelligence() {
        const resourceCount = this.adaptiveStrategy.systemResources.size;
        const problemPatternCount = this.adaptiveStrategy.problemPatterns.size;
        
        console.log(`🧠 系统智能层状态: 📊 可用资源: ${resourceCount} 个, 🔍 已知问题类型: ${problemPatternCount} 种`);
        
        // 显示可用资源
        if (resourceCount > 0) {
            console.log('📦 已发现的处理资源:');
            for (const [resource, info] of this.adaptiveStrategy.systemResources.entries()) {
                console.log(`   ✅ ${resource}: ${info.capabilities.join(', ')}`);
            }
        }
    }
    
    /**
     * 🔍 执行恢复检查
     */
    async performRecoveryCheck() {
        console.log('🔍 开始智能恢复检查...');
        
        try {
            // 扫描所有article_urls.json文件
            const interruptedArticles = await this.scanInterruptedArticles();
            
            if (interruptedArticles.length === 0) {
                console.log('✅ 未发现需要恢复的文章');
                return;
            }
            
            console.log(`🔄 发现 ${interruptedArticles.length} 篇需要恢复的文章`);
            
            // 智能恢复处理
            await this.intelligentRecovery(interruptedArticles);
            
        } catch (error) {
            console.error('❌ 恢复检查失败:', error.message);
        }
        
        this.recoveryState.lastCheck = Date.now();
        this.saveRecoveryState();
    }
    
    /**
     * 📋 扫描中断的文章
     */
    async scanInterruptedArticles() {
        const interrupted = [];
        const contentDir = path.join(process.cwd(), 'golf_content');
        
        if (!fs.existsSync(contentDir)) {
            console.log('📁 未找到golf_content目录');
            return interrupted;
        }\n        \n        // 获取所有日期目录\n        const dateDirs = fs.readdirSync(contentDir)\n            .filter(dir => /^\\d{4}-\\d{2}-\\d{2}$/.test(dir))\n            .sort().reverse(); // 最新的日期优先\n        \n        console.log(`📅 检查 ${dateDirs.length} 个日期目录...`);\n        \n        for (const dateDir of dateDirs) {\n            const urlsFile = path.join(contentDir, dateDir, 'article_urls.json');\n            \n            if (!fs.existsSync(urlsFile)) continue;\n            \n            try {\n                const urlsData = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));\n                \n                Object.entries(urlsData).forEach(([articleId, info]) => {\n                    // 查找处理中或重试状态的文章\n                    if (info.status === 'processing' || info.status === 'retrying') {\n                        // 检查时间，超过30分钟认为是中断\n                        const timeSinceStart = Date.now() - new Date(info.timestamp).getTime();\n                        \n                        if (timeSinceStart > 1800000) { // 30分钟\n                            interrupted.push({\n                                id: articleId,\n                                url: info.url,\n                                status: info.status,\n                                date: dateDir,\n                                urlsFile: urlsFile,\n                                timeSinceStart: timeSinceStart,\n                                previousError: info.previousError || info.error\n                            });\n                        }\n                    }\n                });\n                \n            } catch (e) {\n                console.warn(`⚠️ 无法读取 ${urlsFile}: ${e.message}`);\n            }\n        }\n        \n        return interrupted;\n    }\n    \n    /**\n     * 🧠 智能恢复处理\n     */\n    async intelligentRecovery(interruptedArticles) {\n        console.log(`🧠 开始智能恢复 ${interruptedArticles.length} 篇文章...`);\n        \n        for (const article of interruptedArticles) {\n            // 跳过已经尝试恢复失败的文章\n            if (this.recoveryState.failedRecovery.has(article.url)) {\n                const attempts = this.recoveryState.failedRecovery.get(article.url);\n                if (attempts >= this.config.maxRetryAttempts) {\n                    console.log(`⏭️ 跳过已达最大重试次数的文章: ${article.id}`);\n                    continue;\n                }\n            }\n            \n            console.log(`\\n🔧 恢复文章 ${article.id}: ${article.url.substring(0, 80)}...`);\n            console.log(`   📊 状态: ${article.status}, 中断时长: ${Math.round(article.timeSinceStart/60000)}分钟`);\n            \n            try {\n                // 使用智能诊断系统分析问题\n                const diagnosis = this.adaptiveStrategy.diagnoseAndResolve(\n                    article.previousError || 'Processing interrupted',\n                    new URL(article.url).hostname,\n                    {\n                        articleId: article.id,\n                        status: article.status,\n                        interruptionTime: article.timeSinceStart\n                    }\n                );\n                \n                if (diagnosis.success) {\n                    console.log(`🎯 智能诊断结果: ${diagnosis.problemType}`);\n                    console.log(`🔧 推荐策略: ${diagnosis.strategy}`);\n                    \n                    // 执行恢复\n                    const recoverySuccess = await this.executeRecovery(article, diagnosis);\n                    \n                    if (recoverySuccess) {\n                        console.log(`✅ 文章 ${article.id} 恢复成功`);\n                        this.recoveryState.recoveredArticles.add(article.url);\n                        this.recoveryState.totalRecovered++;\n                        \n                        // 记录成功策略到历史\n                        this.adaptiveStrategy.recordSolution(\n                            diagnosis.problemType,\n                            new URL(article.url).hostname,\n                            diagnosis.solution,\n                            true\n                        );\n                    } else {\n                        throw new Error('Recovery execution failed');\n                    }\n                } else {\n                    console.log(`❌ 智能诊断无法识别问题: ${diagnosis.reason}`);\n                    // 使用默认恢复策略\n                    await this.executeDefaultRecovery(article);\n                }\n                \n                // 每篇文章处理后短暂休息\n                await this.sleep(5000);\n                \n            } catch (error) {\n                console.error(`❌ 文章 ${article.id} 恢复失败: ${error.message}`);\n                \n                // 记录失败次数\n                const currentAttempts = this.recoveryState.failedRecovery.get(article.url) || 0;\n                this.recoveryState.failedRecovery.set(article.url, currentAttempts + 1);\n                \n                // 更新文章状态为失败\n                this.updateArticleStatus(article, 'failed', error.message);\n            }\n        }\n        \n        console.log(`\\n🎉 智能恢复完成: 成功恢复 ${this.recoveryState.totalRecovered} 篇文章`);\n    }\n    \n    /**\n     * 🔧 执行恢复操作\n     */\n    async executeRecovery(article, diagnosis) {\n        console.log(`🔧 执行恢复: 使用策略 ${diagnosis.strategy}`);\n        \n        // 更新文章状态为恢复中\n        this.updateArticleStatus(article, 'recovering', 'Smart recovery in progress');\n        \n        try {\n            // 使用批处理系统重新处理\n            const processor = new BatchArticleProcessor();\n            await processor.processArticles([article.url]);\n            \n            return true;\n            \n        } catch (error) {\n            console.error(`恢复执行失败: ${error.message}`);\n            return false;\n        }\n    }\n    \n    /**\n     * 🔧 执行默认恢复策略\n     */\n    async executeDefaultRecovery(article) {\n        console.log(`🔧 使用默认恢复策略处理文章 ${article.id}`);\n        \n        try {\n            const processor = new BatchArticleProcessor();\n            await processor.processArticles([article.url]);\n            \n            console.log(`✅ 默认恢复成功: ${article.id}`);\n            this.recoveryState.totalRecovered++;\n            \n        } catch (error) {\n            throw error;\n        }\n    }\n    \n    /**\n     * 📝 更新文章状态\n     */\n    updateArticleStatus(article, newStatus, message = '') {\n        try {\n            const urlsData = JSON.parse(fs.readFileSync(article.urlsFile, 'utf8'));\n            \n            if (urlsData[article.id]) {\n                urlsData[article.id].status = newStatus;\n                urlsData[article.id].recoveryTimestamp = new Date().toISOString();\n                if (message) {\n                    urlsData[article.id].recoveryMessage = message;\n                }\n                \n                fs.writeFileSync(article.urlsFile, JSON.stringify(urlsData, null, 2));\n                console.log(`📝 已更新文章 ${article.id} 状态为: ${newStatus}`);\n            }\n            \n        } catch (error) {\n            console.error(`❌ 状态更新失败: ${error.message}`);\n        }\n    }\n    \n    /**\n     * 🔄 启动定期检查\n     */\n    startPeriodicChecks() {\n        console.log(`🔄 启动定期检查 (间隔: ${this.config.checkInterval/60000}分钟)`);\n        \n        setInterval(() => {\n            console.log(`\\n⏰ [${new Date().toLocaleTimeString()}] 定期恢复检查...`);\n            this.performRecoveryCheck();\n        }, this.config.checkInterval);\n    }\n    \n    /**\n     * 💾 保存恢复状态\n     */\n    saveRecoveryState() {\n        const state = {\n            lastCheck: this.recoveryState.lastCheck,\n            recoveredArticles: Array.from(this.recoveryState.recoveredArticles),\n            failedRecovery: Object.fromEntries(this.recoveryState.failedRecovery),\n            totalRecovered: this.recoveryState.totalRecovered,\n            timestamp: Date.now()\n        };\n        \n        try {\n            fs.writeFileSync(this.config.stateFile, JSON.stringify(state, null, 2));\n        } catch (error) {\n            console.error('❌ 恢复状态保存失败:', error.message);\n        }\n    }\n    \n    /**\n     * 📂 加载恢复状态\n     */\n    loadRecoveryState() {\n        try {\n            if (fs.existsSync(this.config.stateFile)) {\n                const state = JSON.parse(fs.readFileSync(this.config.stateFile, 'utf8'));\n                \n                this.recoveryState.lastCheck = state.lastCheck || 0;\n                this.recoveryState.recoveredArticles = new Set(state.recoveredArticles || []);\n                this.recoveryState.failedRecovery = new Map(Object.entries(state.failedRecovery || {}));\n                this.recoveryState.totalRecovered = state.totalRecovered || 0;\n                \n                console.log(`📂 恢复历史状态: 已恢复 ${this.recoveryState.totalRecovered} 篇文章`);\n            }\n        } catch (error) {\n            console.error('❌ 恢复状态加载失败:', error.message);\n        }\n    }\n    \n    /**\n     * 😴 休眠函数\n     */\n    sleep(ms) {\n        return new Promise(resolve => setTimeout(resolve, ms));\n    }\n}\n\n/**\n * 🎯 主入口 - 启动智能恢复系统\n */\nasync function startSmartRecovery(options = {}) {\n    console.log('🎯 启动智能恢复系统...');\n    console.log('📋 基于AdaptiveAccessStrategy智能诊断架构');\n    \n    const recovery = new SmartRecoverySystem(options);\n    \n    // 系统将持续运行\n    console.log('\\n✅ 智能恢复系统正在运行...');\n    console.log('💡 系统将自动检测和恢复中断的文章处理');\n    console.log('📊 查看 recovery_state.json 了解恢复进度');\n    \n    // 注册优雅退出\n    process.on('SIGINT', () => {\n        console.log('\\n🛑 智能恢复系统正在退出...');\n        recovery.saveRecoveryState();\n        console.log('👋 退出完成');\n        process.exit(0);\n    });\n}\n\n// 直接运行\nif (require.main === module) {\n    startSmartRecovery({\n        checkInterval: 300000,  // 5分钟检查一次\n        maxRetryAttempts: 3\n    }).catch(error => {\n        console.error('💥 智能恢复系统启动失败:', error);\n        process.exit(1);\n    });\n}\n\nmodule.exports = { SmartRecoverySystem, startSmartRecovery };