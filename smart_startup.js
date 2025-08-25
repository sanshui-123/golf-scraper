#!/usr/bin/env node

/**
 * 🚀 智能启动脚本
 * 一键启动完整的高尔夫内容系统，集成所有优化功能
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class SmartStartup {
    constructor() {
        this.services = {
            urlGeneration: { status: 'pending', pid: null },
            batchProcessing: { status: 'pending', pid: null },
            webServer: { status: 'pending', pid: null }
        };
        
        this.config = {
            // 启动选项
            autoRecovery: true,
            webInterface: true,
            concurrentProcessing: true,
            timeFilterOptimization: true,
            
            // 超时配置 (已优化)
            timeouts: {
                urlGeneration: 300000, // 5分钟
                webServer: 30000,      // 30秒
                batchProcessing: 600000 // 10分钟启动超时
            }
        };
    }

    /**
     * 主启动流程
     */
    async start(options = {}) {
        console.log('🚀 智能高尔夫内容系统启动中...');
        console.log('═'.repeat(50));
        
        const startTime = Date.now();
        
        try {
            // 1. 预启动检查
            await this.preStartupCheck();
            
            // 2. 启动URL生成 (智能URL系统v2.0)
            console.log('\n🧠 第1阶段: 智能URL生成和筛选...');
            console.log('🔍 调用startUrlGeneration...');
            const urlResult = await this.startUrlGeneration(options);
            console.log('🔍 URL生成返回结果:', urlResult ? '成功' : '失败');
            
            // 3. 启动Web服务器 (如果需要)
            if (this.config.webInterface && !options.batchOnly) {
                console.log('\n🌐 第2阶段: 启动Web管理界面...');
                await this.startWebServer();
            }
            
            // 4. 启动批量处理 (企业级容错)
            console.log('\n🛡️ 第3阶段: 启动企业级批量处理...');
            await this.startBatchProcessing();
            
            const duration = Date.now() - startTime;
            console.log('\n🎉 系统启动完成!');
            console.log(`⏱️ 总启动时间: ${Math.round(duration/1000)}秒`);
            console.log('🔒 批量处理现在独立运行，不受主进程影响');
            
            this.displayStartupSummary();
            this.monitorServices();
            
        } catch (error) {
            console.error('❌ 系统启动失败:', error.message);
            await this.handleStartupFailure(error);
            throw error;
        }
    }

    /**
     * 预启动检查
     */
    async preStartupCheck() {
        console.log('🔍 预启动系统检查...');
        
        // 检查必要文件
        const requiredFiles = [
            'intelligent_url_master.js',
            'auto_scrape_three_sites.js',
            'batch_process_articles.js',
            'web_server.js',
            'start_with_recovery.sh'
        ];
        
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`关键文件缺失: ${file}`);
            }
        }
        
        // 检查端口占用
        if (this.config.webInterface) {
            const portInUse = await this.checkPort(8080);
            if (portInUse) {
                console.log('⚠️ 端口8080被占用，将尝试重用或更换端口');
            }
        }
        
        console.log('✅ 预启动检查通过');
    }

    /**
     * 启动智能URL生成
     */
    async startUrlGeneration(options) {
        return new Promise((resolve, reject) => {
            console.log('   🧠 启动智能URL主控制器...');
            
            const args = ['auto_scrape_three_sites.js'];
            
            // 添加参数
            if (options.allSites !== false) {
                args.push('--all-sites');
            }
            if (options.verbose) {
                args.push('--verbose');
            }
            
            const urlGenProcess = spawn('node', args, {
                stdio: 'pipe'
            });
            
            let output = '';
            let hasUrls = false;
            
            urlGenProcess.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log(`   ${text.trim()}`);
                
                // 检测URL生成
                if (text.includes('个有效URL') || text.includes('URLs')) {
                    hasUrls = true;
                }
            });
            
            urlGenProcess.stderr.on('data', (data) => {
                console.log(`   ⚠️ ${data.toString().trim()}`);
            });
            
            urlGenProcess.on('close', (code) => {
                console.log(`   🔍 URL生成进程关闭，退出码: ${code}`);
                if (code === 0 || code === null) {
                    this.services.urlGeneration.status = hasUrls ? 'success' : 'warning';
                    console.log(`   ✅ URL生成完成 (退出码: ${code})`);
                    console.log(`   📊 hasUrls: ${hasUrls}, 继续下一阶段...`);
                    resolve({ hasUrls, output });
                } else {
                    this.services.urlGeneration.status = 'failed';
                    console.log(`   ❌ URL生成失败 (退出码: ${code})`);
                    reject(new Error(`URL生成失败 (退出码: ${code})`));
                }
            });
            
            urlGenProcess.on('exit', (code, signal) => {
                console.log(`   🔍 URL生成进程退出: 退出码=${code}, 信号=${signal}`);
            });
            
            // 设置超时
            setTimeout(() => {
                if (urlGenProcess && !urlGenProcess.killed) {
                    urlGenProcess.kill('SIGTERM');
                    reject(new Error('URL生成超时'));
                }
            }, this.config.timeouts.urlGeneration);
        });
    }

    /**
     * 启动Web服务器
     */
    async startWebServer() {
        return new Promise((resolve, reject) => {
            console.log('   🌐 启动Web管理界面...');
            
            const process = spawn('node', ['web_server.js'], {
                detached: true,
                stdio: 'pipe'
            });
            
            this.services.webServer.pid = process.pid;
            
            let serverStarted = false;
            
            process.stdout.on('data', (data) => {
                const text = data.toString();
                console.log(`   ${text.trim()}`);
                
                if (text.includes('8080') || text.includes('服务器启动')) {
                    serverStarted = true;
                    this.services.webServer.status = 'running';
                    console.log('   ✅ Web服务器启动成功');
                    console.log('   🔗 访问地址: http://localhost:8080');
                    resolve();
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log(`   ⚠️ ${data.toString().trim()}`);
            });
            
            process.on('close', (code) => {
                if (!serverStarted) {
                    this.services.webServer.status = 'failed';
                    reject(new Error(`Web服务器启动失败 (退出码: ${code})`));
                }
            });
            
            // 防止服务器启动后立即退出的情况
            setTimeout(() => {
                if (!serverStarted) {
                    this.services.webServer.status = 'failed';
                    reject(new Error('Web服务器启动超时'));
                } else {
                    // 服务器已启动，分离进程
                    process.unref();
                }
            }, this.config.timeouts.webServer);
        });
    }

    /**
     * 启动批量处理 (直接调用，单一最优方案)
     */
    async startBatchProcessing() {
        return new Promise((resolve, reject) => {
            console.log('   ⚡ 启动批量处理 (智能模式)...');
            console.log('   🔍 批量处理器将自动抓取最新URL并筛选未处理文章');
            
            // 检查是否在VPN模式下
            const isVpnMode = process.env.VPN_COMPATIBLE_MODE === 'true';
            const batchScript = isVpnMode ? 'batch_process_articles_vpn.js' : 'batch_process_articles.js';
            
            if (isVpnMode) {
                console.log('   🔐 VPN兼容模式已启用');
            }
            
            // 🔒 直接调用批处理程序，不传递URL文件
            const batchProcess = spawn('node', [
                batchScript,
                'auto'  // 特殊标记，表示自动抓取URL
            ], {
                detached: true,     // 🔒 完全独立，不受父进程影响
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { 
                    ...process.env, 
                    NODE_ENV: 'production',
                    FORCE_INDEPENDENT: 'true',  // 🔒 强制独立运行标志
                    DISABLE_SIGTERM: 'true',    // 🔒 禁用SIGTERM处理
                    BATCH_MODE: 'detached'      // 🔒 独立批量模式
                }
            });
            
            // 立即分离，确保即使父进程结束也继续运行
            batchProcess.unref();
            this.services.batchProcessing.pid = batchProcess.pid;
            
            let processingStarted = false;
            
            batchProcess.stdout.on('data', (data) => {
                const text = data.toString();
                console.log(`   ${text.trim()}`);
                
                if (text.includes('开始逐个处理文章') || text.includes('WebSocket监控系统已连接') || text.includes('开始处理')) {
                    processingStarted = true;
                    this.services.batchProcessing.status = 'independent';
                    console.log('   🔒 批量处理已独立启动，不受主进程影响');
                }
            });
            
            batchProcess.stderr.on('data', (data) => {
                const errorText = data.toString();
                if (!errorText.includes('DeprecationWarning')) {
                    console.log(`   ⚠️ ${errorText.trim()}`);
                }
            });
            
            // 只在启动失败时处理，运行中的退出是正常的
            batchProcess.on('close', (code) => {
                if (!processingStarted && code !== 0) {
                    this.services.batchProcessing.status = 'failed';
                    reject(new Error(`批量处理启动失败 (退出码: ${code})`));
                }
            });
            
            // 给批量处理更长的启动时间，但不终止进程
            setTimeout(() => {
                if (!processingStarted) {
                    this.services.batchProcessing.status = 'detached';
                    console.log('   🔄 批量处理已独立运行，不受主进程影响...');
                }
                resolve(); // 不阻塞，允许继续
            }, this.config.timeouts.batchProcessing);
        });
    }

    /**
     * 显示启动摘要
     */
    displayStartupSummary() {
        console.log('\n📊 启动摘要:');
        console.log('═'.repeat(30));
        
        for (const [service, info] of Object.entries(this.services)) {
            const status = info.status;
            let icon = '❓';
            
            switch (status) {
                case 'success':
                case 'running':
                case 'completed':
                    icon = '✅';
                    break;
                case 'warning':
                    icon = '⚠️';
                    break;
                case 'failed':
                    icon = '❌';
                    break;
                case 'timeout':
                    icon = '⏱️';
                    break;
            }
            
            console.log(`${icon} ${service}: ${status.toUpperCase()}`);
            if (info.pid) {
                console.log(`   PID: ${info.pid}`);
            }
        }
        
        console.log('\n🎯 后续操作:');
        if (this.services.webServer.status === 'running') {
            console.log('   📱 访问Web界面: http://localhost:8080');
        }
        if (this.services.batchProcessing.status === 'running') {
            console.log('   📈 监控处理进度: tail -f process_log.txt');
        }
        console.log('   🔍 系统诊断: node system_diagnostic_script.js');
    }

    /**
     * 服务监控
     */
    monitorServices() {
        console.log('\n👁️ 开始服务监控 (每30秒检查一次)...');
        
        const monitor = setInterval(() => {
            this.checkServiceHealth();
        }, 30000);
        
        // 优雅退出处理
        process.on('SIGINT', () => {
            console.log('\n🛑 收到退出信号，清理资源...');
            clearInterval(monitor);
            this.cleanup();
            process.exit(0);
        });
    }

    /**
     * 检查服务健康状态
     */
    async checkServiceHealth() {
        // 简化版健康检查
        if (this.services.webServer.pid) {
            try {
                process.kill(this.services.webServer.pid, 0);
            } catch (error) {
                console.log('⚠️ Web服务器进程可能已停止');
                this.services.webServer.status = 'stopped';
            }
        }
    }

    /**
     * 处理启动失败
     */
    async handleStartupFailure(error) {
        console.log('\n🔧 启动失败处理...');
        console.log('   建议检查项：');
        console.log('   1. 网络连接: curl -I https://golf.com');
        console.log('   2. 端口占用: lsof -i :8080');
        console.log('   3. 文件权限: ls -la *.sh');
        console.log('   4. 运行诊断: node system_diagnostic_script.js');
    }

    /**
     * 清理资源
     */
    cleanup() {
        console.log('🧹 清理系统资源...');
        
        Object.entries(this.services).forEach(([name, service]) => {
            if (service.pid) {
                try {
                    // 🔒 保护独立运行的批量处理进程
                    if (name === 'batchProcessing' && service.status === 'independent') {
                        console.log(`   🔄 批量处理进程 ${service.pid} 独立运行，继续执行...`);
                        return;
                    }
                    
                    process.kill(service.pid, 'SIGTERM');
                    console.log(`   ✅ 已停止进程 ${service.pid}`);
                } catch (error) {
                    console.log(`   ⚠️ 进程 ${service.pid} 已停止或无法访问`);
                }
            }
        });
    }

    // 辅助方法
    async checkPort(port) {
        return new Promise((resolve) => {
            exec(`lsof -i :${port}`, (error) => {
                resolve(!error);
            });
        });
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    const startup = new SmartStartup();

    const options = {
        allSites: !args.includes('--single-site'),
        verbose: args.includes('--verbose'),
        batchOnly: args.includes('--batch-only')
    };

    startup.start(options).catch((error) => {
        console.error('💥 启动失败:', error.message);
        process.exit(1);
    });
}

module.exports = SmartStartup;