#!/usr/bin/env node

/**
 * 顺序处理所有网站，确保流程不中断
 * 分批处理策略，避免超时
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 处理配置
const processingSteps = [
    {
        name: '处理前3个网站 (Golf.com, Golf Monthly, Golf Digest)',
        command: 'node',
        args: ['auto_scrape_three_sites.js'],
        timeout: 600000 // 10分钟
    },
    {
        name: '处理MyGolfSpy (RSS源)',
        command: 'node',
        args: ['process_mygolfspy_rss.js', 'process', '10'],
        timeout: 300000 // 5分钟
    },
    {
        name: '处理GolfWRX',
        command: 'node', 
        args: ['process_golfwrx.js', 'process', '10'],
        timeout: 300000 // 5分钟
    }
];

// 日志文件
const logFile = path.join(__dirname, `sequential_process_${Date.now()}.log`);

// 写入日志
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(logFile, logMessage);
}

// 执行单个步骤
async function executeStep(step, index) {
    return new Promise((resolve) => {
        log(`\n${'='.repeat(70)}`);
        log(`🚀 步骤 ${index + 1}/${processingSteps.length}: ${step.name}`);
        log(`${'='.repeat(70)}\n`);
        
        const startTime = Date.now();
        let processOutput = '';
        
        const child = spawn(step.command, step.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        // 设置超时
        const timeout = setTimeout(() => {
            log(`⚠️ 步骤超时，强制终止进程`);
            child.kill('SIGTERM');
        }, step.timeout);
        
        // 收集输出
        child.stdout.on('data', (data) => {
            const text = data.toString();
            process.stdout.write(text);
            processOutput += text;
            fs.appendFileSync(logFile, text);
        });
        
        child.stderr.on('data', (data) => {
            const text = data.toString();
            process.stderr.write(text);
            processOutput += text;
            fs.appendFileSync(logFile, text);
        });
        
        child.on('close', (code) => {
            clearTimeout(timeout);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            if (code === 0) {
                log(`\n✅ ${step.name} 完成！耗时: ${duration}秒\n`);
            } else {
                log(`\n⚠️ ${step.name} 退出码: ${code}，耗时: ${duration}秒`);
                log(`⚠️ 继续执行下一步...\n`);
            }
            
            resolve({ success: code === 0, output: processOutput });
        });
        
        child.on('error', (err) => {
            clearTimeout(timeout);
            log(`\n❌ ${step.name} 执行错误: ${err.message}\n`);
            resolve({ success: false, error: err.message });
        });
    });
}

// 主函数
async function main() {
    log('🏌️ 开始顺序处理所有高尔夫网站');
    log(`📝 日志文件: ${logFile}`);
    log(`📅 开始时间: ${new Date().toLocaleString()}\n`);
    
    const results = [];
    const startTime = Date.now();
    
    // 顺序执行每个步骤
    for (let i = 0; i < processingSteps.length; i++) {
        const step = processingSteps[i];
        
        try {
            const result = await executeStep(step, i);
            results.push({
                step: step.name,
                success: result.success,
                error: result.error
            });
            
            // 步骤之间休息5秒
            if (i < processingSteps.length - 1) {
                log('⏳ 休息5秒后继续下一步...\n');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            log(`❌ 步骤执行异常: ${error.message}`);
            results.push({
                step: step.name,
                success: false,
                error: error.message
            });
        }
    }
    
    // 显示最终统计
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    
    log('\n' + '='.repeat(70));
    log('📊 处理完成统计');
    log('='.repeat(70));
    
    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '⚠️';
        log(`${icon} ${result.step}`);
        if (result.error) {
            log(`   错误: ${result.error}`);
        }
    });
    
    log(`\n⏱️ 总耗时: ${Math.floor(totalDuration / 60)}分${totalDuration % 60}秒`);
    log(`📝 详细日志: ${logFile}`);
    log(`🌐 查看结果: http://localhost:8080`);
    log('\n✨ 所有处理步骤已完成！');
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
    log(`❌ 未处理的Promise拒绝: ${reason}`);
});

process.on('uncaughtException', (error) => {
    log(`❌ 未捕获的异常: ${error.message}`);
    process.exit(1);
});

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        log(`❌ 主函数执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main };