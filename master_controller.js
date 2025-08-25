#!/usr/bin/env node

/**
 * 主控制器 - 新一代架构统一入口
 * 
 * 解决用户提出的所有系统架构问题:
 * ✅ 进程中断恢复
 * ✅ 状态持久化
 * ✅ 重复处理避免  
 * ✅ 队列管理
 * ✅ 与现有组件完全兼容
 * 
 * @author Claude Code Assistant
 * @version 2.0 Master Controller
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 引入新架构组件
const SystemCoordinator = require('./system_coordinator');
const ArticleQueueManager = require('./article_queue_manager');
const { createStateStore, enhanceExistingFile } = require('./atomic_state_store');
const IntelligentRecoveryEngine = require('./intelligent_recovery_engine');

class MasterController {
    constructor() {
        this.version = '2.0';
        this.components = {
            coordinator: null,
            queueManager: null,
            recoveryEngine: null,
            stateStores: new Map()
        };
        
        // 简化commands定义
        this.commands = [
            'run-all-sites', 'continue-processing', 'start-web-server',
            'smart-recover', 'diagnose', 'queue-status', 
            'enhance-system', 'emergency-recover'
        ];
        
        console.log('🎛️ 主控制器 v2.0 初始化完成');
    }
    
    /**
     * 运行完整的所有网站处理流程（增强版）
     */
    async runAllSites() {
        console.log('🚀 启动增强版全站处理流程...');
        
        try {
            // 1. 首先检查系统状态
            await this.diagnose(false);
            
            // 2. 初始化协调器
            if (!this.components.coordinator) {
                this.components.coordinator = new SystemCoordinator();
            }
            
            // 3. 创建处理会话
            const sessionId = this.components.coordinator.startSession('enhanced_all_sites');
            
            // 4. 添加URL发现步骤
            console.log('📋 配置URL发现任务...');
            this.components.coordinator.addStep('discover_golf', 'url_discovery', 'golf.com');
            this.components.coordinator.addStep('discover_golfmonthly', 'url_discovery', 'golfmonthly.com');
            this.components.coordinator.addStep('discover_mygolfspy', 'url_discovery', 'mygolfspy.com');
            this.components.coordinator.addStep('discover_golfwrx', 'url_discovery', 'golfwrx.com');
            this.components.coordinator.addStep('discover_golfdigest', 'url_discovery', 'golfdigest.com');
            
            // 5. 添加处理步骤
            this.components.coordinator.addStep('queue_process', 'article_processing', 'batch_process', ['enhanced']);
            
            console.log(`✅ 增强版处理流程已配置 (会话: ${sessionId})`);
            console.log('💡 执行 "node master_controller.js continue-processing" 开始处理');
            
        } catch (error) {
            console.error('❌ 配置处理流程失败:', error);
            throw error;
        }
    }
    
    /**
     * 继续处理（智能恢复版）
     */
    async continueProcessing() {
        console.log('▶️ 启动智能继续处理...');
        
        try {
            // 1. 智能恢复检查
            if (!this.components.recoveryEngine) {
                this.components.recoveryEngine = new IntelligentRecoveryEngine();
            }
            
            const diagnosis = await this.components.recoveryEngine.diagnoseSystem();
            
            if (diagnosis.severity === 'critical') {
                console.log('🚨 检测到严重问题，执行自动恢复...');
                await this.components.recoveryEngine.autoRecover(diagnosis);
            }
            
            // 2. 初始化队列管理器
            if (!this.components.queueManager) {
                this.components.queueManager = new ArticleQueueManager();
            }
            
            // 3. 恢复中断的队列
            await this.components.queueManager.recoverInterrupted();
            
            // 4. 处理队列
            await this.components.queueManager.processAllQueues(10);
            
            // 5. 使用协调器继续执行步骤
            if (!this.components.coordinator) {
                this.components.coordinator = new SystemCoordinator();
            }
            
            await this.components.coordinator.continueExecution();
            
            console.log('🎉 智能处理完成！');
            
        } catch (error) {
            console.error('❌ 智能处理失败:', error);
            console.log('🔧 尝试应急恢复...');
            await this.emergencyRecover();
        }
    }
    
    /**
     * 启动Web服务器（增强版）
     */
    async startWebServer() {
        console.log('🌐 启动增强版Web服务器...');
        
        try {
            // 检查端口占用
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            try {
                await execAsync('lsof -ti:8080 | xargs kill -9 2>/dev/null');
                console.log('🔄 清理端口8080');
            } catch (e) {
                // 端口未被占用，正常
            }
            
            // 启动服务器
            const webServer = spawn('node', ['web_server.js'], {
                detached: true,
                stdio: 'inherit'
            });
            
            console.log(`✅ Web服务器已启动 (PID: ${webServer.pid})`);
            console.log('🌐 访问地址: http://localhost:8080');
            
        } catch (error) {
            console.error('❌ 启动Web服务器失败:', error);
        }
    }
    
    /**
     * 智能恢复
     */
    async smartRecover() {
        console.log('🧠 启动智能恢复系统...');
        
        if (!this.components.recoveryEngine) {
            this.components.recoveryEngine = new IntelligentRecoveryEngine();
        }
        
        const postDiagnosis = await this.components.recoveryEngine.autoRecover();
        this.components.recoveryEngine.generateReport(postDiagnosis);
    }
    
    /**
     * 系统诊断
     */
    async diagnose(showReport = true) {
        console.log('🔍 执行系统诊断...');
        
        if (!this.components.recoveryEngine) {
            this.components.recoveryEngine = new IntelligentRecoveryEngine();
        }
        
        const diagnosis = await this.components.recoveryEngine.diagnoseSystem();
        
        if (showReport) {
            this.components.recoveryEngine.generateReport(diagnosis);
        }
        
        return diagnosis;
    }
    
    /**
     * 队列状态
     */
    async queueStatus() {
        console.log('📊 查询队列状态...');
        
        if (!this.components.queueManager) {
            this.components.queueManager = new ArticleQueueManager();
        }
        
        const status = this.components.queueManager.getStatus();
        this.components.queueManager.printStatistics();
        
        return status;
    }
    
    /**
     * 增强现有系统
     */
    async enhanceSystem() {
        console.log('⬆️ 增强现有系统...');
        
        const criticalFiles = [
            './golf_content/2025-08-01/article_urls.json',
            './enhanced_scraper_state.json'
        ];
        
        for (const filePath of criticalFiles) {
            if (fs.existsSync(filePath)) {
                console.log(`🔧 增强文件: ${filePath}`);
                try {
                    const store = await enhanceExistingFile(filePath, {
                        backupCount: 10,
                        checksumVerification: true
                    });
                    this.components.stateStores.set(filePath, store);
                } catch (error) {
                    console.error(`❌ 增强失败: ${filePath}`, error.message);
                }
            }
        }
        
        console.log('✅ 系统增强完成');
    }
    
    /**
     * 应急恢复
     */
    async emergencyRecover() {
        console.log('🚨 启动应急恢复模式...');
        
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            // 1. 强制终止所有相关进程
            console.log('🛑 终止所有相关进程...');
            const processNames = ['auto_scrape', 'batch_process', 'discover_'];
            
            for (const processName of processNames) {
                try {
                    await execAsync(`pkill -f ${processName}`);
                    console.log(`✅ 已终止: ${processName}`);
                } catch (e) {
                    // 进程可能不存在
                }
            }
            
            // 2. 重启Web服务器
            console.log('🌐 重启Web服务器...');
            await this.startWebServer();
            
            // 3. 恢复队列状态
            console.log('📊 恢复队列状态...');
            if (!this.components.queueManager) {
                this.components.queueManager = new ArticleQueueManager();
            }
            await this.components.queueManager.recoverInterrupted();
            
            console.log('✅ 应急恢复完成');
            
        } catch (error) {
            console.error('❌ 应急恢复失败:', error);
        }
    }
    
    /**
     * 显示系统状态仪表板
     */
    async showDashboard() {
        console.log('\\n' + '='.repeat(80));
        console.log('🎛️ 新一代高尔夫内容处理系统 v2.0 - 控制台');
        console.log('='.repeat(80));
        
        // 快速诊断
        const diagnosis = await this.diagnose(false);
        const queueStatus = await this.queueStatus();
        
        console.log(`📊 系统状态: ${diagnosis.severity.toUpperCase()}`);
        console.log(`🔍 发现问题: ${diagnosis.issues.length} 个`);
        console.log(`📈 待处理URL: ${queueStatus.pendingUrls}`);
        console.log(`✅ 已处理文章: ${queueStatus.processedUrls}`);
        console.log(`⚡ 处理批次: ${queueStatus.processingBatches}`);
        
        console.log('\\n🚀 快速操作:');
        console.log('  node master_controller.js run-all-sites      # 启动完整处理流程');
        console.log('  node master_controller.js continue-processing # 智能继续处理'); 
        console.log('  node master_controller.js smart-recover      # 智能恢复系统');
        console.log('  node master_controller.js emergency-recover  # 应急恢复');
        
        console.log('\\n' + '='.repeat(80));
    }
    
    /**
     * 执行命令
     */
    async executeCommand(commandName, ...args) {
        switch (commandName) {
            case 'run-all-sites':
                return await this.runAllSites(...args);
            case 'continue-processing':
                return await this.continueProcessing(...args);
            case 'start-web-server':
                return await this.startWebServer(...args);
            case 'smart-recover':
                return await this.smartRecover(...args);
            case 'diagnose':
                return await this.diagnose(...args);
            case 'queue-status':
                return await this.queueStatus(...args);
            case 'enhance-system':
                return await this.enhanceSystem(...args);
            case 'emergency-recover':
                return await this.emergencyRecover(...args);
            default:
                throw new Error(`未知命令: ${commandName}`);
        }
    }
}

// CLI接口
if (require.main === module) {
    const controller = new MasterController();
    const args = process.argv.slice(2);
    
    async function main() {
        try {
            if (args.length === 0) {
                // 显示仪表板
                await controller.showDashboard();
                return;
            }
            
            const commandName = args[0];
            const commandArgs = args.slice(1);
            
            // 执行命令
            await controller.executeCommand(commandName, ...commandArgs);
            
        } catch (error) {
            console.error('❌ 命令执行失败:', error.message);
            
            console.log('\\n💡 可用命令:');
            controller.commands.forEach(cmd => {
                console.log(`  - ${cmd}`);
            });
            
            process.exit(1);
        }
    }
    
    // 优雅关闭处理
    process.on('SIGINT', () => {
        console.log('\\n🛑 主控制器关闭中...');
        process.exit(0);
    });
    
    main();
}

module.exports = MasterController;