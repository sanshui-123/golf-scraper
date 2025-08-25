#!/usr/bin/env node

/**
 * 文章改写模块 - 增强版（包含重试机制）
 * 功能：使用Claude将英文高尔夫文章改写成中文，包含API失败重试
 * 警告：此文件为封装版本，禁止修改，只能调用！
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ArticleRewriterEnhanced {
    constructor() {
        this.promptFile = path.join(__dirname, 'golf_rewrite_prompt_turbo.txt');
        if (!fs.existsSync(this.promptFile)) {
            throw new Error('改写提示词文件不存在: golf_rewrite_prompt_turbo.txt');
        }
        
        // 重试配置
        this.maxRetries = 2;        // 最大重试次数（改为2，增加成功率）
        this.retryDelay = 20000;    // 重试间隔（20秒，给Claude更多恢复时间）
        this.fixedTimeout = 180000; // 固定3分钟超时
        this.enableDynamicTimeout = false; // 禁用动态超时
        
        // 添加Claude调用保护机制
        this.lastClaudeCall = 0;
        this.minClaudeInterval = 3000; // Claude调用最小间隔（3秒）
        
        // API响应时间记录
        this.apiResponseLogFile = path.join(__dirname, 'api_response_times.json');
        this.apiResponseTimes = this.loadApiResponseTimes();
        
        // 错误统计
        this.errorStats = {
            emptyResponses: 0,
            timeouts: 0,
            apiErrors: 0,
            lastErrorTime: 0
        };
    }
    
    /**
     * 加载API响应时间历史记录
     */
    loadApiResponseTimes() {
        try {
            if (fs.existsSync(this.apiResponseLogFile)) {
                return JSON.parse(fs.readFileSync(this.apiResponseLogFile, 'utf8'));
            }
        } catch (e) {
            console.log('⚠️ 无法加载API响应时间历史');
        }
        return {
            records: [],
            stats: {
                avgResponseTime: 30000,  // 默认30秒
                minResponseTime: null,
                maxResponseTime: null,
                totalCalls: 0,
                successCalls: 0,
                failedCalls: 0
            }
        };
    }
    
    /**
     * 记录API响应时间
     */
    recordApiResponse(responseTime, success, contentLength, error = null) {
        const record = {
            timestamp: new Date().toISOString(),
            responseTime,
            success,
            contentLength,
            error: error ? error.message : null
        };
        
        // 保留最近100条记录
        this.apiResponseTimes.records.push(record);
        if (this.apiResponseTimes.records.length > 100) {
            this.apiResponseTimes.records = this.apiResponseTimes.records.slice(-100);
        }
        
        // 更新统计信息
        const stats = this.apiResponseTimes.stats;
        stats.totalCalls++;
        
        if (success) {
            stats.successCalls++;
            
            // 计算成功调用的平均响应时间
            const successRecords = this.apiResponseTimes.records.filter(r => r.success);
            const avgTime = successRecords.reduce((sum, r) => sum + r.responseTime, 0) / successRecords.length;
            stats.avgResponseTime = Math.round(avgTime);
            
            // 更新最小/最大响应时间
            stats.minResponseTime = stats.minResponseTime ? Math.min(stats.minResponseTime, responseTime) : responseTime;
            stats.maxResponseTime = stats.maxResponseTime ? Math.max(stats.maxResponseTime, responseTime) : responseTime;
        } else {
            stats.failedCalls++;
        }
        
        // 保存到文件
        try {
            fs.writeFileSync(this.apiResponseLogFile, JSON.stringify(this.apiResponseTimes, null, 2));
        } catch (e) {
            // 静默失败，不影响主流程
        }
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    /**
     * 单次改写尝试（固定3分钟超时）
     */
    async attemptRewrite(title, content, tempFile, attemptNum) {
        const timeout = this.fixedTimeout; // 固定3分钟
        // Claude调用限流保护
        const now = Date.now();
        const timeSinceLastCall = now - this.lastClaudeCall;
        if (timeSinceLastCall < this.minClaudeInterval) {
            const waitTime = this.minClaudeInterval - timeSinceLastCall;
            console.log(`  ⏱️ 等待 ${(waitTime/1000).toFixed(1)} 秒后调用Claude（避免过频繁调用）`);
            await this.sleep(waitTime);
        }
        this.lastClaudeCall = Date.now();
        
        return new Promise((resolve, reject) => {
            const cmd = `cat "${this.promptFile}" "${tempFile}" | claude --dangerously-skip-permissions --print`;
            console.log(`  🔄 第${attemptNum}次尝试Claude改写... (限时3分钟)`);
            
            const startTime = Date.now();
            let progressInterval;
            let receivedData = false;
            let lastDataTime = Date.now();
            
            // 显示固定3分钟倒计时
            progressInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const remaining = Math.round((180 - elapsed));
                if (!receivedData) {
                    process.stdout.write(`\r     ⏳ 等待Claude响应... ${elapsed}秒 / 180秒 (剩余${remaining}秒)`);
                } else {
                    const dataElapsed = Math.round((Date.now() - lastDataTime) / 1000);
                    process.stdout.write(`\r     📥 接收数据中... ${elapsed}秒 / 180秒`);
                }
            }, 1000);
            
            const proc = exec(cmd, { 
                maxBuffer: 50 * 1024 * 1024 // 50MB缓冲区
            });
            
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            
            proc.stdout.on('data', data => {
                if (!receivedData) {
                    receivedData = true;
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    process.stdout.write('\r' + ' '.repeat(80) + '\r');
                    console.log(`     📥 开始接收响应 (${elapsed}秒)`);
                }
                lastDataTime = Date.now();
                stdout += data;
                
                // 显示接收进度
                const sizeInKB = (stdout.length / 1024).toFixed(1);
                process.stdout.write(`\r     📥 已接收: ${sizeInKB}KB`);
            });
            proc.stderr.on('data', data => stderr += data);
            
            // 设置超时已触发标志
            let timeoutTriggered = false;
            
            // 固定3分钟超时处理（无延长机制）
            const timer = setTimeout(() => {
                timeoutTriggered = true;
                timedOut = true;
                clearInterval(progressInterval);
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
                console.log(`     ❌ 改写超时（3分钟）`);
                
                // 强制终止进程
                if (proc && !proc.killed) {
                    try {
                        proc.kill('SIGTERM');
                        // 给进程一些时间正常退出
                        setTimeout(() => {
                            if (!proc.killed) {
                                proc.kill('SIGKILL');
                            }
                        }, 1000);
                    } catch (e) {
                        console.error(`     ⚠️ 无法终止进程: ${e.message}`);
                    }
                }
                
                // 记录超时错误并reject
                const timeoutError = new Error(`改写超时（3分钟）`);
                this.recordApiResponse(Date.now() - startTime, false, stdout.length, timeoutError);
                reject(timeoutError);
            }, timeout);
            
            proc.on('exit', (code) => {
                // 如果超时已经触发，不再处理
                if (timeoutTriggered) return;
                
                clearTimeout(timer);
                clearInterval(progressInterval);
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
                
                if (timedOut) return;
                
                if (code !== 0) {
                    // 检测常见错误
                    let error;
                    if (stderr.includes('API') || stderr.includes('rate limit') || stderr.includes('error')) {
                        error = new Error(`API调用失败: ${stderr}`);
                    } else {
                        error = new Error(`Claude执行失败 (代码${code}): ${stderr || '未知错误'}`);
                    }
                    this.recordApiResponse(Date.now() - startTime, false, stdout.length, error);
                    reject(error);
                    return;
                }
                
                if (!stdout.trim()) {
                    const responseTime = Date.now() - startTime;
                    const error = new Error(`Claude返回空内容 (响应时间: ${Math.round(responseTime/1000)}秒)`);
                    error.isEmptyResponse = true;
                    error.responseTime = responseTime;
                    this.recordApiResponse(responseTime, false, 0, error);
                    reject(error);
                    return;
                }
                
                // 验证输出是否包含中文
                const hasChineseChars = /[\u4e00-\u9fa5]/.test(stdout);
                if (!hasChineseChars) {
                    const error = new Error('改写结果不包含中文内容');
                    this.recordApiResponse(Date.now() - startTime, false, stdout.length, error);
                    reject(error);
                    return;
                }
                
                const totalTime = Math.round((Date.now() - startTime) / 1000);
                const responseTimeMs = Date.now() - startTime;
                console.log(`     ✅ 改写完成 (${totalTime}秒，${(stdout.length/1024).toFixed(1)}KB)`);
                
                // 记录成功的API响应
                this.recordApiResponse(responseTimeMs, true, stdout.length);
                
                resolve(stdout.trim());
            });
            
            proc.on('error', (err) => {
                // 如果超时已经触发，不再处理
                if (timeoutTriggered) return;
                
                clearTimeout(timer);
                clearInterval(progressInterval);
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
                
                const error = new Error(`执行命令失败: ${err.message}`);
                this.recordApiResponse(Date.now() - startTime, false, stdout.length, error);
                reject(error);
            });
        });
    }

    /**
     * 改写文章（带智能重试机制）
     * @param {string} title - 文章标题
     * @param {string} content - 文章内容（可包含图片占位符）
     * @returns {Promise<string>} - 改写后的中文内容
     */
    async rewriteArticle(title, content, url = null) {
        const tempFile = path.join(__dirname, `temp_rewrite_${Date.now()}.txt`);
        
        try {
            // 构建包含URL的内容
            let fileContent = `**标题**: ${title}\n\n`;
            if (url && url !== 'undefined' && url !== 'null' && url !== '无原文链接') {
                fileContent += `【原文URL】${url}\n\n`;
            }
            fileContent += `**内容**:\n${content}`;
            
            // 写入临时文件
            fs.writeFileSync(tempFile, fileContent, 'utf8');
            
            // 智能重试机制 - 增强版
            let lastError = null;
            let consecutiveFailures = 0;
            
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                try {
                    // 根据错误历史动态调整策略
                    if (this.errorStats.emptyResponses > 3) {
                        console.log(`  ⚠️ 检测到多次空响应，增加等待时间`);
                        await this.sleep(30000); // 额外等待30秒
                    }
                    
                    const result = await this.attemptRewrite(title, content, tempFile, attempt);
                    
                    // 成功后重置错误计数
                    this.errorStats.emptyResponses = 0;
                    consecutiveFailures = 0;
                    
                    console.log(`  ✅ 第${attempt}次尝试成功`);
                    return result;
                    
                } catch (error) {
                    lastError = error;
                    consecutiveFailures++;
                    
                    // 记录错误类型
                    if (error.message.includes('Claude返回空内容')) {
                        this.errorStats.emptyResponses++;
                    } else if (error.message.includes('超时')) {
                        this.errorStats.timeouts++;
                    } else if (error.message.includes('API')) {
                        this.errorStats.apiErrors++;
                    }
                    
                    console.error(`  ❌ 第${attempt}次尝试失败: ${error.message}`);
                    
                    if (attempt < this.maxRetries) {
                        // 智能等待时间计算
                        let waitTime = this.calculateSmartWaitTime(error, consecutiveFailures);
                        
                        console.log(`  ⏳ ${waitTime/1000}秒后重试...`);
                        await this.sleep(waitTime);
                    }
                }
            }
            
            // 所有重试都失败 - 增加详细错误信息
            const finalError = new Error(
                `改写失败 - ${lastError.message} | ` +
                `尝试次数: ${this.maxRetries} | ` +
                `错误统计: 空响应${this.errorStats.emptyResponses}次, ` +
                `超时${this.errorStats.timeouts}次, ` +
                `API错误${this.errorStats.apiErrors}次`
            );
            finalError.originalError = lastError;
            throw finalError;
            
        } finally {
            // 确保清理临时文件
            try { fs.unlinkSync(tempFile); } catch (e) {}
        }
    }

    /**
     * 测试Claude是否可用
     */
    async testClaude() {
        try {
            console.log('🔍 测试Claude是否可用...');
            const result = await new Promise((resolve, reject) => {
                exec('echo "Hello" | claude --dangerously-skip-permissions --print', (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Claude不可用: ${stderr || error.message}`));
                    } else {
                        resolve(true);
                    }
                });
            });
            console.log('✅ Claude可用');
            return true;
        } catch (error) {
            console.error('❌ Claude测试失败:', error.message);
            return false;
        }
    }
    
    /**
     * 智能等待时间计算
     * @param {Error} error - 错误对象
     * @param {number} consecutiveFailures - 连续失败次数
     * @returns {number} - 等待时间（毫秒）
     */
    calculateSmartWaitTime(error, consecutiveFailures) {
        let baseWait = this.retryDelay;
        
        // 根据错误类型调整
        if (error.message.includes('Claude返回空内容')) {
            baseWait = 45000; // 空内容等待45秒
        } else if (error.message.includes('超时')) {
            baseWait = 60000; // 超时等待60秒
        } else if (error.message.includes('rate limit')) {
            baseWait = 120000; // 速率限制等待2分钟
        }
        
        // 指数退避：连续失败次数越多，等待越久
        const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveFailures - 1), 4);
        
        // 加入随机因子，避免同步重试
        const jitter = Math.random() * 5000; // 0-5秒随机
        
        return Math.round(baseWait * backoffMultiplier + jitter);
    }
}

module.exports = ArticleRewriterEnhanced;