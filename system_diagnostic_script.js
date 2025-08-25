#!/usr/bin/env node

/**
 * 🔧 系统诊断和健康检查脚本
 * 整合所有复杂操作，保持CLAUDE.md简洁
 */

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

class SystemDiagnostic {
    constructor() {
        this.checks = [];
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            details: []
        };
    }

    /**
     * 网络连接检查
     */
    async checkNetworkConnectivity() {
        console.log('\n🌐 网络连接检查...');
        const sites = [
            'https://golf.com',
            'https://www.golfmonthly.com',
            'https://mygolfspy.com',
            'https://www.golfwrx.com',
            'https://www.golfdigest.com'
        ];

        const results = [];
        for (const site of sites) {
            try {
                const result = await this.curlCheck(site);
                if (result.success) {
                    console.log(`   ✅ ${site}: ${result.status}`);
                    results.push({ site, status: 'OK', code: result.status });
                } else {
                    console.log(`   ❌ ${site}: ${result.error}`);
                    results.push({ site, status: 'FAIL', error: result.error });
                }
            } catch (error) {
                console.log(`   ⚠️ ${site}: ${error.message}`);
                results.push({ site, status: 'WARNING', error: error.message });
            }
        }

        this.results.details.push({
            category: 'Network Connectivity',
            results: results
        });

        const failedSites = results.filter(r => r.status === 'FAIL').length;
        return failedSites === 0;
    }

    /**
     * URL文件验证
     */
    async checkUrlFiles() {
        console.log('\n📁 URL文件验证...');
        const expectedFiles = [
            'deep_urls_golf_com.txt',
            'deep_urls_golfmonthly_com.txt',
            'deep_urls_mygolfspy_com.txt',
            'deep_urls_www_golfwrx_com.txt',
            'deep_urls_www_golfdigest_com.txt'
        ];

        const fileStats = [];
        let validFiles = 0;

        expectedFiles.forEach(filename => {
            if (fs.existsSync(filename)) {
                const content = fs.readFileSync(filename, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim() && !url.startsWith('#'));
                
                if (urls.length > 0) {
                    console.log(`   ✅ ${filename}: ${urls.length} URLs`);
                    validFiles++;
                } else {
                    console.log(`   ⚠️ ${filename}: 空文件`);
                }
                
                fileStats.push({
                    filename,
                    exists: true,
                    urlCount: urls.length,
                    fileSize: fs.statSync(filename).size
                });
            } else {
                console.log(`   ❌ ${filename}: 不存在`);
                fileStats.push({
                    filename,
                    exists: false,
                    urlCount: 0,
                    fileSize: 0
                });
            }
        });

        this.results.details.push({
            category: 'URL Files',
            totalFiles: expectedFiles.length,
            validFiles: validFiles,
            fileStats: fileStats
        });

        return validFiles > 0;
    }

    /**
     * 系统进程检查
     */
    async checkSystemProcesses() {
        console.log('\n⚙️ 系统进程检查...');
        const processes = ['batch_process', 'auto_recovery', 'web_server'];
        const processResults = [];

        for (const proc of processes) {
            try {
                const result = await this.execPromise(`ps aux | grep -E "${proc}" | grep -v grep`);
                if (result.stdout.trim()) {
                    console.log(`   ✅ ${proc}: 运行中`);
                    processResults.push({ process: proc, status: 'RUNNING', pid: this.extractPid(result.stdout) });
                } else {
                    console.log(`   ⚠️ ${proc}: 未运行`);
                    processResults.push({ process: proc, status: 'STOPPED', pid: null });
                }
            } catch (error) {
                console.log(`   ❌ ${proc}: 检查失败 - ${error.message}`);
                processResults.push({ process: proc, status: 'ERROR', error: error.message });
            }
        }

        this.results.details.push({
            category: 'System Processes',
            processes: processResults
        });

        return processResults.some(p => p.status === 'RUNNING');
    }

    /**
     * 历史数据库健康检查
     */
    async checkHistoryDatabase() {
        console.log('\n📊 历史数据库检查...');
        
        try {
            const UnifiedHistoryDatabase = require('./unified_history_database');
            const historyDB = new UnifiedHistoryDatabase();
            const status = historyDB.getStatus();
            
            console.log(`   ✅ URL记录: ${status.urlCount} 条`);
            console.log(`   ✅ 内容记录: ${status.contentCount} 条`);
            console.log(`   ✅ 数据库文件: ${status.exists ? '存在' : '不存在'}`);
            
            this.results.details.push({
                category: 'History Database',
                urlCount: status.urlCount,
                contentCount: status.contentCount,
                exists: status.exists,
                healthy: status.urlCount > 0 && status.contentCount > 0
            });

            return status.urlCount > 0 && status.contentCount > 0;
        } catch (error) {
            console.log(`   ❌ 数据库检查失败: ${error.message}`);
            this.results.details.push({
                category: 'History Database',
                error: error.message,
                healthy: false
            });
            return false;
        }
    }

    /**
     * 时间过滤器配置检查
     */
    async checkTimeFilterConfig() {
        console.log('\n⏰ 时间过滤器检查...');
        
        try {
            const OptimizedTimeFilter = require('./optimized_time_filter');
            const timeFilter = new OptimizedTimeFilter();
            const timeInfo = timeFilter.calculateOptimalTimeWindow();
            
            console.log(`   ✅ 时间窗口: ${timeInfo.windowHours} 小时`);
            console.log(`   ✅ 窗口原因: ${timeInfo.reason || '标准模式'}`);
            
            this.results.details.push({
                category: 'Time Filter',
                windowHours: timeInfo.windowHours,
                reason: timeInfo.reason,
                lastRun: timeInfo.lastRun,
                healthy: timeInfo.windowHours >= 2
            });

            return timeInfo.windowHours >= 2;
        } catch (error) {
            console.log(`   ❌ 时间过滤器检查失败: ${error.message}`);
            this.results.details.push({
                category: 'Time Filter',
                error: error.message,
                healthy: false
            });
            return false;
        }
    }

    /**
     * Web服务器健康检查
     */
    async checkWebServer() {
        console.log('\n🌐 Web服务器检查...');
        
        try {
            const result = await this.curlCheck('http://localhost:8080', { timeout: 5000 });
            if (result.success) {
                console.log(`   ✅ Web服务器: 正常响应 (${result.status})`);
                this.results.details.push({
                    category: 'Web Server',
                    status: 'HEALTHY',
                    port: 8080,
                    response: result.status
                });
                return true;
            } else {
                console.log(`   ⚠️ Web服务器: ${result.error}`);
                this.results.details.push({
                    category: 'Web Server',
                    status: 'DOWN',
                    error: result.error
                });
                return false;
            }
        } catch (error) {
            console.log(`   ❌ Web服务器: 检查失败 - ${error.message}`);
            this.results.details.push({
                category: 'Web Server',
                status: 'ERROR',
                error: error.message
            });
            return false;
        }
    }

    /**
     * 执行完整的系统诊断
     */
    async runFullDiagnostic() {
        console.log('🚀 系统健康诊断开始...');
        console.log('═'.repeat(50));

        const checks = [
            { name: 'Network Connectivity', fn: () => this.checkNetworkConnectivity() },
            { name: 'URL Files', fn: () => this.checkUrlFiles() },
            { name: 'History Database', fn: () => this.checkHistoryDatabase() },
            { name: 'Time Filter Config', fn: () => this.checkTimeFilterConfig() },
            { name: 'System Processes', fn: () => this.checkSystemProcesses() },
            { name: 'Web Server', fn: () => this.checkWebServer() }
        ];

        for (const check of checks) {
            try {
                const result = await check.fn();
                if (result) {
                    this.results.passed++;
                } else {
                    this.results.failed++;
                }
            } catch (error) {
                console.log(`   ❌ ${check.name}: 检查异常 - ${error.message}`);
                this.results.failed++;
                this.results.warnings++;
            }
        }

        this.generateSummary();
        return this.results;
    }

    /**
     * 生成诊断摘要
     */
    generateSummary() {
        console.log('\n' + '═'.repeat(50));
        console.log('📊 系统诊断摘要:');
        console.log(`   ✅ 通过检查: ${this.results.passed}`);
        console.log(`   ❌ 失败检查: ${this.results.failed}`);
        console.log(`   ⚠️ 警告数量: ${this.results.warnings}`);

        const healthScore = Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100);
        console.log(`   📈 健康评分: ${healthScore}%`);

        if (healthScore >= 80) {
            console.log('🎉 系统状态: 良好');
        } else if (healthScore >= 60) {
            console.log('⚠️ 系统状态: 需要关注');
        } else {
            console.log('🚨 系统状态: 需要修复');
        }

        // 保存详细报告
        const reportPath = 'system_diagnostic_report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            healthScore: healthScore,
            summary: {
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings
            },
            details: this.results.details
        }, null, 2));

        console.log(`📄 详细报告已保存: ${reportPath}`);
        console.log('═'.repeat(50));
    }

    // 辅助方法
    async curlCheck(url, options = {}) {
        return new Promise((resolve) => {
            const timeout = options.timeout || 10000;
            const cmd = `curl -I --max-time ${timeout/1000} "${url}"`;
            
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: error.message });
                } else {
                    const statusMatch = stdout.match(/HTTP\/[\d\.]+\s+(\d+)/);
                    if (statusMatch) {
                        const status = parseInt(statusMatch[1]);
                        resolve({ 
                            success: status >= 200 && status < 400, 
                            status: status,
                            error: status >= 400 ? `HTTP ${status}` : null
                        });
                    } else {
                        resolve({ success: false, error: 'Invalid response' });
                    }
                }
            });
        });
    }

    async execPromise(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    extractPid(psOutput) {
        const lines = psOutput.trim().split('\n');
        const pids = [];
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                pids.push(parts[1]);
            }
        });
        return pids.join(', ');
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    const diagnostic = new SystemDiagnostic();

    async function runDiagnostic() {
        try {
            if (args.includes('--quick')) {
                console.log('🔍 快速检查模式...');
                await diagnostic.checkUrlFiles();
                await diagnostic.checkHistoryDatabase();
                await diagnostic.checkWebServer();
            } else {
                await diagnostic.runFullDiagnostic();
            }
        } catch (error) {
            console.error('❌ 诊断执行失败:', error.message);
            process.exit(1);
        }
    }

    runDiagnostic();
}

module.exports = SystemDiagnostic;