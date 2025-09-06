#!/usr/bin/env node
/**
 * 系统守护进程 - 管理高尔夫文章处理系统
 * 功能：
 * 1. 监控和管理所有子进程
 * 2. 自动恢复崩溃的服务
 * 3. 定时执行任务
 * 4. 健康检查
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

class SystemDaemon {
    constructor() {
        this.services = new Map();
        this.config = {
            webServer: {
                name: 'Web服务器',
                script: 'web_server.js',
                args: [],
                alwaysOn: true,
                healthCheck: () => this.checkWebServer()
            },
            controller: {
                name: '智能控制器',
                script: 'intelligent_concurrent_controller.js',
                args: [],
                alwaysOn: true,
                schedule: null,
                healthCheck: () => this.checkController()
            },
            urlGenerator: {
                name: 'URL生成器',
                script: 'auto_scrape_three_sites.js',
                args: ['--all-sites'],
                alwaysOn: false,
                schedule: [6, 12, 18],  // 每天6点、12点、18点运行
                lastRun: null
            }
        };
        
        this.startTime = Date.now();
        this.restartCounts = new Map();
    }
    
    async start() {
        console.log('🚀 系统守护进程启动...');
        console.log(`📅 启动时间: ${new Date().toLocaleString()}`);
        
        // 创建日志目录
        this.ensureLogDirectory();
        
        // 启动核心服务
        await this.startCoreServices();
        
        // 设置定时任务
        this.setupScheduler();
        
        // 设置健康检查
        this.setupHealthCheck();
        
        // 处理进程信号
        this.handleSignals();
        
        console.log('✅ 守护进程已就绪');
    }
    
    ensureLogDirectory() {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    async startCoreServices() {
        // 启动始终运行的服务
        for (const [key, config] of Object.entries(this.config)) {
            if (config.alwaysOn) {
                await this.startService(key);
                await new Promise(resolve => setTimeout(resolve, 2000));  // 延迟2秒
            }
        }
    }
    
    async startService(serviceKey) {
        const config = this.config[serviceKey];
        
        if (this.services.has(serviceKey)) {
            const service = this.services.get(serviceKey);
            if (service.process && !service.process.killed) {
                console.log(`⏭️ ${config.name}已在运行`);
                return;
            }
        }
        
        console.log(`▶️ 启动${config.name}...`);
        
        try {
            const process = spawn('node', [config.script, ...config.args], {
                cwd: __dirname,
                env: { ...process.env, NODE_ENV: 'production' },
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // 日志处理
            const logStream = fs.createWriteStream(
                path.join(__dirname, 'logs', `${serviceKey}.log`),
                { flags: 'a' }
            );
            
            process.stdout.pipe(logStream);
            process.stderr.pipe(logStream);
            
            process.on('exit', (code, signal) => {
                console.log(`⚠️ ${config.name}退出: code=${code}, signal=${signal}`);
                this.handleProcessExit(serviceKey, code, signal);
            });
            
            this.services.set(serviceKey, {
                process,
                startTime: Date.now(),
                config
            });
            
            console.log(`✅ ${config.name}已启动 (PID: ${process.pid})`);
        } catch (error) {
            console.error(`❌ 启动${config.name}失败:`, error);
        }
    }
    
    handleProcessExit(serviceKey, code, signal) {
        const config = this.config[serviceKey];
        
        // 更新重启计数
        const restartCount = this.restartCounts.get(serviceKey) || 0;
        this.restartCounts.set(serviceKey, restartCount + 1);
        
        // 如果是始终运行的服务，尝试重启
        if (config.alwaysOn && restartCount < 10) {
            console.log(`🔄 尝试重启${config.name} (第${restartCount + 1}次)`);
            
            setTimeout(() => {
                this.startService(serviceKey);
            }, Math.min(restartCount * 5000, 30000));  // 递增延迟，最多30秒
        } else if (restartCount >= 10) {
            console.error(`❌ ${config.name}重启次数过多，停止重启`);
            // 重置计数器，1小时后可以再次尝试
            setTimeout(() => {
                this.restartCounts.set(serviceKey, 0);
            }, 3600000);
        }
    }
    
    setupScheduler() {
        console.log('⏰ 设置定时任务...');
        
        // 每分钟检查一次定时任务
        setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            
            // 检查每个服务的调度
            for (const [key, config] of Object.entries(this.config)) {
                if (config.schedule && minute === 0) {
                    if (config.schedule.includes(hour)) {
                        const lastRun = config.lastRun;
                        const today = now.toDateString();
                        
                        // 确保今天这个小时还没运行过
                        if (!lastRun || lastRun.toDateString() !== today || lastRun.getHours() !== hour) {
                            console.log(`⏰ 执行定时任务: ${config.name}`);
                            this.runScheduledTask(key);
                            config.lastRun = now;
                        }
                    }
                }
            }
        }, 60000);  // 每分钟检查
    }
    
    async runScheduledTask(serviceKey) {
        const config = this.config[serviceKey];
        console.log(`🏃 运行定时任务: ${config.name}`);
        
        const process = spawn('node', [config.script, ...config.args], {
            cwd: __dirname,
            env: { ...process.env, NODE_ENV: 'production' }
        });
        
        process.on('exit', (code) => {
            console.log(`✅ 定时任务完成: ${config.name} (退出码: ${code})`);
        });
    }
    
    setupHealthCheck() {
        console.log('🏥 设置健康检查...');
        
        // 每5分钟进行一次健康检查
        setInterval(async () => {
            console.log('🔍 执行健康检查...');
            
            for (const [key, config] of Object.entries(this.config)) {
                if (config.alwaysOn && config.healthCheck) {
                    const isHealthy = await config.healthCheck();
                    
                    if (!isHealthy) {
                        console.warn(`⚠️ ${config.name}健康检查失败，尝试重启...`);
                        const service = this.services.get(key);
                        if (service && service.process) {
                            service.process.kill();
                        }
                        // handleProcessExit会自动重启
                    }
                }
            }
        }, 300000);  // 5分钟
    }
    
    async checkWebServer() {
        return new Promise((resolve) => {
            http.get('http://localhost:8080', (res) => {
                resolve(res.statusCode === 200);
            }).on('error', () => {
                resolve(false);
            });
        });
    }
    
    async checkController() {
        // 检查控制器是否在运行
        const service = this.services.get('controller');
        if (!service || !service.process) return false;
        
        try {
            // 发送信号0来检查进程是否存在
            process.kill(service.process.pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    handleSignals() {
        // 优雅关闭
        const shutdown = async (signal) => {
            console.log(`\n🛑 收到${signal}信号，开始优雅关闭...`);
            
            // 停止所有服务
            for (const [key, service] of this.services) {
                if (service.process && !service.process.killed) {
                    console.log(`🛑 停止${service.config.name}...`);
                    service.process.kill('SIGTERM');
                }
            }
            
            // 等待所有进程结束
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log('👋 守护进程已关闭');
            process.exit(0);
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    
    // 系统信息
    getSystemInfo() {
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        
        return {
            uptime: `${hours}小时${minutes}分钟`,
            services: Array.from(this.services.entries()).map(([key, service]) => ({
                name: service.config.name,
                pid: service.process?.pid,
                running: service.process && !service.process.killed,
                restarts: this.restartCounts.get(key) || 0
            }))
        };
    }
}

// 启动守护进程
if (require.main === module) {
    const daemon = new SystemDaemon();
    daemon.start().catch(error => {
        console.error('❌ 守护进程启动失败:', error);
        process.exit(1);
    });
}