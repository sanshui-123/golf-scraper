#!/usr/bin/env node

/**
 * 修复 contentSize is not defined 错误的URL
 * 功能：
 * 1. 找出所有因为 contentSize 错误而失败的URL
 * 2. 将它们从失败状态改为可重试状态
 * 3. 生成可处理的URL列表
 */

const fs = require('fs');
const path = require('path');

class ContentSizeErrorFixer {
    constructor() {
        this.stats = {
            total: 0,
            fixed: 0,
            urls: []
        };
    }
    
    async fix() {
        console.log('🔧 修复 contentSize is not defined 错误...\n');
        
        // 加载failed_articles.json
        const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
        if (!fs.existsSync(failedArticlesPath)) {
            console.log('❌ failed_articles.json 不存在');
            return;
        }
        
        // 备份原文件
        const backupPath = `${failedArticlesPath}.backup_contentsize_${Date.now()}`;
        fs.copyFileSync(failedArticlesPath, backupPath);
        console.log(`✅ 已备份到: ${backupPath}\n`);
        
        // 读取数据
        const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
        
        // 收集需要重试的URL
        const retryUrls = [];
        
        // 处理每个URL
        for (const [url, data] of Object.entries(failedArticles)) {
            this.stats.total++;
            
            // 检查是否是 contentSize 错误
            if (data.reason && data.reason.includes('contentSize is not defined')) {
                // 删除失败记录
                delete failedArticles[url];
                retryUrls.push(url);
                this.stats.fixed++;
                this.stats.urls.push(url);
                console.log(`✅ 修复: ${url}`);
            }
        }
        
        // 保存更新后的失败记录
        fs.writeFileSync(failedArticlesPath, JSON.stringify(failedArticles, null, 2));
        
        // 生成重试URL文件
        if (retryUrls.length > 0) {
            const retryFilePath = path.join(__dirname, `retry_urls_${Date.now()}.txt`);
            fs.writeFileSync(retryFilePath, retryUrls.join('\n') + '\n');
            console.log(`\n📄 已生成重试URL文件: ${retryFilePath}`);
            console.log(`   包含 ${retryUrls.length} 个URL`);
        }
        
        // 显示统计
        console.log('\n📊 修复统计：');
        console.log(`   检查总数: ${this.stats.total}`);
        console.log(`   修复数量: ${this.stats.fixed}`);
        console.log(`   剩余失败: ${this.stats.total - this.stats.fixed}`);
        
        if (this.stats.fixed > 0) {
            console.log('\n🚀 下一步操作：');
            console.log('   1. 运行以下命令重新处理这些URL:');
            console.log(`      node intelligent_concurrent_controller.js retry_urls_*.txt`);
            console.log('   2. 或者等待当前处理完成后再处理');
        }
    }
}

// 运行修复
const fixer = new ContentSizeErrorFixer();
fixer.fix().catch(console.error);