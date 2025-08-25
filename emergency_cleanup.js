#!/usr/bin/env node

/**
 * 🚨 紧急资源清理工具
 * 
 * 解决当前系统中卡住的浏览器进程和僵死任务
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EmergencyCleanup {
    async performFullCleanup() {
        console.log('🚨 开始紧急系统清理...\n');
        
        try {
            // 1. 清理浏览器进程
            await this.cleanupBrowserProcesses();
            
            // 2. 清理卡住的任务
            await this.cleanupStuckTasks();
            
            // 3. 重置处理状态
            await this.resetProcessingState();
            
            // 4. 清理临时文件
            await this.cleanupTempFiles();
            
            console.log('\n✅ 紧急清理完成！系统已准备好重新运行');
            
        } catch (error) {
            console.error('❌ 清理过程中出错:', error.message);
        }
    }
    
    async cleanupBrowserProcesses() {
        console.log('🔧 清理浏览器进程...');
        
        try {
            // 统计当前浏览器进程
            const browserProcesses = execSync('ps aux | grep -E "(chrome|playwright)" | grep -v grep', { encoding: 'utf8' });
            const processLines = browserProcesses.trim().split('\n').filter(line => line.trim());
            
            console.log(`   发现 ${processLines.length} 个浏览器相关进程`);
            
            if (processLines.length > 0) {
                // 温和终止
                console.log('   尝试温和终止进程...');
                try {
                    execSync('pkill -f "chrome|playwright"', { stdio: 'ignore' });
                    await this.sleep(3000);
                } catch (e) {
                    // 忽略错误
                }
                
                // 检查是否还有残留
                const remainingProcesses = execSync('ps aux | grep -E "(chrome|playwright)" | grep -v grep | wc -l', { encoding: 'utf8' });
                const remainingCount = parseInt(remainingProcesses.trim());
                
                if (remainingCount > 0) {
                    console.log(`   强制终止剩余 ${remainingCount} 个进程...`);
                    try {
                        execSync('pkill -9 -f "chrome|playwright"', { stdio: 'ignore' });
                    } catch (e) {
                        // 忽略错误
                    }
                }
            }
            
            console.log('   ✅ 浏览器进程清理完成');
            
        } catch (error) {
            console.log('   ⚠️ 浏览器进程清理时出现错误（可忽略）');
        }
    }
    
    async cleanupStuckTasks() {
        console.log('🔧 清理卡住的任务状态...');
        
        const urlMapFile = path.join('golf_content', '2025-08-02', 'article_urls.json');
        
        if (fs.existsSync(urlMapFile)) {
            try {
                const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                let changedCount = 0;
                
                // 将所有 processing 和 retrying 状态改为 pending
                for (const [key, value] of Object.entries(urlMapping)) {
                    if (value.status === 'processing' || value.status === 'retrying') {
                        urlMapping[key] = {
                            ...value,
                            status: 'pending',
                            resetAt: new Date().toISOString(),
                            resetReason: 'emergency_cleanup'
                        };
                        changedCount++;
                    }
                }
                
                if (changedCount > 0) {
                    fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                    console.log(`   ✅ 重置了 ${changedCount} 个卡住的任务状态`);
                } else {
                    console.log('   ✅ 没有发现卡住的任务');
                }
                
            } catch (error) {
                console.log('   ⚠️ 任务状态文件处理失败:', error.message);
            }
        } else {
            console.log('   ✅ 未发现任务状态文件');
        }
    }
    
    async resetProcessingState() {
        console.log('🔧 重置处理状态...');
        
        try {
            // 清理检查点文件
            const checkpointFiles = ['checkpoint_*.json', 'emergency_checkpoint_*.json'];
            
            for (const pattern of checkpointFiles) {
                try {
                    const files = execSync(`ls ${pattern} 2>/dev/null || true`, { encoding: 'utf8' });
                    if (files.trim()) {
                        execSync(`rm -f ${pattern}`);
                        console.log(`   清理检查点文件: ${pattern}`);
                    }
                } catch (e) {
                    // 忽略
                }
            }
            
            // 清理缓存文件
            const cacheFile = path.join('golf_content', '.max_article_number');
            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile);
                console.log('   清理编号缓存文件');
            }
            
            console.log('   ✅ 处理状态重置完成');
            
        } catch (error) {
            console.log('   ⚠️ 状态重置时出现错误:', error.message);
        }
    }
    
    async cleanupTempFiles() {
        console.log('🔧 清理临时文件...');
        
        try {
            // 清理临时重写文件
            const tempFiles = execSync('ls temp_*.txt 2>/dev/null || true', { encoding: 'utf8' });
            if (tempFiles.trim()) {
                execSync('rm -f temp_*.txt');
                console.log('   清理临时重写文件');
            }
            
            // 清理批次文件
            const batchFiles = execSync('ls temp_batch_*.txt 2>/dev/null || true', { encoding: 'utf8' });
            if (batchFiles.trim()) {
                execSync('rm -f temp_batch_*.txt');
                console.log('   清理批次文件');
            }
            
            console.log('   ✅ 临时文件清理完成');
            
        } catch (error) {
            console.log('   ⚠️ 临时文件清理时出现错误:', error.message);
        }
    }
    
    async reportSystemStatus() {
        console.log('\n📊 清理后系统状态:');
        
        try {
            // 浏览器进程统计
            const browserCount = execSync('ps aux | grep -E "(chrome|playwright)" | grep -v grep | wc -l', { encoding: 'utf8' });
            console.log(`   浏览器进程: ${browserCount.trim()} 个`);
            
            // 文件句柄统计
            try {
                const fileHandles = execSync('lsof | grep -E "(chrome|playwright)" | wc -l 2>/dev/null || echo "0"', { encoding: 'utf8' });
                console.log(`   浏览器文件句柄: ${fileHandles.trim()} 个`);
            } catch (e) {
                console.log('   浏览器文件句柄: 无法检测');
            }
            
            // 处理状态统计
            const urlMapFile = path.join('golf_content', '2025-08-02', 'article_urls.json');
            if (fs.existsSync(urlMapFile)) {
                const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                const statusCounts = {};
                
                for (const entry of Object.values(urlMapping)) {
                    statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
                }
                
                console.log('   任务状态分布:');
                for (const [status, count] of Object.entries(statusCounts)) {
                    console.log(`     ${status}: ${count} 个`);
                }
            }
            
        } catch (error) {
            console.log('   ⚠️ 系统状态检测失败:', error.message);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 执行清理
if (require.main === module) {
    const cleanup = new EmergencyCleanup();
    
    cleanup.performFullCleanup()
        .then(() => cleanup.reportSystemStatus())
        .then(() => {
            console.log('\n🚀 系统已准备就绪，可以重新运行批处理器');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 紧急清理失败:', error);
            process.exit(1);
        });
}

module.exports = EmergencyCleanup;