#!/usr/bin/env node

/**
 * 清理失败文章记录
 * 分析失败原因并提供优化建议
 */

const fs = require('fs');
const path = require('path');

// 读取失败文章记录
const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
const backupPath = path.join(__dirname, `failed_articles_backup_${Date.now()}.json`);

if (!fs.existsSync(failedArticlesPath)) {
    console.log('❌ failed_articles.json 文件不存在');
    process.exit(1);
}

// 备份原文件
fs.copyFileSync(failedArticlesPath, backupPath);
console.log(`✅ 已备份到: ${backupPath}`);

// 读取数据
const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));

// 分析失败原因
const reasonStats = {};
const invalidUrls = [];
const validFailures = [];

// 分类处理每个失败记录
for (const [url, data] of Object.entries(failedArticles)) {
    const reason = data.reason || '未知原因';
    
    // 统计失败原因
    const reasonKey = reason.split(':')[0].trim();
    reasonStats[reasonKey] = (reasonStats[reasonKey] || 0) + 1;
    
    // 识别无效URL（以#开头或包含注释）
    if (url.startsWith('#') || url.includes('生成时间') || url.includes('URL数量') || 
        url.includes('来源:') || !url.startsWith('http')) {
        invalidUrls.push(url);
    } else {
        // 保留有效的失败记录，但过滤掉某些可以重试的
        if (reason.includes('Claude返回空内容') || 
            reason.includes('Network timeout') ||
            reason.includes('ECONNRESET') ||
            reason.includes('ETIMEDOUT')) {
            // 这些是临时性错误，不需要永久保存
            continue;
        }
        validFailures.push({ url, data });
    }
}

// 统计信息
console.log('\n📊 失败原因统计:');
const sortedReasons = Object.entries(reasonStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

for (const [reason, count] of sortedReasons) {
    console.log(`  ${reason}: ${count}次`);
}

console.log(`\n🔍 分析结果:`);
console.log(`  总失败记录: ${Object.keys(failedArticles).length}`);
console.log(`  无效URL: ${invalidUrls.length}`);
console.log(`  有效失败: ${validFailures.length}`);
console.log(`  可重试的临时错误: ${Object.keys(failedArticles).length - invalidUrls.length - validFailures.length}`);

// 创建清理后的失败记录
const cleanedFailures = {};
for (const { url, data } of validFailures) {
    cleanedFailures[url] = data;
}

// 写回清理后的数据
fs.writeFileSync(failedArticlesPath, JSON.stringify(cleanedFailures, null, 2));
console.log(`\n✅ 已清理失败记录，从 ${Object.keys(failedArticles).length} 条减少到 ${Object.keys(cleanedFailures).length} 条`);

// 生成优化建议
console.log('\n🎯 优化建议:');
console.log('1. URL文件处理: 需要在batch_process_articles.js中过滤掉#开头的行');
console.log('2. Claude改写: 增加重试机制，处理空内容返回');
console.log('3. 网络错误: 实现指数退避重试策略');
console.log('4. 404错误: 在抓取前预检URL有效性');
console.log('5. contentSize错误: 修复抓取逻辑中的变量定义问题');
