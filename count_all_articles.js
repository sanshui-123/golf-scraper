#!/usr/bin/env node

/**
 * 统计三个网站所有未处理的文章数量
 * 包括已处理和未处理的统计
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 网站配置
const siteConfigs = {
    'golf.com': {
        name: 'Golf.com',
        script: 'discover_recent_articles.js',
        args: ['https://golf.com', '50', '--ignore-time', '--urls-only']
    },
    'golfmonthly.com': {
        name: 'Golf Monthly',
        script: 'discover_recent_articles.js',
        args: ['https://www.golfmonthly.com', '50', '--ignore-time', '--urls-only']
    },
    'mygolfspy.com': {
        name: 'MyGolfSpy',
        script: 'process_mygolfspy_rss.js',
        args: ['list', '20']
    }
};

// 获取已处理的文章
function getProcessedArticles() {
    const processed = new Set();
    
    // 从article_urls.json读取已处理的URL
    const dateStr = new Date().toISOString().split('T')[0];
    const urlMapFile = path.join(__dirname, 'golf_content', dateStr, 'article_urls.json');
    
    if (fs.existsSync(urlMapFile)) {
        try {
            const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            Object.values(urlMapping).forEach(url => processed.add(url));
        } catch (e) {
            console.warn('读取article_urls.json失败:', e.message);
        }
    }
    
    // 从failed_articles.json读取已尝试处理的URL
    const failedFile = path.join(__dirname, 'failed_articles.json');
    if (fs.existsSync(failedFile)) {
        try {
            const failedData = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
            Object.keys(failedData).forEach(url => {
                if (url.startsWith('http')) {
                    processed.add(url);
                }
            });
        } catch (e) {
            console.warn('读取failed_articles.json失败:', e.message);
        }
    }
    
    return processed;
}

// 运行网站发现脚本
async function runSiteDiscovery(siteName, config) {
    return new Promise((resolve) => {
        console.log(`📊 正在扫描 ${config.name}...`);
        
        let output = '';
        const child = spawn('node', [config.script, ...config.args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        child.on('close', (code) => {
            const urls = [];
            
            if (siteName === 'mygolfspy.com') {
                // 从MyGolfSpy的输出中提取URL
                const lines = output.split('\n');
                lines.forEach(line => {
                    if (line.startsWith('https://mygolfspy.com/')) {
                        urls.push(line.trim());
                    }
                });
            } else {
                // 从Golf.com和GolfMonthly的输出中提取URL
                const lines = output.split('\n');
                lines.forEach(line => {
                    if (line.startsWith('https://')) {
                        urls.push(line.trim());
                    }
                });
            }
            
            console.log(`✅ ${config.name}: 发现 ${urls.length} 篇文章`);
            resolve({
                siteName,
                urls,
                success: code === 0
            });
        });
        
        child.on('error', (err) => {
            console.error(`❌ ${config.name} 扫描失败:`, err.message);
            resolve({
                siteName,
                urls: [],
                success: false
            });
        });
    });
}

// 主函数
async function main() {
    console.log('🔍 开始统计三个网站的文章数量...\n');
    
    // 获取已处理的文章
    console.log('📋 正在读取已处理的文章列表...');
    const processedArticles = getProcessedArticles();
    console.log(`✅ 已处理文章: ${processedArticles.size} 篇\n`);
    
    // 扫描所有网站
    const promises = Object.entries(siteConfigs).map(([siteName, config]) => 
        runSiteDiscovery(siteName, config)
    );
    
    const results = await Promise.all(promises);
    
    // 统计结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 三个网站文章统计报告');
    console.log('='.repeat(60));
    
    let totalDiscovered = 0;
    let totalNew = 0;
    let totalProcessed = 0;
    
    results.forEach(result => {
        const config = siteConfigs[result.siteName];
        const discovered = result.urls.length;
        const newArticles = result.urls.filter(url => !processedArticles.has(url)).length;
        const processed = result.urls.filter(url => processedArticles.has(url)).length;
        
        console.log(`\n🌐 ${config.name}:`);
        console.log(`   📄 发现文章: ${discovered} 篇`);
        console.log(`   🆕 未处理: ${newArticles} 篇`);
        console.log(`   ✅ 已处理: ${processed} 篇`);
        console.log(`   📈 处理率: ${discovered > 0 ? ((processed / discovered) * 100).toFixed(1) : 0}%`);
        
        if (!result.success) {
            console.log(`   ⚠️  扫描遇到问题`);
        }
        
        totalDiscovered += discovered;
        totalNew += newArticles;
        totalProcessed += processed;
    });
    
    console.log(`\n📈 总计统计:`);
    console.log(`   📄 总发现文章: ${totalDiscovered} 篇`);
    console.log(`   🆕 总未处理: ${totalNew} 篇`);
    console.log(`   ✅ 总已处理: ${totalProcessed} 篇`);
    console.log(`   📊 整体处理率: ${totalDiscovered > 0 ? ((totalProcessed / totalDiscovered) * 100).toFixed(1) : 0}%`);
    
    // 建议
    console.log('\n💡 建议:');
    if (totalNew > 0) {
        console.log(`   🚀 运行 "node auto_scrape_three_sites.js" 处理 ${totalNew} 篇未处理文章`);
    } else {
        console.log(`   ✨ 所有文章都已处理完成！`);
    }
    
    console.log(`   🌐 访问 http://localhost:8080 查看已处理的文章`);
    console.log('='.repeat(60));
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };