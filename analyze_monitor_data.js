#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== 高尔夫文章系统监控数据分析 ===\n');

// 1. 检查今日文章
const today = new Date().toISOString().split('T')[0];
const todayPath = path.join(__dirname, 'golf_content', today, 'wechat_ready');
let todayArticles = 0;
let articleFiles = [];

if (fs.existsSync(todayPath)) {
    articleFiles = fs.readdirSync(todayPath).filter(f => f.endsWith('.md'));
    todayArticles = articleFiles.length;
}

console.log(`📊 今日文章数: ${todayArticles} 篇`);

// 2. 统计各网站文章
const sites = {
    'Golf.com': 0,
    'Golf Monthly': 0,
    'MyGolfSpy': 0,
    'GolfWRX': 0,
    'Golf Digest': 0,
    "Today's Golfer": 0,
    'Golfweek': 0,
    'National Club Golfer': 0
};

// AI检测统计
let aiStats = {
    total: 0,
    detected: 0,
    avgProbability: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0
};
let totalProbability = 0;

for (const file of articleFiles) {
    try {
        const content = fs.readFileSync(path.join(todayPath, file), 'utf8');
        
        // 统计网站来源
        const urlMatch = content.match(/\[查看原文\]\((.*?)\)|原文链接：\[.*?\]\((.*?)\)/);
        if (urlMatch) {
            const url = urlMatch[1] || urlMatch[2];
            if (url.includes('golf.com')) sites['Golf.com']++;
            else if (url.includes('golfmonthly.com')) sites['Golf Monthly']++;
            else if (url.includes('mygolfspy.com')) sites['MyGolfSpy']++;
            else if (url.includes('golfwrx.com')) sites['GolfWRX']++;
            else if (url.includes('golfdigest.com')) sites['Golf Digest']++;
            else if (url.includes('todays-golfer.com')) sites["Today's Golfer"]++;
            else if (url.includes('golfweek')) sites['Golfweek']++;
            else if (url.includes('nationalclubgolfer.com')) sites['National Club Golfer']++;
        }
        
        // 提取AI检测信息
        const aiMatch = content.match(/<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([\d\s:-]+)\s*-->/);
        if (aiMatch) {
            aiStats.total++;
            const probability = parseInt(aiMatch[1]);
            totalProbability += probability;
            
            if (probability >= 80) aiStats.highRisk++;
            else if (probability >= 50) aiStats.mediumRisk++;
            else aiStats.lowRisk++;
            
            if (probability > 40) aiStats.detected++;
        }
    } catch (e) {
        console.error(`读取文章失败: ${file}`);
    }
}

if (aiStats.total > 0) {
    aiStats.avgProbability = Math.round(totalProbability / aiStats.total);
}

console.log('\n📈 网站文章分布:');
for (const [site, count] of Object.entries(sites)) {
    if (count > 0) {
        console.log(`   ${site}: ${count} 篇`);
    }
}

console.log('\n🤖 AI检测统计:');
console.log(`   检测总数: ${aiStats.total}/${todayArticles} 篇`);
console.log(`   需要重写: ${aiStats.detected} 篇 (>40%)`);
console.log(`   平均AI率: ${aiStats.avgProbability}%`);
console.log(`   高风险(≥80%): ${aiStats.highRisk} 篇`);
console.log(`   中风险(50-79%): ${aiStats.mediumRisk} 篇`);
console.log(`   低风险(<50%): ${aiStats.lowRisk} 篇`);

// 3. 检查URL文件
console.log('\n📂 URL文件统计:');
const urlFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('deep_urls_') && f.endsWith('.txt'));
for (const file of urlFiles) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const urls = content.split('\n').filter(line => line.trim() && line.startsWith('https://'));
        console.log(`   ${file}: ${urls.length} 个URL`);
    } catch (e) {
        console.log(`   ${file}: 读取失败`);
    }
}

// 4. 检查article_urls.json
try {
    const articleUrls = JSON.parse(fs.readFileSync('article_urls.json', 'utf8'));
    const stats = {
        processing: 0,
        processed: 0,
        rewritten: 0,
        skipped: 0,
        error: 0
    };
    
    for (const [url, data] of Object.entries(articleUrls)) {
        if (data.status === 'processing') stats.processing++;
        else if (data.status === 'processed') stats.processed++;
        else if (data.status === 'rewritten') stats.rewritten++;
        else if (data.status === 'skipped') stats.skipped++;
        else if (data.status === 'error') stats.error++;
    }
    
    console.log('\n📋 文章状态统计:');
    console.log(`   处理中: ${stats.processing}`);
    console.log(`   已处理: ${stats.processed}`);
    console.log(`   已重写: ${stats.rewritten}`);
    console.log(`   已跳过: ${stats.skipped}`);
    console.log(`   错误: ${stats.error}`);
    console.log(`   总计: ${Object.keys(articleUrls).length} 条记录`);
} catch (e) {
    console.log('\n⚠️ 无法读取article_urls.json');
}

// 5. 检查异常值
console.log('\n🚨 数据异常检查:');
let anomalies = [];

// 检查文章编号连续性
const articleNumbers = articleFiles
    .map(f => {
        const match = f.match(/wechat_article_(\d+)\.md/);
        return match ? parseInt(match[1]) : null;
    })
    .filter(n => n !== null)
    .sort((a, b) => a - b);

if (articleNumbers.length > 0) {
    const gaps = [];
    for (let i = 1; i < articleNumbers.length; i++) {
        if (articleNumbers[i] - articleNumbers[i-1] > 1) {
            gaps.push(`${articleNumbers[i-1]}-${articleNumbers[i]}`);
        }
    }
    if (gaps.length > 0) {
        anomalies.push(`文章编号不连续: ${gaps.join(', ')}`);
    }
}

// 检查URL与文章数量的匹配
const totalUrls = urlFiles.reduce((sum, file) => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        return sum + content.split('\n').filter(line => line.trim() && line.startsWith('https://')).length;
    } catch (e) {
        return sum;
    }
}, 0);

if (totalUrls > 0 && todayArticles === 0) {
    anomalies.push(`有${totalUrls}个URL但没有生成文章`);
}

// 检查AI检测覆盖率
const aiCoverage = aiStats.total / todayArticles * 100;
if (todayArticles > 0 && aiCoverage < 50) {
    anomalies.push(`AI检测覆盖率低: ${aiCoverage.toFixed(1)}%`);
}

if (anomalies.length > 0) {
    anomalies.forEach(a => console.log(`   ⚠️ ${a}`));
} else {
    console.log('   ✅ 未发现明显异常');
}

console.log('\n=== 分析完成 ===');