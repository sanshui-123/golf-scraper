#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 系统性能瓶颈分析\n');

// 分析控制器日志
function analyzeControllerLogs() {
    const logsDir = './controller_logs';
    const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .sort()
        .slice(-3); // 最新的3个文件

    let totalRewriteTime = 0;
    let rewriteCount = 0;
    let apiResponseTimes = [];
    let processingTimes = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
        const lines = content.split('\n');

        lines.forEach(line => {
            // API响应时间
            const apiMatch = line.match(/API平均响应时间:\s*(\d+\.?\d*)/);
            if (apiMatch) {
                apiResponseTimes.push(parseFloat(apiMatch[1]));
            }

            // 改写时间
            const rewriteMatch = line.match(/改写完成.*耗时:\s*(\d+)秒/);
            if (rewriteMatch) {
                totalRewriteTime += parseInt(rewriteMatch[1]);
                rewriteCount++;
            }

            // 平均处理时间
            const avgMatch = line.match(/平均处理时间:\s*(\d+)秒/);
            if (avgMatch) {
                processingTimes.push(parseInt(avgMatch[1]));
            }
        });
    });

    return {
        avgRewriteTime: rewriteCount > 0 ? Math.round(totalRewriteTime / rewriteCount) : 0,
        rewriteCount,
        avgApiResponseTime: apiResponseTimes.length > 0 ? 
            Math.round(apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length) : 0,
        avgProcessingTime: processingTimes.length > 0 ?
            Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length) : 0
    };
}

// 分析Web服务器日志（筛选时间）
function analyzeFilteringTime() {
    const webLog = './web_server.log';
    if (!fs.existsSync(webLog)) return { avgFilterTime: 0 };

    const content = fs.readFileSync(webLog, 'utf8');
    const lines = content.split('\n').slice(-1000); // 最后1000行

    let filterTimes = [];
    lines.forEach(line => {
        // 查找筛选相关的时间记录
        if (line.includes('Filter check') && line.includes('ms')) {
            const match = line.match(/(\d+)ms/);
            if (match) {
                filterTimes.push(parseInt(match[1]));
            }
        }
    });

    return {
        avgFilterTime: filterTimes.length > 0 ?
            Math.round(filterTimes.reduce((a, b) => a + b, 0) / filterTimes.length) : 0,
        filterCount: filterTimes.length
    };
}

// 分析处理统计
function analyzeProcessingStats() {
    const statsFiles = ['processing_status.json', 'master_history_database.json'];
    let stats = {
        totalProcessed: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        todayProcessed: 0
    };

    statsFiles.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (data.articles) {
                    stats.totalProcessed = Object.keys(data.articles).length;
                    Object.values(data.articles).forEach(article => {
                        if (article.status === 'completed') stats.totalSuccessful++;
                        else if (article.status === 'failed') stats.totalFailed++;
                    });
                }
            } catch (e) {}
        }
    });

    // 今日处理数
    const today = new Date().toISOString().split('T')[0];
    const todayDir = `./golf_content/${today}/wechat_ready`;
    if (fs.existsSync(todayDir)) {
        stats.todayProcessed = fs.readdirSync(todayDir).filter(f => f.endsWith('.md')).length;
    }

    return stats;
}

// 执行分析
console.log('📊 控制器性能分析：');
const controllerStats = analyzeControllerLogs();
console.log(`  • 平均API响应时间: ${controllerStats.avgApiResponseTime}秒`);
console.log(`  • 平均改写时间: ${controllerStats.avgRewriteTime}秒`);
console.log(`  • 平均总处理时间: ${controllerStats.avgProcessingTime}秒/篇`);
console.log(`  • 已改写文章数: ${controllerStats.rewriteCount}篇`);

console.log('\n🔍 筛选性能分析：');
const filterStats = analyzeFilteringTime();
console.log(`  • 平均筛选时间: ${filterStats.avgFilterTime}ms`);
console.log(`  • 筛选次数: ${filterStats.filterCount}次`);

console.log('\n📈 处理统计：');
const processStats = analyzeProcessingStats();
console.log(`  • 总处理文章: ${processStats.totalProcessed}篇`);
console.log(`  • 成功: ${processStats.totalSuccessful}篇`);
console.log(`  • 失败: ${processStats.totalFailed}篇`);
console.log(`  • 今日完成: ${processStats.todayProcessed}篇`);

console.log('\n🎯 性能瓶颈分析：');
const apiTimePercent = Math.round((controllerStats.avgApiResponseTime / controllerStats.avgProcessingTime) * 100);
const rewriteTimePercent = Math.round((controllerStats.avgRewriteTime / controllerStats.avgProcessingTime) * 100);

console.log(`  • API调用占比: ${apiTimePercent}% (${controllerStats.avgApiResponseTime}秒/${controllerStats.avgProcessingTime}秒)`);
console.log(`  • 改写处理占比: ${rewriteTimePercent}% (${controllerStats.avgRewriteTime}秒/${controllerStats.avgProcessingTime}秒)`);
console.log(`  • 其他时间占比: ${100 - apiTimePercent - rewriteTimePercent}%`);

console.log('\n💡 结论：');
if (apiTimePercent > 50) {
    console.log('  ⚠️ API响应时间是主要瓶颈！');
    console.log(`  • 当前API响应时间(${controllerStats.avgApiResponseTime}秒)远超正常值(10-20秒)`);
    console.log('  • 建议检查Claude API状态或减少并发');
} else if (rewriteTimePercent > 40) {
    console.log('  ⚠️ 改写处理时间较长');
    console.log('  • 可能是文章内容过长或复杂');
} else {
    console.log('  ✅ 系统运行基本正常');
}

if (filterStats.avgFilterTime < 100) {
    console.log('  ✅ 筛选速度正常（<100ms）');
} else {
    console.log(`  ⚠️ 筛选速度较慢（${filterStats.avgFilterTime}ms）`);
}