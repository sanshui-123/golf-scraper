#!/usr/bin/env node

/**
 * 🎯 系统编排器 - 基于现有代码的统一管理层
 * 
 * 核心理念：
 * 1. 统一状态管理 - 整合article_urls.json + 进程状态
 * 2. 自动恢复机制 - 系统中断后自动续传
 * 3. 资源生命周期管理 - 浏览器实例、临时文件等
 * 4. 智能任务调度 - 基于系统负载和状态
 * 
 * 设计原则：
 * - 100%基于现有代码，不重复造轮子
 * - 只做编排，不替代现有组件
 * - 框架级思维，长期稳定运行
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// 导入现有组件
const UltraBatchProcessor = require('./ultra_batch_processor');
const BatchArticleProcessor = require('./batch_process_articles');

/**
 * 🎭 系统编排器 - 统一管理所有组件
 */
class SystemOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            // 状态管理
            stateFile: path.join(process.cwd(), 'system_state.json'),
            backupInterval: 30000,  // 30秒备份一次
            
            // 进程管理
            maxProcessLifetime: 7200000,  // 2小时最大生命周期
            healthCheckInterval: 60000,   // 1分钟健康检查
            
            // 任务调度
            taskPriority: {
                'resume_interrupted': 1,    // 最高优先级
                'process_new': 2,
                'maintenance': 3
            },
            
            ...options
        };
        
        // 系统状态
        this.systemState = {
            activeProcesses: new Map(),      // 活跃进程
            taskQueue: [],                   // 任务队列
            resources: new Map(),            // 系统资源
            lastHealthCheck: Date.now(),
            systemStartTime: Date.now()
        };
        
        this.initialize();
    }
    
    /**
     * 🚀 系统初始化
     */
    initialize() {
        console.log('🎭 系统编排器启动...');
        
        // 1. 恢复系统状态
        this.loadSystemState();
        
        // 2. 检查中断的任务
        this.detectInterruptedTasks();
        
        // 3. 启动监控
        this.startSystemMonitoring();
        
        // 4. 注册优雅退出
        this.registerGracefulShutdown();
        
        console.log('✅ 系统编排器就绪');
    }
    
    /**
     * 🔍 检测中断的任务 - 核心功能
     */
    async detectInterruptedTasks() {
        console.log('🔍 检测系统中断任务...');
        
        try {
            // 检查article_urls.json中的中断状态
            const interrupted = await this.findInterruptedArticles();
            
            if (interrupted.length > 0) {
                console.log(`🔄 发现 ${interrupted.length} 篇中断文章，自动恢复处理...`);
                
                // 创建恢复任务
                this.createResumeTask(interrupted);
                
                // 立即执行恢复
                await this.executeNextTask();
            } else {
                console.log('✅ 未发现中断任务');
                
                // 检查是否有新任务
                await this.checkForNewTasks();
            }
            
        } catch (error) {
            console.error('❌ 中断检测失败:', error.message);
        }
    }
    
    /**
     * 📋 查找中断的文章
     */
    async findInterruptedArticles() {
        const interrupted = [];
        
        // 遍历所有日期目录
        const contentDir = path.join(process.cwd(), 'golf_content');
        if (!fs.existsSync(contentDir)) return interrupted;
        
        const dateDirs = fs.readdirSync(contentDir)
            .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
        
        for (const dateDir of dateDirs) {
            const urlsFile = path.join(contentDir, dateDir, 'article_urls.json');
            if (!fs.existsSync(urlsFile)) continue;
            
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                
                // 查找processing或retrying状态的文章
                Object.entries(urls).forEach(([id, info]) => {
                    if (info.status === 'processing' || info.status === 'retrying') {
                        interrupted.push({
                            id,
                            url: info.url,
                            date: dateDir,
                            status: info.status,
                            timestamp: info.timestamp
                        });
                    }
                });
                
            } catch (e) {
                console.warn(`⚠️ 无法读取 ${urlsFile}:`, e.message);
            }
        }
        
        return interrupted;
    }
    
    /**
     * 🎯 创建恢复任务
     */
    createResumeTask(interruptedArticles) {
        const task = {
            id: `resume_${Date.now()}`,
            type: 'resume_interrupted',
            priority: this.config.taskPriority.resume_interrupted,
            data: {
                articles: interruptedArticles,
                method: 'ultra_processor'  // 使用Ultra处理器
            },
            createdAt: Date.now(),
            attempts: 0
        };
        
        // 插入到队列头部（最高优先级）
        this.systemState.taskQueue.unshift(task);
        this.saveSystemState();
        
        console.log(`📋 已创建恢复任务: ${task.id}`);
    }
    
    /**
     * ⚡ 执行下一个任务
     */
    async executeNextTask() {
        if (this.systemState.taskQueue.length === 0) {
            console.log('📝 任务队列为空');
            return;
        }
        
        // 按优先级排序
        this.systemState.taskQueue.sort((a, b) => a.priority - b.priority);
        
        const task = this.systemState.taskQueue.shift();
        console.log(`⚡ 执行任务: ${task.id} (${task.type})`);
        
        try {
            await this.executeTask(task);
            console.log(`✅ 任务完成: ${task.id}`);
        } catch (error) {
            console.error(`❌ 任务失败: ${task.id}`, error.message);
            
            // 重试逻辑
            task.attempts++;
            if (task.attempts < 3) {
                task.retryAt = Date.now() + 300000; // 5分钟后重试
                this.systemState.taskQueue.push(task);
                console.log(`🔄 任务将重试: ${task.id}`);
            }
        }
        
        this.saveSystemState();
    }
    
    /**
     * 🔨 执行具体任务
     */
    async executeTask(task) {
        switch (task.type) {
            case 'resume_interrupted':
                await this.executeResumeTask(task);
                break;
            case 'process_new':
                await this.executeNewProcessTask(task);
                break;
            case 'maintenance':
                await this.executeMaintenanceTask(task);
                break;
            default:
                throw new Error(`未知任务类型: ${task.type}`);
        }
    }
    
    /**
     * 🔄 执行恢复任务
     */
    async executeResumeTask(task) {
        const { articles, method } = task.data;
        
        if (method === 'ultra_processor') {
            // 使用Ultra处理器
            console.log('🚀 启动Ultra处理器恢复中断任务...');
            
            // 创建临时URL文件
            const tempUrls = articles.map(a => a.url);
            const tempFile = path.join(process.cwd(), `temp_resume_${Date.now()}.txt`);
            fs.writeFileSync(tempFile, tempUrls.join('\n'), 'utf8');
            
            try {
                // 使用批处理系统
                const processor = new BatchArticleProcessor();
                await processor.processArticles(tempUrls);
                
                console.log('✅ Ultra处理器恢复完成');
                
            } finally {
                // 清理临时文件
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }
        }
    }
    
    /**
     * 🆕 检查新任务
     */
    async checkForNewTasks() {
        console.log('🆕 检查新任务...');
        
        // 这里可以集成网站扫描逻辑
        // 使用现有的发现脚本
        
        const newTask = {
            id: `new_scan_${Date.now()}`,
            type: 'process_new',
            priority: this.config.taskPriority.process_new,
            data: {
                sites: ['golf.com', 'golfmonthly.com', 'mygolfspy.com', 'golfwrx.com', 'golfdigest.com'],
                limit: 5
            },
            createdAt: Date.now(),
            attempts: 0
        };
        
        this.systemState.taskQueue.push(newTask);
        console.log(`📋 已创建新任务: ${newTask.id}`);
    }
    
    /**
     * 🔄 启动系统监控
     */
    startSystemMonitoring() {
        // 健康检查
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        // 状态备份
        setInterval(() => {
            this.saveSystemState();
        }, this.config.backupInterval);
        
        // 任务调度检查
        setInterval(() => {
            this.checkTaskQueue();
        }, 30000); // 30秒检查一次
    }
    
    /**
     * 🏥 系统健康检查
     */
    performHealthCheck() {
        const now = Date.now();
        this.systemState.lastHealthCheck = now;
        
        console.log(`🏥 系统健康检查 [${new Date().toLocaleTimeString()}]`);
        
        // 检查内存使用
        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        console.log(`   💾 内存使用: ${memMB}MB`);
        
        // 检查任务队列
        console.log(`   📋 待处理任务: ${this.systemState.taskQueue.length}`);
        
        // 检查活跃进程
        console.log(`   🔄 活跃进程: ${this.systemState.activeProcesses.size}`);
        
        // 系统运行时间
        const uptime = Math.round((now - this.systemState.systemStartTime) / 60000);
        console.log(`   ⏱️  运行时间: ${uptime}分钟`);
    }
    
    /**
     * 📋 检查任务队列
     */
    async checkTaskQueue() {
        // 检查是否有到期的重试任务
        const retryTasks = this.systemState.taskQueue.filter(task => 
            task.retryAt && Date.now() >= task.retryAt
        );
        
        if (retryTasks.length > 0) {
            console.log(`🔄 发现 ${retryTasks.length} 个重试任务`);
            for (const task of retryTasks) {
                delete task.retryAt;
                await this.executeTask(task);
            }
        }
        
        // 如果队列不为空且没有活跃任务，执行下一个
        if (this.systemState.taskQueue.length > 0 && 
            this.systemState.activeProcesses.size === 0) {
            await this.executeNextTask();
        }
    }
    
    /**
     * 💾 保存系统状态
     */
    saveSystemState() {
        const state = {
            taskQueue: this.systemState.taskQueue,
            lastHealthCheck: this.systemState.lastHealthCheck,
            systemStartTime: this.systemState.systemStartTime,
            timestamp: Date.now()
        };
        
        try {
            fs.writeFileSync(this.config.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('❌ 状态保存失败:', error.message);
        }
    }
    
    /**
     * 📂 加载系统状态
     */
    loadSystemState() {
        try {
            if (fs.existsSync(this.config.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.config.stateFile, 'utf8'));
                
                // 检查是否过期（4小时）
                if (Date.now() - state.timestamp < 4 * 60 * 60 * 1000) {
                    this.systemState.taskQueue = state.taskQueue || [];
                    console.log(`📂 恢复系统状态: ${this.systemState.taskQueue.length}个任务`);
                } else {
                    console.log('⚠️ 系统状态过期，重新开始');
                }
            }
        } catch (error) {
            console.error('❌ 系统状态加载失败:', error.message);
        }
    }
    
    /**
     * 🛑 优雅退出
     */
    registerGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n🛑 收到${signal}信号，系统正在优雅退出...`);
            
            // 保存状态
            this.saveSystemState();
            
            // 清理资源
            for (const [id, process] of this.systemState.activeProcesses.entries()) {
                try {
                    process.kill();
                } catch (e) {}
            }
            
            console.log('👋 系统编排器退出完成');
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
}

/**
 * 🎯 主入口 - 自动恢复中断任务
 */
async function autoResumeSystem(options = {}) {
    console.log('🎯 自动恢复系统启动...');
    
    const orchestrator = new SystemOrchestrator(options);
    
    // 系统将自动运行，检测和恢复中断任务
    console.log('✅ 系统编排器正在运行，监控中断任务...');
    console.log('💡 如需查看进度，检查 system_state.json 文件');
}

// 直接运行
if (require.main === module) {
    autoResumeSystem().catch(error => {
        console.error('💥 系统启动失败:', error);
        process.exit(1);
    });
}

module.exports = { SystemOrchestrator, autoResumeSystem };