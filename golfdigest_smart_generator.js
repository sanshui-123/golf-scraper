#!/usr/bin/env node

/**
 * Golf Digest智能URL生成器
 * 混合策略：优先使用原版脚本，超时后使用快速版
 */

const { spawn } = require('child_process');
const path = require('path');

async function runWithTimeout(scriptPath, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const urls = [];
        const child = spawn('node', [scriptPath, ...args]);
        
        let timeoutId = setTimeout(() => {
            child.kill();
            reject(new Error('超时'));
        }, timeoutMs);
        
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                if (line.startsWith('https://')) {
                    urls.push(line);
                }
            });
        });
        
        child.on('close', (code) => {
            clearTimeout(timeoutId);
            if (code === 0) {
                resolve(urls);
            } else {
                reject(new Error(`进程退出代码: ${code}`));
            }
        });
        
        child.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    const limit = args.find(arg => !isNaN(parseInt(arg))) || '20';
    
    console.error('🔄 Golf Digest智能URL生成器启动...');
    
    try {
        // 第一步：尝试原版脚本，30秒超时
        console.error('📋 尝试使用原版抓取器...');
        const urls = await runWithTimeout(
            path.join(__dirname, 'discover_golfdigest_articles.js'),
            [limit, '--urls-only'],
            30000  // 30秒超时
        );
        
        if (urls.length > 0) {
            console.error(`✅ 成功获取 ${urls.length} 个真实URL`);
            urls.forEach(url => console.log(url));
            return;
        }
    } catch (error) {
        console.error('⚠️ 原版脚本失败:', error.message);
    }
    
    // 第二步：使用快速版作为后备
    console.error('🚀 切换到快速版生成器...');
    try {
        const urls = await runWithTimeout(
            path.join(__dirname, 'golfdigest_fast_url_generator.js'),
            [limit, '--urls-only'],
            30000  // 30秒超时
        );
        
        urls.forEach(url => console.log(url));
    } catch (error) {
        console.error('❌ 快速版也失败了，返回默认URL');
        // 最后的保底
        console.log('https://www.golfdigest.com/');
    }
}

if (require.main === module) {
    main();
}