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
        this.maxRetries = 1;        // 最大重试次数（改为1，即不重试）
        this.retryDelay = 10000;    // 重试间隔（10秒）
        this.timeout = 180000;      // 单次超时时间（3分钟）
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 单次改写尝试
     */
    async attemptRewrite(title, content, tempFile, attemptNum) {
        return new Promise((resolve, reject) => {
            const cmd = `cat "${this.promptFile}" "${tempFile}" | claude --dangerously-skip-permissions --print`;
            console.log(`  🔄 第${attemptNum}次尝试Claude改写...`);
            
            const startTime = Date.now();
            let progressInterval;
            let receivedData = false;
            
            // 显示等待进度
            progressInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                if (!receivedData) {
                    process.stdout.write(`\r     ⏳ 等待Claude响应... ${elapsed}秒`);
                }
            }, 1000);
            
            const proc = exec(cmd, { 
                maxBuffer: 20 * 1024 * 1024, // 20MB缓冲区
                timeout: this.timeout
            });
            
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            
            proc.stdout.on('data', data => {
                if (!receivedData) {
                    receivedData = true;
                    clearInterval(progressInterval);
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    process.stdout.write('\r' + ' '.repeat(50) + '\r');
                    console.log(`     📥 开始接收响应 (${elapsed}秒)`);
                }
                stdout += data;
                // 显示接收进度
                process.stdout.write(`\r     📥 已接收: ${stdout.length} 字符`);
            });
            proc.stderr.on('data', data => stderr += data);
            
            // 超时处理
            const timer = setTimeout(() => {
                timedOut = true;
                clearInterval(progressInterval);
                if (!proc.killed) {
                    proc.kill();
                    process.stdout.write('\r' + ' '.repeat(50) + '\r');
                    reject(new Error(`Claude改写超时（${this.timeout/1000}秒）`));
                }
            }, this.timeout);
            
            proc.on('exit', (code) => {
                clearTimeout(timer);
                clearInterval(progressInterval);
                process.stdout.write('\r' + ' '.repeat(50) + '\r');
                
                if (timedOut) return;
                
                if (code !== 0) {
                    // 检测常见错误
                    if (stderr.includes('API') || stderr.includes('rate limit') || stderr.includes('error')) {
                        reject(new Error(`API调用失败: ${stderr}`));
                    } else {
                        reject(new Error(`Claude执行失败 (代码${code}): ${stderr || '未知错误'}`));
                    }
                    return;
                }
                
                if (!stdout.trim()) {
                    reject(new Error('Claude返回空内容'));
                    return;
                }
                
                // 验证输出是否包含中文
                const hasChineseChars = /[\u4e00-\u9fa5]/.test(stdout);
                if (!hasChineseChars) {
                    reject(new Error('改写结果不包含中文内容'));
                    return;
                }
                
                const totalTime = Math.round((Date.now() - startTime) / 1000);
                console.log(`     ✅ 改写完成 (总计${totalTime}秒，输出${stdout.length}字符)`);
                resolve(stdout.trim());
            });
            
            proc.on('error', (err) => {
                clearTimeout(timer);
                clearInterval(progressInterval);
                process.stdout.write('\r' + ' '.repeat(50) + '\r');
                reject(new Error(`执行命令失败: ${err.message}`));
            });
        });
    }

    /**
     * 改写文章（带重试机制）
     * @param {string} title - 文章标题
     * @param {string} content - 文章内容（可包含图片占位符）
     * @returns {Promise<string>} - 改写后的中文内容
     */
    async rewriteArticle(title, content) {
        const tempFile = path.join(__dirname, `temp_rewrite_${Date.now()}.txt`);
        
        try {
            // 写入临时文件
            fs.writeFileSync(tempFile, `**标题**: ${title}\n\n**内容**:\n${content}`, 'utf8');
            
            // 尝试改写，最多重试maxRetries次
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                try {
                    const result = await this.attemptRewrite(title, content, tempFile, attempt);
                    console.log(`  ✅ 第${attempt}次尝试成功`);
                    return result;
                    
                } catch (error) {
                    console.error(`  ❌ 第${attempt}次尝试失败: ${error.message}`);
                    
                    if (attempt < this.maxRetries) {
                        console.log(`  ⏳ ${this.retryDelay/1000}秒后重试...`);
                        await this.sleep(this.retryDelay);
                    } else {
                        // 不重试，直接失败
                        throw new Error(`Claude改写失败: ${error.message}`);
                    }
                }
            }
            
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
}

module.exports = ArticleRewriterEnhanced;