#!/usr/bin/env node

/**
 * 🛡️ 自动恢复系统 - 防断网/黑屏中断
 * 
 * 功能:
 * 1. 检测系统中断
 * 2. 自动重启处理流程
 * 3. 恢复到中断前状态
 * 4. 后台持续监控
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class AutoRecoverySystem {
    constructor() {
        this.configFile = './auto_recovery_config.json';
        this.logFile = './auto_recovery.log';
        this.isMonitoring = false;
        this.processCheckInterval = 30000; // 30秒检查一次
        this.maxRestartAttempts = 5;
        this.restartCount = 0;
    }

    /**
     * 🚀 启动自动恢复系统
     */
    async start() {
        console.log('🛡️ 启动自动恢复系统...');
        
        // 加载配置
        await this.loadConfig();
        
        // 检查是否有中断的任务
        await this.checkForInterruptedTasks();
        
        // 启动监控
        this.startMonitoring();
        
        // 设置信号处理
        this.setupSignalHandlers();
        
        console.log('✅ 自动恢复系统已启动');
        console.log('   📊 监控间隔: 30秒');
        console.log('   🔄 最大重启次数: 5次');
        console.log('   📝 日志文件: auto_recovery.log');
    }

    /**
     * 📖 加载配置
     */
    async loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.processCheckInterval = config.checkInterval || 30000;
                this.maxRestartAttempts = config.maxRestarts || 5;
                console.log('✅ 配置已加载');
            } else {
                // 创建默认配置
                const defaultConfig = {
                    checkInterval: 30000,
                    maxRestarts: 5,
                    autoStart: true,
                    monitorFiles: ['deep_urls_*.txt'],
                    command: 'node batch_process_articles.js'
                };
                fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
                console.log('📝 创建了默认配置文件');
            }
        } catch (error) {
            console.error('❌ 加载配置失败:', error.message);
        }
    }

    /**
     * 🔍 检查中断任务
     */
    async checkForInterruptedTasks() {
        try {
            // 检查恢复状态文件
            const resumeFiles = fs.readdirSync('.')
                .filter(file => file.startsWith('resume_state_'))
                .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);

            if (resumeFiles.length > 0) {
                const latestResumeFile = resumeFiles[0];
                const resumeData = JSON.parse(fs.readFileSync(latestResumeFile, 'utf8'));
                
                console.log('🔄 发现中断任务:');
                console.log(`   时间: ${resumeData.timestamp}`);
                console.log(`   进程ID: ${resumeData.processId}`);
                console.log(`   网络状态: ${resumeData.networkStatus ? '正常' : '异常'}`);
                
                // 检查进程是否还在运行
                const isProcessRunning = await this.checkProcessRunning(resumeData.processId);
                
                if (!isProcessRunning) {
                    console.log('⚠️ 检测到进程中断，准备自动恢复...');
                    await this.restartProcessing();
                } else {
                    console.log('✅ 进程仍在运行中');
                }
            }

            // 检查processing状态的文章
            await this.checkProcessingArticles();

        } catch (error) {
            console.error('❌ 检查中断任务失败:', error.message);
        }
    }

    /**
     * 📊 检查processing状态文章
     */
    async checkProcessingArticles() {
        try {
            // 🔧 修复：使用当前日期而非硬编码
            const today = new Date().toISOString().split('T')[0];
            const articleUrlsFile = `./golf_content/${today}/article_urls.json`;
            if (fs.existsSync(articleUrlsFile)) {
                const data = JSON.parse(fs.readFileSync(articleUrlsFile, 'utf8'));
                const processingArticles = Object.values(data)
                    .filter(article => article.status === 'processing');

                if (processingArticles.length > 0) {
                    console.log(`🔄 发现 ${processingArticles.length} 篇处理中的文章`);
                    
                    // 检查是否长时间未更新
                    const now = Date.now();
                    const staleArticles = processingArticles.filter(article => {
                        const timestamp = new Date(article.timestamp).getTime();
                        return now - timestamp > 3600000; // 1小时
                    });

                    if (staleArticles.length > 0) {
                        console.log(`⚠️ ${staleArticles.length} 篇文章可能已中断，建议重新处理`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 检查处理中文章失败:', error.message);
        }
    }

    /**
     * 🔍 检查进程是否运行
     */
    async checkProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 👁️ 启动监控
     */
    startMonitoring() {
        this.isMonitoring = true;
        
        const monitor = setInterval(async () => {
            if (!this.isMonitoring) {
                clearInterval(monitor);
                return;
            }

            try {
                // 检查系统健康
                await this.performHealthCheck();
                
                // 记录心跳
                await this.recordHeartbeat();

            } catch (error) {
                console.error('❌ 监控检查失败:', error.message);
                await this.logError('监控检查失败', error);
            }

        }, this.processCheckInterval);

        console.log(`👁️ 监控已启动，每${this.processCheckInterval/1000}秒检查一次`);
    }

    /**
     * 🏥 系统健康检查
     */
    async performHealthCheck() {
        const checks = [];

        // 检查URL文件
        const urlFiles = ['deep_urls_golf_com.txt', 'deep_urls_www_golfwrx_com.txt'];
        for (const file of urlFiles) {
            if (fs.existsSync(file)) {
                checks.push(`✅ ${file}`);
            } else {
                checks.push(`❌ ${file} 缺失`);
            }
        }

        // 检查状态文件
        const stateFile = './golf_content/2025-08-03/article_urls.json';
        if (fs.existsSync(stateFile)) {
            const stats = fs.statSync(stateFile);
            const lastModified = Date.now() - stats.mtime.getTime();
            
            if (lastModified < 300000) { // 5分钟内有更新
                checks.push('✅ 状态文件活跃');
            } else {
                checks.push('⚠️ 状态文件可能停止更新');
            }
        }

        // 每10分钟输出一次健康报告
        if (Math.random() < 0.1) {
            console.log('🏥 系统健康检查:');
            checks.forEach(check => console.log(`   ${check}`));
        }
    }

    /**
     * 💓 记录心跳
     */
    async recordHeartbeat() {
        const heartbeat = {
            timestamp: new Date().toISOString(),
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            restartCount: this.restartCount
        };

        try {
            fs.writeFileSync('./recovery_heartbeat.json', JSON.stringify(heartbeat, null, 2));
        } catch (error) {
            // 静默失败，避免日志噪音
        }
    }

    /**
     * 🔄 重启处理流程
     */
    async restartProcessing() {
        if (this.restartCount >= this.maxRestartAttempts) {
            console.error(`❌ 已达到最大重启次数 (${this.maxRestartAttempts})，停止自动恢复`);
            await this.logError('达到最大重启次数', new Error('Max restart attempts reached'));
            return;
        }

        this.restartCount++;
        console.log(`🔄 第 ${this.restartCount} 次自动重启...`);

        try {
            // 等待一段时间再重启
            await new Promise(resolve => setTimeout(resolve, 10000));

            // 查找URL文件
            const urlFiles = fs.readdirSync('.')
                .filter(file => file.startsWith('deep_urls_') && file.endsWith('.txt'));

            if (urlFiles.length === 0) {
                console.error('❌ 未找到URL文件，无法重启');
                return;
            }

            // 启动处理进程
            const command = 'node';
            const args = ['batch_process_articles.js', ...urlFiles];
            
            console.log(`🚀 执行命令: ${command} ${args.join(' ')}`);
            
            const child = spawn(command, args, {
                stdio: 'inherit',
                detached: false
            });

            child.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ 处理完成');
                    this.restartCount = 0; // 重置重启计数
                } else {
                    console.log(`⚠️ 进程退出，代码: ${code}`);
                    // 可能需要再次重启
                    setTimeout(() => this.restartProcessing(), 30000);
                }
            });

            child.on('error', (error) => {
                console.error('❌ 进程启动失败:', error.message);
                this.logError('进程启动失败', error);
            });

        } catch (error) {
            console.error('❌ 重启失败:', error.message);
            await this.logError('重启失败', error);
        }
    }

    /**
     * 📝 记录错误日志
     */
    async logError(message, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message,
            error: error.message,
            stack: error.stack,
            restartCount: this.restartCount
        };

        try {
            const logLine = `${logEntry.timestamp} [ERROR] ${message}: ${error.message}\n`;
            fs.appendFileSync(this.logFile, logLine);
        } catch (writeError) {
            console.error('❌ 写入日志失败:', writeError.message);
        }
    }

    /**
     * 🚨 设置信号处理
     */
    setupSignalHandlers() {
        const gracefulShutdown = (signal) => {
            console.log(`\n🚨 自动恢复系统接收到${signal}信号，关闭监控...`);
            this.isMonitoring = false;
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
    }

    /**
     * 🛑 停止监控
     */
    stop() {
        this.isMonitoring = false;
        console.log('🛑 自动恢复系统已停止');
    }
}

// CLI执行
if (require.main === module) {
    const recovery = new AutoRecoverySystem();
    
    const command = process.argv[2];
    
    if (command === 'start') {
        recovery.start();
    } else if (command === 'stop') {
        recovery.stop();
    } else if (command === 'status') {
        console.log('📊 查看自动恢复状态...');
        // 实现状态查看
    } else {
        console.log('用法:');
        console.log('  node auto_recovery.js start   # 启动自动恢复监控');
        console.log('  node auto_recovery.js stop    # 停止监控');
        console.log('  node auto_recovery.js status  # 查看状态');
    }
}

module.exports = AutoRecoverySystem;