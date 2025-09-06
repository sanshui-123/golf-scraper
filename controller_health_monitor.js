#!/usr/bin/env node

/**
 * 控制器健康监控和自动恢复
 * 防止单个控制器卡死影响系统
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ControllerHealthMonitor {
    constructor() {
        this.controllers = new Map();
        this.checkInterval = 30000; // 30秒检查一次
        this.maxIdleTime = 300000; // 5分钟无输出视为卡死
        this.restartDelay = 10000; // 重启前等待10秒
        
        // 控制器配置
        this.controllerGroups = [
            {
                name: 'group1',
                files: ['deep_urls_golf_com.txt', 'deep_urls_golfmonthly_com.txt', 'deep_urls_mygolfspy_com.txt'],
                priority: 1
            },
            {
                name: 'group2',
                files: ['deep_urls_www_golfwrx_com.txt', 'deep_urls_www_golfdigest_com.txt', 'deep_urls_todays_golfer_com.txt'],
                priority: 2
            },
            {
                name: 'group3',
                files: 'other', // 剩余所有文件
                priority: 3
            }
        ];
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] 🏥 ${message}`);
        fs.appendFileSync('controller_health.log', `[${timestamp}] ${message}\n`);
    }

    /**
     * 启动控制器组
     */
    async startControllerGroup(group) {
        this.log(`启动控制器组: ${group.name}`);
        
        let files;
        if (group.files === 'other') {
            // 获取剩余的所有文件
            const allFiles = fs.readdirSync('.').filter(f => f.startsWith('deep_urls_') && f.endsWith('.txt'));
            const usedFiles = new Set();
            this.controllerGroups.filter(g => g.files !== 'other').forEach(g => {
                g.files.forEach(f => usedFiles.add(f));
            });
            files = allFiles.filter(f => !usedFiles.has(f)).join(' ');
        } else {
            files = group.files.join(' ');
        }
        
        if (!files || files.length === 0) {
            this.log(`${group.name} 没有文件需要处理`);
            return null;
        }
        
        const logFile = `controller_logs/${group.name}_${Date.now()}.log`;
        const proc = spawn('node', ['intelligent_concurrent_controller.js', ...files.split(' ')], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // 创建日志流
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        proc.stdout.pipe(logStream);
        proc.stderr.pipe(logStream);
        
        // 监控输出活动
        let lastActivity = Date.now();
        proc.stdout.on('data', () => {
            lastActivity = Date.now();
        });
        proc.stderr.on('data', () => {
            lastActivity = Date.now();
        });
        
        const controller = {
            process: proc,
            pid: proc.pid,
            group: group,
            startTime: Date.now(),
            lastActivity: lastActivity,
            logFile: logFile,
            restartCount: 0,
            status: 'running'
        };
        
        this.controllers.set(group.name, controller);
        
        // 处理进程退出
        proc.on('exit', (code) => {
            this.log(`控制器 ${group.name} 退出，代码: ${code}`);
            const controller = this.controllers.get(group.name);
            if (controller) {
                controller.status = 'exited';
                controller.exitCode = code;
            }
        });
        
        this.log(`控制器 ${group.name} 已启动，PID: ${proc.pid}`);
        return controller;
    }

    /**
     * 检查控制器健康状态
     */
    async checkHealth() {
        for (const [name, controller] of this.controllers) {
            if (controller.status !== 'running') continue;
            
            // 检查进程是否存活
            try {
                process.kill(controller.pid, 0);
            } catch (e) {
                this.log(`❌ 控制器 ${name} 进程已死亡`);
                controller.status = 'dead';
                continue;
            }
            
            // 检查是否卡死（长时间无输出）
            const idleTime = Date.now() - controller.lastActivity;
            if (idleTime > this.maxIdleTime) {
                this.log(`⚠️ 控制器 ${name} 可能卡死，已${Math.round(idleTime/60000)}分钟无输出`);
                
                // 检查是否真的卡死（通过查看CPU使用率）
                const cpuUsage = await this.getProcessCPU(controller.pid);
                if (cpuUsage < 1) {
                    this.log(`❌ 控制器 ${name} 确认卡死（CPU: ${cpuUsage.toFixed(1)}%）`);
                    controller.status = 'stuck';
                }
            }
            
            // 检查日志文件是否还在增长
            try {
                const stats = fs.statSync(controller.logFile);
                const fileAge = Date.now() - stats.mtimeMs;
                if (fileAge > this.maxIdleTime) {
                    this.log(`⚠️ 控制器 ${name} 日志文件${Math.round(fileAge/60000)}分钟未更新`);
                }
            } catch (e) {
                // 忽略文件访问错误
            }
        }
    }

    /**
     * 获取进程CPU使用率
     */
    async getProcessCPU(pid) {
        return new Promise((resolve) => {
            exec(`ps -p ${pid} -o %cpu | tail -1`, (err, stdout) => {
                if (err) {
                    resolve(0);
                } else {
                    resolve(parseFloat(stdout.trim()) || 0);
                }
            });
        });
    }

    /**
     * 重启卡死或退出的控制器
     */
    async restartUnhealthyControllers() {
        for (const [name, controller] of this.controllers) {
            if (controller.status === 'stuck' || controller.status === 'dead' || controller.status === 'exited') {
                this.log(`🔄 准备重启控制器 ${name}`);
                
                // 终止旧进程
                try {
                    process.kill(controller.pid, 'SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    process.kill(controller.pid, 'SIGKILL');
                } catch (e) {
                    // 进程可能已经死亡
                }
                
                // 等待一段时间
                await new Promise(resolve => setTimeout(resolve, this.restartDelay));
                
                // 检查重启次数
                controller.restartCount++;
                if (controller.restartCount > 3) {
                    this.log(`❌ 控制器 ${name} 重启次数过多，暂停重启`);
                    controller.status = 'disabled';
                    continue;
                }
                
                // 重启控制器
                const newController = await this.startControllerGroup(controller.group);
                if (newController) {
                    newController.restartCount = controller.restartCount;
                    this.log(`✅ 控制器 ${name} 已重启（第${controller.restartCount}次）`);
                }
            }
        }
    }

    /**
     * 显示状态摘要
     */
    displayStatus() {
        console.log('\n📊 控制器健康状态');
        console.log('═'.repeat(50));
        
        for (const [name, controller] of this.controllers) {
            const runTime = Math.round((Date.now() - controller.startTime) / 60000);
            const idleTime = Math.round((Date.now() - controller.lastActivity) / 60000);
            
            let statusIcon = '✅';
            if (controller.status === 'stuck') statusIcon = '⚠️';
            if (controller.status === 'dead') statusIcon = '❌';
            if (controller.status === 'exited') statusIcon = '🏁';
            if (controller.status === 'disabled') statusIcon = '🚫';
            
            console.log(`${statusIcon} ${name.padEnd(10)} | PID: ${controller.pid} | 运行: ${runTime}分钟 | 空闲: ${idleTime}分钟 | 重启: ${controller.restartCount}次`);
        }
        
        console.log('═'.repeat(50));
    }

    /**
     * 启动监控
     */
    async start() {
        this.log('🚀 控制器健康监控启动');
        
        // 启动所有控制器组
        for (const group of this.controllerGroups) {
            await this.startControllerGroup(group);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 错开启动
        }
        
        // 定期检查健康状态
        setInterval(async () => {
            await this.checkHealth();
            await this.restartUnhealthyControllers();
            this.displayStatus();
        }, this.checkInterval);
        
        // 初始状态显示
        this.displayStatus();
        
        console.log('\n💡 提示：');
        console.log('- 按 Ctrl+C 停止监控');
        console.log('- 查看详细日志: tail -f controller_health.log');
        console.log('- 监控会自动重启卡死的控制器\n');
    }
}

// 启动监控
const monitor = new ControllerHealthMonitor();
monitor.start().catch(console.error);

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n🛑 停止健康监控...');
    
    // 终止所有控制器
    for (const [name, controller] of monitor.controllers) {
        try {
            process.kill(controller.pid, 'SIGTERM');
            console.log(`停止控制器 ${name}`);
        } catch (e) {
            // 忽略
        }
    }
    
    process.exit(0);
});