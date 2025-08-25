#!/usr/bin/env node

/**
 * 测试多网站支持功能
 */

const fs = require('fs');
const path = require('path');

// 加载网站配置
const websiteConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, 'website_configs.json'), 'utf8'));

console.log('📋 已配置的网站:');
console.log('================');

Object.entries(websiteConfigs).forEach(([domain, config]) => {
    console.log(`\n🌐 ${config.name} (${domain})`);
    console.log(`   主页: ${config.homepage || 'https://www.' + domain + '/'}`);
    console.log(`   文章模式: ${config.articlePatterns ? config.articlePatterns.join(', ') : '未配置'}`);
    console.log(`   列表选择器: ${config.articleListSelectors ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   内容选择器: ${config.selectors ? '✅ 已配置' : '❌ 未配置'}`);
});

console.log('\n📝 使用示例:');
console.log('================');
console.log('1. 扫描单个网站: node discover_recent_articles.js https://www.golf.com/');
console.log('2. 扫描所有网站: node discover_recent_articles.js --all-sites');
console.log('3. 处理特定URL: node discover_recent_articles.js --urls "url1" "url2"');
console.log('4. 直接处理文章: node batch_process_articles.js (支持任何配置的网站URL)');

console.log('\n💡 特性说明:');
console.log('================');
console.log('- 自动识别网站并使用对应配置');
console.log('- 配置失败会自动使用通用抓取逻辑');
console.log('- 所有网站的文章都保存在同一个日期文件夹下');
console.log('- Web界面可以查看所有网站的文章');