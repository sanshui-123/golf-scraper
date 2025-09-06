#!/usr/bin/env node
/**
 * 日志清理器 - 防止磁盘空间耗尽
 * 功能：
 * 1. 清理超过指定天数的日志文件
 * 2. 压缩大型日志文件
 * 3. 监控磁盘使用情况
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class LogCleaner {
    constructor() {
        this.retentionDays = parseInt(process.env.RETENTION_DAYS || 7);
        this.maxLogSize = process.env.MAX_LOG_SIZE || '1G';
        this.logDirs = [
            './logs',
            './controller_logs',
            './golf_content',  // 旧文章目录
            '~/.claude/hooks/logs'  // Claude hooks日志
        ];
        
        this.patterns = {
            logs: /\.(log|txt)$/i,
            temp: /\.(tmp|temp|cache)$/i,
            old: /\.(old|bak|backup)$/i
        };
    }
    
    async run() {
        console.log(`🧹 日志清理器启动 - ${new Date().toLocaleString()}`);
        console.log(`📋 配置: 保留${this.retentionDays}天, 最大${this.maxLogSize}`);
        
        try {
            // 1. 检查磁盘空间
            await this.checkDiskSpace();
            
            // 2. 清理日志文件
            for (const dir of this.logDirs) {
                await this.cleanDirectory(dir);
            }
            
            // 3. 清理临时文件
            await this.cleanTempFiles();
            
            // 4. 压缩大文件
            await this.compressLargeFiles();
            
            // 5. 清理旧的文章数据（30天以上）
            await this.cleanOldArticles();
            
            console.log('✅ 日志清理完成');
        } catch (error) {
            console.error('❌ 清理失败:', error);
            process.exit(1);
        }
    }
    
    async checkDiskSpace() {
        try {
            const { stdout } = await execPromise('df -h . | tail -1');
            const parts = stdout.trim().split(/\s+/);
            const usage = parseInt(parts[4]);
            
            console.log(`💾 磁盘使用率: ${usage}%`);
            
            if (usage > 90) {
                console.warn('⚠️ 磁盘使用率超过90%！执行紧急清理...');
                this.retentionDays = 3;  // 紧急模式：只保留3天
            } else if (usage > 80) {
                console.warn('⚠️ 磁盘使用率超过80%，减少保留天数...');
                this.retentionDays = 5;  // 警告模式：保留5天
            }
        } catch (error) {
            console.warn('⚠️ 无法检查磁盘空间:', error.message);
        }
    }
    
    async cleanDirectory(dirPath) {
        try {
            const resolvedPath = dirPath.startsWith('~') 
                ? path.join(process.env.HOME, dirPath.slice(1))
                : dirPath;
                
            const stats = await fs.stat(resolvedPath);
            if (!stats.isDirectory()) return;
            
            console.log(`📁 清理目录: ${dirPath}`);
            const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
            
            await this.processDirectory(resolvedPath, cutoffTime);
        } catch (error) {
            console.log(`⏭️ 跳过不存在的目录: ${dirPath}`);
        }
    }
    
    async processDirectory(dirPath, cutoffTime) {
        const entries = await fs.readdir(dirPath);
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            
            try {
                const stats = await fs.stat(fullPath);
                
                if (stats.isDirectory()) {
                    // 递归处理子目录
                    await this.processDirectory(fullPath, cutoffTime);
                } else if (stats.isFile()) {
                    // 检查文件
                    if (stats.mtime.getTime() < cutoffTime && this.isLogFile(entry)) {
                        console.log(`🗑️ 删除旧日志: ${entry}`);
                        await fs.unlink(fullPath);
                    } else if (stats.size > this.parseSize('100M') && this.isLogFile(entry)) {
                        // 压缩大文件
                        await this.compressFile(fullPath);
                    }
                }
            } catch (error) {
                console.error(`❌ 处理文件失败 ${fullPath}:`, error.message);
            }
        }
    }
    
    isLogFile(filename) {
        return this.patterns.logs.test(filename) || 
               this.patterns.temp.test(filename) ||
               this.patterns.old.test(filename);
    }
    
    async compressFile(filePath) {
        try {
            const gzPath = `${filePath}.gz`;
            console.log(`🗜️ 压缩大文件: ${path.basename(filePath)}`);
            
            await execPromise(`gzip -c "${filePath}" > "${gzPath}"`);
            await fs.unlink(filePath);
            
            console.log(`✅ 已压缩: ${path.basename(gzPath)}`);
        } catch (error) {
            console.error(`❌ 压缩失败:`, error.message);
        }
    }
    
    async cleanTempFiles() {
        console.log('🗑️ 清理临时文件...');
        
        // 清理各种临时文件
        const tempPatterns = [
            'retry_urls_*.txt',
            'failed_urls_*.txt',
            'emergency_urls_*.txt',
            'force_retry_urls_*.txt',
            'truly_pending_urls_*.txt'
        ];
        
        for (const pattern of tempPatterns) {
            try {
                await execPromise(`find . -name "${pattern}" -mtime +${this.retentionDays} -delete`);
            } catch (error) {
                // 忽略错误
            }
        }
    }
    
    async cleanOldArticles() {
        const articlesDir = './golf_content';
        const cutoffDays = 30;  // 保留30天的文章
        
        try {
            const dates = await fs.readdir(articlesDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
            
            for (const dateDir of dates) {
                // 解析日期格式 YYYY-MM-DD
                const match = dateDir.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!match) continue;
                
                const dirDate = new Date(match[1], parseInt(match[2]) - 1, match[3]);
                
                if (dirDate < cutoffDate) {
                    const fullPath = path.join(articlesDir, dateDir);
                    console.log(`🗑️ 删除旧文章目录: ${dateDir}`);
                    await execPromise(`rm -rf "${fullPath}"`);
                }
            }
        } catch (error) {
            console.log('⏭️ 跳过文章清理:', error.message);
        }
    }
    
    async compressLargeFiles() {
        // 查找并压缩大型JSON文件
        const largeJsonFiles = [
            'master_history_database.json',
            'failed_articles.json',
            'processing_status.json'
        ];
        
        for (const file of largeJsonFiles) {
            try {
                const stats = await fs.stat(file);
                if (stats.size > this.parseSize('50M')) {
                    // 备份并重新初始化
                    const backupName = `${file}.${new Date().toISOString().split('T')[0]}.bak`;
                    console.log(`📦 备份大文件: ${file} -> ${backupName}`);
                    
                    await fs.rename(file, backupName);
                    await execPromise(`gzip "${backupName}"`);
                    
                    // 创建新的空文件
                    await fs.writeFile(file, file.endsWith('.json') ? '{}' : '');
                }
            } catch (error) {
                // 忽略不存在的文件
            }
        }
    }
    
    parseSize(sizeStr) {
        const units = { K: 1024, M: 1024*1024, G: 1024*1024*1024 };
        const match = sizeStr.match(/^(\d+)([KMG])$/i);
        
        if (!match) return parseInt(sizeStr) || 0;
        
        return parseInt(match[1]) * (units[match[2].toUpperCase()] || 1);
    }
}

// 运行清理器
if (require.main === module) {
    const cleaner = new LogCleaner();
    cleaner.run();
}