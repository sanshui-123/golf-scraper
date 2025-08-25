#!/usr/bin/env node

/**
 * 完成剩余文章的处理
 * 小批量处理，确保稳定性
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查已处理的文章数
function getProcessedCount() {
    const dir = path.join(__dirname, 'golf_content', '2025-07-24', 'wechat_ready');
    if (!fs.existsSync(dir)) return 0;
    
    const files = fs.readdirSync(dir);
    const articleFiles = files.filter(f => f.match(/^wechat_article_\d+\.md$/));
    return articleFiles.length;
}

// 执行命令
async function runCommand(command, args, description) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 ${description}`);
        console.log(`${'='.repeat(50)}\n`);
        
        const child = spawn(command, args, {
            stdio: 'inherit',
            cwd: __dirname
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ ${description} 完成`);
            } else {
                console.log(`\n⚠️ ${description} 退出码: ${code}`);
            }
            resolve(code);
        });
        
        child.on('error', (err) => {
            console.error(`\n❌ ${description} 错误:`, err.message);
            resolve(-1);
        });
    });
}

// 主函数
async function main() {
    const startCount = getProcessedCount();
    console.log('📊 开始时已处理文章数:', startCount);
    
    // 小批量处理MyGolfSpy
    console.log('\n📰 处理MyGolfSpy剩余文章...');
    await runCommand('node', ['process_mygolfspy_rss.js', 'process', '3'], 'MyGolfSpy RSS处理（3篇）');
    
    // 休息5秒
    console.log('\n⏳ 休息5秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 处理GolfWRX
    console.log('\n📰 处理GolfWRX文章...');
    await runCommand('node', ['process_golfwrx.js', 'process', '3'], 'GolfWRX处理（3篇）');
    
    // 休息5秒
    console.log('\n⏳ 休息5秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 处理Golf Digest（如果需要）
    console.log('\n📰 处理Golf Digest文章...');
    await runCommand('node', ['discover_golfdigest_articles.js', '3', '--ignore-time', '--auto-process'], 'Golf Digest处理（3篇）');
    
    // 最终统计
    const endCount = getProcessedCount();
    console.log('\n' + '='.repeat(50));
    console.log('📊 处理完成统计');
    console.log('='.repeat(50));
    console.log(`  开始时: ${startCount} 篇`);
    console.log(`  现在: ${endCount} 篇`);
    console.log(`  新增: ${endCount - startCount} 篇`);
    console.log('\n🌐 查看结果: http://localhost:8080');
    console.log('\n✨ 所有任务完成！');
}

// 运行
if (require.main === module) {
    main().catch(console.error);
}