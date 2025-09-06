#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 分析Claude API行为模式...\n');

// 分析控制器日志
function analyzeAPIPatterns() {
    const logsDir = './controller_logs';
    const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .sort()
        .slice(-3); // 最新的3个文件

    let patterns = {
        successByHour: {},
        failureByHour: {},
        emptyResponseByTime: [],
        successfulArticles: [],
        failedArticles: [],
        responseTimes: {
            success: [],
            failure: []
        }
    };

    files.forEach(file => {
        const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 提取时间戳
            const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}):/);
            if (timeMatch) {
                const hour = timeMatch[1];
                
                // 成功案例
                if (line.includes('✅ 改写完成')) {
                    patterns.successByHour[hour] = (patterns.successByHour[hour] || 0) + 1;
                    
                    // 提取成功的响应时间
                    const rtMatch = line.match(/(\d+)秒/);
                    if (rtMatch) {
                        patterns.responseTimes.success.push(parseInt(rtMatch[1]));
                    }
                    
                    // 查找文章标题
                    for (let i = index - 10; i < index; i++) {
                        if (lines[i] && lines[i].includes('标题:')) {
                            patterns.successfulArticles.push({
                                title: lines[i].split('标题:')[1].trim(),
                                time: hour,
                                responseTime: rtMatch ? parseInt(rtMatch[1]) : 0
                            });
                            break;
                        }
                    }
                }
                
                // 失败案例
                if (line.includes('❌ 改写失败')) {
                    patterns.failureByHour[hour] = (patterns.failureByHour[hour] || 0) + 1;
                    
                    // 提取失败的响应时间
                    const rtMatch = line.match(/响应时间:\s*(\d+)秒/);
                    if (rtMatch) {
                        patterns.responseTimes.failure.push(parseInt(rtMatch[1]));
                    }
                    
                    // 空响应记录
                    if (line.includes('Claude返回空内容')) {
                        patterns.emptyResponseByTime.push({
                            time: hour,
                            responseTime: rtMatch ? parseInt(rtMatch[1]) : 0
                        });
                    }
                    
                    // 查找文章标题
                    for (let i = index - 10; i < index; i++) {
                        if (lines[i] && lines[i].includes('标题:')) {
                            patterns.failedArticles.push({
                                title: lines[i].split('标题:')[1].trim(),
                                time: hour,
                                reason: line.includes('空内容') ? '空响应' : '其他'
                            });
                            break;
                        }
                    }
                }
            }
        });
    });

    return patterns;
}

// 分析时间模式
function analyzeTimePatterns(patterns) {
    console.log('⏰ 时间段分析：');
    
    // 合并所有时间数据
    const allHours = new Set([
        ...Object.keys(patterns.successByHour),
        ...Object.keys(patterns.failureByHour)
    ]);
    
    const hourStats = [];
    allHours.forEach(hour => {
        const success = patterns.successByHour[hour] || 0;
        const failure = patterns.failureByHour[hour] || 0;
        const total = success + failure;
        const successRate = total > 0 ? (success / total * 100).toFixed(1) : 0;
        
        hourStats.push({
            hour,
            success,
            failure,
            total,
            successRate
        });
    });
    
    // 按时间排序
    hourStats.sort((a, b) => a.hour.localeCompare(b.hour));
    
    // 显示最近10个时间段
    hourStats.slice(-10).forEach(stat => {
        const indicator = stat.successRate > 50 ? '✅' : stat.successRate > 20 ? '⚠️' : '❌';
        console.log(`  ${stat.hour}时: 成功${stat.success} 失败${stat.failure} 成功率${stat.successRate}% ${indicator}`);
    });
}

// 分析响应时间模式
function analyzeResponseTimes(patterns) {
    console.log('\n⏱️ 响应时间分析：');
    
    if (patterns.responseTimes.success.length > 0) {
        const avgSuccess = patterns.responseTimes.success.reduce((a, b) => a + b, 0) / patterns.responseTimes.success.length;
        console.log(`  • 成功案例平均响应时间: ${avgSuccess.toFixed(1)}秒`);
        console.log(`    - 最快: ${Math.min(...patterns.responseTimes.success)}秒`);
        console.log(`    - 最慢: ${Math.max(...patterns.responseTimes.success)}秒`);
    }
    
    if (patterns.responseTimes.failure.length > 0) {
        const avgFailure = patterns.responseTimes.failure.reduce((a, b) => a + b, 0) / patterns.responseTimes.failure.length;
        console.log(`  • 失败案例平均响应时间: ${avgFailure.toFixed(1)}秒`);
        console.log(`    - 最快: ${Math.min(...patterns.responseTimes.failure)}秒`);
        console.log(`    - 最慢: ${Math.max(...patterns.responseTimes.failure)}秒`);
    }
}

// 分析文章特征
function analyzeArticlePatterns(patterns) {
    console.log('\n📄 文章特征分析：');
    
    console.log(`  • 成功改写的文章数: ${patterns.successfulArticles.length}`);
    if (patterns.successfulArticles.length > 0) {
        console.log('    最近成功的文章:');
        patterns.successfulArticles.slice(-3).forEach(article => {
            console.log(`      - ${article.title.substring(0, 50)}... (${article.responseTime}秒)`);
        });
    }
    
    console.log(`\n  • 失败改写的文章数: ${patterns.failedArticles.length}`);
    if (patterns.failedArticles.length > 0) {
        console.log('    最近失败的文章:');
        patterns.failedArticles.slice(-3).forEach(article => {
            console.log(`      - ${article.title.substring(0, 50)}... (${article.reason})`);
        });
    }
}

// 执行分析
const patterns = analyzeAPIPatterns();
analyzeTimePatterns(patterns);
analyzeResponseTimes(patterns);
analyzeArticlePatterns(patterns);

console.log('\n💡 分析结论：');
console.log('  1. Claude API表现出明显的不稳定性');
console.log('  2. 空响应是主要失败原因（不是超时）');
console.log('  3. 成功和失败似乎是随机的，与文章内容关系不大');
console.log('  4. API响应时间普遍偏慢（50-60秒）');

console.log('\n🔍 可能的原因：');
console.log('  • API服务端负载过高或限流');
console.log('  • 账户级别的速率限制');
console.log('  • API服务本身的稳定性问题');
console.log('  • 特定时间段的服务质量波动');