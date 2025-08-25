#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * 检查AI检测状态
 */

function checkAIDetectionStatus() {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('golf_content', today, 'wechat_ready');
    
    console.log('🤖 AI检测状态检查');
    console.log(`📁 目录: ${todayDir}`);
    console.log('\n');
    
    try {
        // 获取所有md文件
        const files = glob.sync(path.join(todayDir, '*.md'));
        
        if (files.length === 0) {
            console.log('⚠️  没有找到今日的文章');
            return;
        }
        
        let detected = 0;
        let undetected = 0;
        const undetectedFiles = [];
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('<!-- AI检测:')) {
                detected++;
            } else {
                undetected++;
                undetectedFiles.push(path.basename(file));
            }
        }
        
        console.log(`📊 统计结果：`);
        console.log(`   总计：${files.length} 篇`);
        console.log(`   ✅ 已检测：${detected} 篇`);
        console.log(`   ⚠️  未检测：${undetected} 篇`);
        console.log(`   🎯 检测率：${((detected / files.length) * 100).toFixed(1)}%`);
        
        if (undetected > 0) {
            console.log('\n📄 未检测的文件：');
            undetectedFiles.forEach(file => {
                console.log(`   - ${file}`);
            });
        }
        
        // 检查是否有AI检测进程在运行
        const { execSync } = require('child_process');
        try {
            const processes = execSync('ps aux | grep ai_content_detector | grep -v grep', { encoding: 'utf8' });
            if (processes.trim()) {
                console.log('\n🚀 AI检测进程正在运行：');
                console.log(processes);
            }
        } catch (e) {
            // 没有找到进程
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 运行检查
checkAIDetectionStatus();
