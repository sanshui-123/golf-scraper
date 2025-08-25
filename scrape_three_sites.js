#!/usr/bin/env node

/**
 * 抓取三个高尔夫网站的最新文章
 */

const fs = require('fs');
const path = require('path');

// 网站RSS/抓取配置
const siteConfigs = {
    'golf.com': {
        method: 'discover',
        script: 'discover_recent_articles.js',
        args: ['golf.com', '10', '--ignore-time']
    },
    'golfmonthly.com': {
        method: 'discover',
        script: 'discover_recent_articles.js',
        args: ['golfmonthly.com', '10', '--ignore-time']
    },
    'mygolfspy.com': {
        method: 'rss',
        script: 'process_mygolfspy_rss.js',
        args: []
    }
};

async function scrapeAllSites() {
    console.log('🏌️ 开始抓取三个高尔夫网站的最新文章...\n');
    
    const { spawn } = require('child_process');
    
    for (const [site, config] of Object.entries(siteConfigs)) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📰 正在抓取 ${site}...`);
        console.log(`${'='.repeat(60)}\n`);
        
        await new Promise((resolve) => {
            const child = spawn('node', [config.script, ...config.args], {
                stdio: 'inherit',
                cwd: __dirname
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`\n✅ ${site} 抓取完成！`);
                } else {
                    console.log(`\n❌ ${site} 抓取失败，退出码: ${code}`);
                }
                resolve();
            });
            
            child.on('error', (err) => {
                console.error(`\n❌ ${site} 执行错误:`, err);
                resolve();
            });
        });
        
        // 等待一下，避免太快
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n\n🎉 所有网站抓取完成！');
    console.log('📱 访问 http://localhost:8080 查看所有文章');
}

// 运行抓取
scrapeAllSites().catch(console.error);