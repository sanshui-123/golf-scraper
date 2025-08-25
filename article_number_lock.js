#!/usr/bin/env node

/**
 * 文章编号锁机制
 * 解决并发处理时的编号冲突问题
 */

const fs = require('fs');
const path = require('path');

class ArticleNumberLock {
    constructor() {
        this.lockFile = path.join(process.cwd(), '.article_number.lock');
        this.timeout = 5000; // 5秒超时
    }

    /**
     * 获取锁（带重试机制）
     */
    async acquireLock(maxRetries = 10) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                // 尝试创建锁文件（exclusive模式）
                fs.writeFileSync(this.lockFile, `${process.pid}:${Date.now()}`, { flag: 'wx' });
                return true;
            } catch (err) {
                if (err.code === 'EEXIST') {
                    // 锁已存在，检查是否超时
                    try {
                        const content = fs.readFileSync(this.lockFile, 'utf8');
                        const [pid, timestamp] = content.split(':');
                        const lockAge = Date.now() - parseInt(timestamp);
                        
                        // 如果锁超过5秒，强制释放
                        if (lockAge > this.timeout) {
                            console.log(`⚠️ 检测到过期锁 (PID: ${pid}, 年龄: ${lockAge}ms)，强制释放`);
                            this.releaseLock();
                            continue;
                        }
                    } catch (e) {
                        // 读取失败，可能锁已被释放
                    }
                    
                    // 等待100ms后重试
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw err;
                }
            }
        }
        return false;
    }

    /**
     * 释放锁
     */
    releaseLock() {
        try {
            fs.unlinkSync(this.lockFile);
        } catch (err) {
            // 忽略删除失败（可能已被其他进程删除）
        }
    }

    /**
     * 带锁的文章编号获取
     */
    async getNextArticleNumberWithLock(baseDir) {
        const locked = await this.acquireLock();
        if (!locked) {
            throw new Error('无法获取文章编号锁，请稍后重试');
        }

        try {
            // 在锁保护下获取下一个编号
            const wechatDir = path.join(baseDir, 'wechat_ready');
            const wechatHtmlDir = path.join(baseDir, 'wechat_html');
            let maxNum = 0;
            
            // 检查所有可能的文件
            if (fs.existsSync(wechatDir)) {
                const files = fs.readdirSync(wechatDir)
                    .filter(f => f.match(/wechat_article_(\d+)\.md/))
                    .map(f => parseInt(f.match(/wechat_article_(\d+)\.md/)[1]));
                if (files.length > 0) {
                    maxNum = Math.max(...files);
                }
            }
            
            if (fs.existsSync(wechatHtmlDir)) {
                const files = fs.readdirSync(wechatHtmlDir)
                    .filter(f => f.match(/wechat_article_(\d+)\.html/))
                    .map(f => parseInt(f.match(/wechat_article_(\d+)\.html/)[1]));
                if (files.length > 0) {
                    maxNum = Math.max(maxNum, ...files);
                }
            }
            
            const nextNum = maxNum + 1;
            
            // 立即创建占位文件，防止其他进程使用相同编号
            const placeholderFile = path.join(wechatDir || baseDir, `wechat_article_${String(nextNum).padStart(2, '0')}.tmp`);
            try {
                fs.mkdirSync(path.dirname(placeholderFile), { recursive: true });
                fs.writeFileSync(placeholderFile, '');
            } catch (e) {
                // 忽略创建失败
            }
            
            return String(nextNum).padStart(2, '0');
        } finally {
            this.releaseLock();
        }
    }
}

module.exports = ArticleNumberLock;