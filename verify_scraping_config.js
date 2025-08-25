#!/usr/bin/env node

/**
 * 🔍 抓取配置验证脚本
 * 验证关键抓取规则配置是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证抓取配置...\n');

// 验证关键文件存在性
const keyFiles = [
    'optimized_time_filter.js',
    'discover_recent_articles.js', 
    'STABLE_optimized_time_filter.js',
    'STABLE_discover_recent_articles.js',
    'SCRAPING_RULES_STABLE_CONFIG.md'
];

console.log('📁 检查关键文件:');
keyFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - 文件缺失！`);
    }
});

// 验证时间过滤器配置
console.log('\n⏰ 检查时间过滤器配置:');
try {
    const timeFilterContent = fs.readFileSync('optimized_time_filter.js', 'utf8');
    
    // 检查Golf Monthly配置
    if (timeFilterContent.includes("'golfmonthly.com': { \n                normal: 18,")) {
        console.log('   ✅ Golf Monthly时间窗口配置正确 (18小时)');
    } else {
        console.log('   ❌ Golf Monthly时间窗口配置错误！');
    }
    
    // 检查域名传递逻辑
    if (timeFilterContent.includes('Math.max(\n                    this.options.minimumWindowHours,\n                    highFreqHours')) {
        console.log('   ✅ 高频模式算法修复正确');
    } else {
        console.log('   ❌ 高频模式算法可能被误改！');
    }
    
} catch (e) {
    console.log('   ❌ 无法读取时间过滤器配置文件');
}

// 验证域名传递配置  
console.log('\n🌐 检查域名传递配置:');
try {
    const discoverContent = fs.readFileSync('discover_recent_articles.js', 'utf8');
    
    if (discoverContent.includes('const urlObj = new URL(homepageUrl);\n                    const websiteDomain = urlObj.hostname;\n                    const timeFilter = new OptimizedTimeFilter({ websiteDomain });')) {
        console.log('   ✅ 域名传递逻辑配置正确');
    } else {
        console.log('   ❌ 域名传递逻辑可能被误改！');
    }
    
} catch (e) {
    console.log('   ❌ 无法读取文章发现器配置文件');
}

// 检查备份文件完整性
console.log('\n💾 检查备份完整性:');
try {
    const originalSize = fs.statSync('optimized_time_filter.js').size;
    const backupSize = fs.statSync('STABLE_optimized_time_filter.js').size;
    
    if (Math.abs(originalSize - backupSize) < 100) {
        console.log('   ✅ 时间过滤器备份文件完整');
    } else {
        console.log('   ⚠️ 备份文件可能不是最新版本');
    }
} catch (e) {
    console.log('   ❌ 备份文件检查失败');
}

// 检查修复指导原则
console.log('\n📋 检查指导原则:');
try {
    const claudeMdContent = fs.readFileSync('CLAUDE.md', 'utf8');
    const configContent = fs.readFileSync('SCRAPING_RULES_STABLE_CONFIG.md', 'utf8');
    
    if (claudeMdContent.includes('第一优先级**: 保持抓取规则不变') && 
        configContent.includes('避免浪费时间**:')) {
        console.log('   ✅ 修复策略指导原则已添加');
    } else {
        console.log('   ❌ 修复策略指导原则缺失！');
    }
    
} catch (e) {
    console.log('   ❌ 无法检查指导原则');
}

console.log('\n🎯 配置验证完成！');
console.log('如果发现任何❌标记，请检查SCRAPING_RULES_STABLE_CONFIG.md文档');