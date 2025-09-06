#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 分析改写失败率...\n');

// 分析控制器日志
function analyzeControllerLogs() {
    const logsDir = './controller_logs';
    const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .sort()
        .slice(-3); // 最新的3个文件

    let stats = {
        totalAttempts: 0,
        totalSuccess: 0,
        totalFailed: 0,
        failureReasons: {
            emptyResponse: 0,
            noChineseContent: 0,
            timeout: 0,
            apiError: 0,
            other: 0
        }
    };

    files.forEach(file => {
        const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
        const lines = content.split('\n');

        lines.forEach(line => {
            // 成功统计
            if (line.includes('✅ 改写完成')) {
                stats.totalSuccess++;
                stats.totalAttempts++;
            }
            
            // 失败统计
            if (line.includes('❌ 改写失败')) {
                stats.totalFailed++;
                stats.totalAttempts++;
                
                // 分析失败原因
                if (line.includes('Claude返回空内容') || line.includes('空响应')) {
                    stats.failureReasons.emptyResponse++;
                } else if (line.includes('不包含中文内容')) {
                    stats.failureReasons.noChineseContent++;
                } else if (line.includes('超时')) {
                    stats.failureReasons.timeout++;
                } else if (line.includes('API错误')) {
                    stats.failureReasons.apiError++;
                } else {
                    stats.failureReasons.other++;
                }
            }

            // 成功/失败统计
            const statsMatch = line.match(/成功:\s*(\d+)篇\s*\|\s*失败:\s*(\d+)篇/);
            if (statsMatch) {
                const success = parseInt(statsMatch[1]);
                const failed = parseInt(statsMatch[2]);
                // 使用最新的统计数据
                stats.latestSuccess = success;
                stats.latestFailed = failed;
            }
        });
    });

    // 如果有最新统计，使用它
    if (stats.latestSuccess !== undefined) {
        stats.totalSuccess = stats.latestSuccess;
        stats.totalFailed = stats.latestFailed;
        stats.totalAttempts = stats.totalSuccess + stats.totalFailed;
    }

    return stats;
}

// 分析失败文章
function analyzeFailedArticles() {
    const failedFile = './failed_articles.json';
    if (!fs.existsSync(failedFile)) return { count: 0 };

    try {
        const data = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
        const failed = Object.values(data).filter(item => 
            item.status === 'failed' || item.failureCount > 0
        );
        
        return {
            count: failed.length,
            permanentFailed: failed.filter(item => item.failureCount >= 3).length,
            retryable: failed.filter(item => item.failureCount < 3).length
        };
    } catch (e) {
        return { count: 0 };
    }
}

// 执行分析
const stats = analyzeControllerLogs();
const failedArticles = analyzeFailedArticles();

console.log('📈 改写统计：');
console.log(`  • 总尝试: ${stats.totalAttempts}篇`);
console.log(`  • 成功: ${stats.totalSuccess}篇`);
console.log(`  • 失败: ${stats.totalFailed}篇`);
console.log(`  • 成功率: ${stats.totalAttempts > 0 ? (stats.totalSuccess / stats.totalAttempts * 100).toFixed(1) : 0}%`);
console.log(`  • 失败率: ${stats.totalAttempts > 0 ? (stats.totalFailed / stats.totalAttempts * 100).toFixed(1) : 0}%`);

console.log('\n❌ 失败原因分析：');
console.log(`  • Claude返回空内容: ${stats.failureReasons.emptyResponse}次`);
console.log(`  • 不包含中文内容: ${stats.failureReasons.noChineseContent}次`);
console.log(`  • 超时: ${stats.failureReasons.timeout}次`);
console.log(`  • API错误: ${stats.failureReasons.apiError}次`);
console.log(`  • 其他: ${stats.failureReasons.other}次`);

console.log('\n📁 失败文章库：');
console.log(`  • 总失败文章: ${failedArticles.count}篇`);
console.log(`  • 永久失败(3次+): ${failedArticles.permanentFailed}篇`);
console.log(`  • 可重试: ${failedArticles.retryable}篇`);

console.log('\n💡 分析结论：');
if (stats.totalAttempts > 0 && stats.totalFailed / stats.totalAttempts > 0.5) {
    console.log('  ⚠️ 失败率极高！主要问题是Claude API返回空内容。');
    console.log('  • 可能原因：');
    console.log('    - API服务不稳定');
    console.log('    - 请求频率过高触发限制');
    console.log('    - 文章内容导致API处理异常');
} else if (stats.totalAttempts > 0 && stats.totalFailed / stats.totalAttempts > 0.2) {
    console.log('  ⚠️ 失败率较高，需要关注。');
} else {
    console.log('  ✅ 失败率在可接受范围内。');
}