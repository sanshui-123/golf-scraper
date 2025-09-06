#!/usr/bin/env node

/**
 * 直接处理失败的URL，绕过批处理器的缓存检查
 * 专门处理那些在article_urls.json中标记为failed但被误认为已处理的URL
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class DirectFailedUrlProcessor {
    constructor() {
        this.failedUrls = [];
        this.processedCount = 0;
        this.batchSize = 10; // 每批处理10个URL
    }
    
    async collectTrulyFailedUrls() {
        console.log('🔍 收集真正需要处理的失败URL...\n');
        
        // 1. 从failed_articles.json收集
        const failedArticlesPath = 'failed_articles.json';
        if (fs.existsSync(failedArticlesPath)) {
            const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
            for (const [url, data] of Object.entries(failedArticles)) {
                if (data.status === 'pending_retry' && !data.status !== 'permanent_failed') {
                    this.failedUrls.push(url);
                }
            }
        }
        
        // 2. 从各个日期目录的article_urls.json收集失败的URL
        const baseDir = 'golf_content';
        if (fs.existsSync(baseDir)) {
            const dateDirs = fs.readdirSync(baseDir)
                .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
                .sort()
                .reverse() // 从最新的开始
                .slice(0, 10); // 只处理最近10天的
            
            for (const dateDir of dateDirs) {
                const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
                if (fs.existsSync(urlsJsonPath)) {
                    try {
                        const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                        
                        for (const [articleNum, record] of Object.entries(urlMapping)) {
                            if (record.status === 'failed') {
                                // 检查文章文件是否真的不存在
                                const articlePath = path.join(baseDir, dateDir, 'wechat_ready', `文章${articleNum}.md`);
                                if (!fs.existsSync(articlePath)) {
                                    const url = typeof record === 'string' ? record : record.url;
                                    if (url && url.startsWith('http')) {
                                        // 排除永久失败的URL
                                        if (!this.isPermanentFailure(record)) {
                                            this.failedUrls.push(url);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`解析失败: ${urlsJsonPath}`, e.message);
                    }
                }
            }
        }
        
        // 去重
        this.failedUrls = [...new Set(this.failedUrls)];
        
        console.log(`✅ 找到 ${this.failedUrls.length} 个需要处理的失败URL\n`);
    }
    
    isPermanentFailure(record) {
        if (!record.error) return false;
        
        const permanentErrors = [
            'HTTP 404',
            'HTTP 403',
            '文章不存在或已被删除',
            'Target page, context or browser has been closed',
            '实时赛事报道内容过长'
        ];
        
        // 检查是否包含永久失败的关键词
        for (const keyword of permanentErrors) {
            if (record.error.includes(keyword)) {
                return true;
            }
        }
        
        // 检查重试次数
        if (record.retryCount && record.retryCount >= 5) {
            return true;
        }
        
        return false;
    }
    
    async processBatch(urls) {
        // 创建临时文件
        const tempFile = `direct_batch_${Date.now()}.txt`;
        fs.writeFileSync(tempFile, urls.join('\n'));
        
        console.log(`\n📦 处理批次: ${urls.length} 个URL`);
        console.log(`   临时文件: ${tempFile}`);
        
        return new Promise((resolve) => {
            // 直接调用批处理器，使用--retry-failed参数重试失败的URL
            const process = spawn('node', ['batch_process_articles.js', tempFile, '--retry-failed'], {
                stdio: 'inherit'
            });
            
            process.on('close', (code) => {
                console.log(`   ✅ 批次完成，退出码: ${code}`);
                
                // 清理临时文件
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {}
                
                resolve(code);
            });
            
            process.on('error', (err) => {
                console.error(`   ❌ 处理出错:`, err);
                resolve(1);
            });
        });
    }
    
    async processAllUrls() {
        if (this.failedUrls.length === 0) {
            console.log('✅ 没有需要处理的URL');
            return;
        }
        
        console.log(`\n🚀 开始分批处理 ${this.failedUrls.length} 个失败的URL`);
        console.log(`   批次大小: ${this.batchSize}`);
        console.log(`   预计批次数: ${Math.ceil(this.failedUrls.length / this.batchSize)}`);
        
        // 分批处理
        for (let i = 0; i < this.failedUrls.length; i += this.batchSize) {
            const batch = this.failedUrls.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(this.failedUrls.length / this.batchSize);
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 批次 ${batchNum}/${totalBatches}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            await this.processBatch(batch);
            
            // 批次间休息，避免API压力
            if (i + this.batchSize < this.failedUrls.length) {
                console.log(`\n⏸️  批次间休息10秒...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        console.log('\n✅ 所有批次处理完成！');
    }
}

// 主函数
async function main() {
    const processor = new DirectFailedUrlProcessor();
    
    // 收集失败的URL
    await processor.collectTrulyFailedUrls();
    
    // 如果有--dry-run参数，只显示URL不处理
    if (process.argv.includes('--dry-run')) {
        const outputFile = `failed_urls_to_process_${Date.now()}.txt`;
        fs.writeFileSync(outputFile, processor.failedUrls.join('\n'));
        console.log(`\n📄 URL列表已保存到: ${outputFile}`);
        console.log('   使用 --process 参数开始处理');
        return;
    }
    
    // 处理URL
    if (process.argv.includes('--process') || process.argv.includes('--auto')) {
        await processor.processAllUrls();
    } else {
        console.log('\n💡 使用方法:');
        console.log('   --dry-run  : 只收集URL，不处理');
        console.log('   --process  : 开始处理收集到的URL');
        console.log('   --auto     : 自动处理（同--process）');
    }
}

// 运行
main().catch(console.error);