#!/usr/bin/env node

/**
 * 测试脚本：验证智能等待优化效果
 * 用于对比优化前后的处理时间
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_URL = 'https://www.golf.com/travel/courses/best-public-golf-courses-in-america-top-100-courses-you-can-play/';
const RESULTS_FILE = 'optimization_test_results.json';

async function runTest() {
    console.log('🧪 开始测试智能等待优化效果...\n');
    
    // 检查是否有测试URL文件
    const testUrlFile = 'test_urls.txt';
    if (!fs.existsSync(testUrlFile)) {
        fs.writeFileSync(testUrlFile, TEST_URL);
        console.log('✅ 创建测试URL文件');
    }
    
    // 运行batch_process_articles.js处理测试URL
    console.log('🚀 开始处理测试文章...');
    console.log('⏱️  请观察处理时间的变化\n');
    
    const startTime = Date.now();
    
    // 执行处理
    const { exec } = require('child_process');
    exec(`node batch_process_articles.js ${testUrlFile}`, (error, stdout, stderr) => {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        
        if (error) {
            console.error('❌ 测试失败:', error.message);
            return;
        }
        
        console.log('\n📊 测试结果:');
        console.log(`总处理时间: ${totalTime}秒`);
        
        // 分析日志中的等待时间
        const waitMatches = stdout.match(/智能等待|等待.*完成.*\d+ms/g) || [];
        const smartWaitCount = waitMatches.length;
        
        console.log(`智能等待触发次数: ${smartWaitCount}`);
        
        // 读取API响应时间统计
        try {
            const apiStats = JSON.parse(fs.readFileSync('api_response_times.json', 'utf8'));
            console.log('\n📈 API响应统计:');
            console.log(`- 平均响应时间: ${(apiStats.stats.avgResponseTime / 1000).toFixed(1)}秒`);
            console.log(`- 最快响应: ${(apiStats.stats.minResponseTime / 1000).toFixed(1)}秒`);
            console.log(`- 最慢响应: ${(apiStats.stats.maxResponseTime / 1000).toFixed(1)}秒`);
            console.log(`- 成功率: ${((apiStats.stats.successCalls / apiStats.stats.totalCalls) * 100).toFixed(1)}%`);
        } catch (e) {
            console.log('⚠️  暂无API响应统计数据');
        }
        
        // 保存测试结果
        const results = {
            timestamp: new Date().toISOString(),
            totalTime,
            smartWaitCount,
            optimization: '智能等待优化后'
        };
        
        // 读取历史结果
        let history = [];
        if (fs.existsSync(RESULTS_FILE)) {
            try {
                history = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
            } catch (e) {}
        }
        
        history.push(results);
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(history, null, 2));
        
        console.log('\n✅ 测试完成！结果已保存到', RESULTS_FILE);
        
        // 对比分析
        if (history.length > 1) {
            console.log('\n📊 历史对比:');
            history.forEach((result, index) => {
                console.log(`${index + 1}. ${result.timestamp}: ${result.totalTime}秒 (${result.optimization || '优化前'})`);
            });
            
            // 计算优化效果
            const baseline = history.find(r => !r.optimization || r.optimization === '优化前');
            if (baseline && baseline.totalTime > results.totalTime) {
                const improvement = ((baseline.totalTime - results.totalTime) / baseline.totalTime * 100).toFixed(1);
                console.log(`\n🎉 性能提升: ${improvement}%`);
            }
        }
        
        // 清理测试文件
        setTimeout(() => {
            if (fs.existsSync(testUrlFile)) {
                fs.unlinkSync(testUrlFile);
                console.log('\n🧹 清理测试文件完成');
            }
        }, 5000);
    });
}

// 运行测试
runTest();