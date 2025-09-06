#!/usr/bin/env node

/**
 * 强制重试失败的URL
 * 功能：只处理真正失败的URL（在article_urls.json中状态为failed的）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FailedUrlProcessor {
    constructor() {
        this.failedUrls = [];
        this.stats = {
            total: 0,
            byWebsite: {},
            byError: {}
        };
    }
    
    async collectFailedUrls() {
        console.log('🔍 收集所有失败的URL...\n');
        
        const baseDir = 'golf_content';
        if (!fs.existsSync(baseDir)) {
            console.log('❌ golf_content 目录不存在');
            return;
        }
        
        // 扫描所有日期目录
        const dateDirs = fs.readdirSync(baseDir)
            .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
        
        for (const dateDir of dateDirs) {
            const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
            if (fs.existsSync(urlsJsonPath)) {
                try {
                    const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                    
                    for (const [articleNum, record] of Object.entries(urlMapping)) {
                        // 只收集失败的URL
                        if (record.status === 'failed' || record.error) {
                            // 检查文章文件是否真的不存在
                            const articlePath = path.join(baseDir, dateDir, 'wechat_ready', `文章${articleNum}.md`);
                            if (!fs.existsSync(articlePath)) {
                                const url = typeof record === 'string' ? record : record.url;
                                if (url && url.startsWith('http')) {
                                    this.failedUrls.push(url);
                                    this.stats.total++;
                                    
                                    // 统计网站
                                    try {
                                        const hostname = new URL(url).hostname;
                                        this.stats.byWebsite[hostname] = (this.stats.byWebsite[hostname] || 0) + 1;
                                    } catch (e) {}
                                    
                                    // 统计错误类型
                                    const error = record.error || 'unknown';
                                    const errorType = this.categorizeError(error);
                                    this.stats.byError[errorType] = (this.stats.byError[errorType] || 0) + 1;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`解析失败: ${urlsJsonPath}`, e.message);
                }
            }
        }
        
        // 去重
        this.failedUrls = [...new Set(this.failedUrls)];
        
        console.log(`✅ 找到 ${this.failedUrls.length} 个真正失败的URL\n`);
    }
    
    categorizeError(error) {
        if (error.includes('404')) return 'HTTP 404';
        if (error.includes('403')) return 'HTTP 403';
        if (error.includes('内容过短')) return '内容过短';
        if (error.includes('contentSize')) return '代码错误';
        if (error.includes('timeout')) return '超时';
        if (error.includes('closed')) return '浏览器关闭';
        return '其他错误';
    }
    
    async showStats() {
        console.log('📊 失败URL统计：');
        console.log(`   总计: ${this.stats.total}`);
        
        console.log('\n   按网站分布:');
        const sortedWebsites = Object.entries(this.stats.byWebsite)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        for (const [website, count] of sortedWebsites) {
            console.log(`   - ${website}: ${count}`);
        }
        
        console.log('\n   按错误类型:');
        const sortedErrors = Object.entries(this.stats.byError)
            .sort((a, b) => b[1] - a[1]);
        for (const [error, count] of sortedErrors) {
            console.log(`   - ${error}: ${count}`);
        }
    }
    
    async processUrls() {
        if (this.failedUrls.length === 0) {
            console.log('\n✅ 没有需要处理的失败URL');
            return;
        }
        
        // 保存到临时文件
        const tempFile = `force_retry_urls_${Date.now()}.txt`;
        fs.writeFileSync(tempFile, this.failedUrls.join('\n'));
        console.log(`\n📄 已保存失败URL到: ${tempFile}`);
        
        // 询问是否处理
        console.log('\n🚀 准备处理这些失败的URL');
        console.log('   使用智能并发控制器（最大2个并发）');
        
        // 使用intelligent_concurrent_controller.js处理
        console.log('\n执行命令:');
        console.log(`node intelligent_concurrent_controller.js ${tempFile}`);
        
        // 自动执行
        if (process.argv.includes('--auto')) {
            try {
                execSync(`node intelligent_concurrent_controller.js ${tempFile}`, {
                    stdio: 'inherit'
                });
            } catch (e) {
                console.error('处理过程中出错:', e.message);
            }
        } else {
            console.log('\n💡 提示: 添加 --auto 参数可以自动开始处理');
        }
    }
}

// 主函数
async function main() {
    const processor = new FailedUrlProcessor();
    
    // 收集失败的URL
    await processor.collectFailedUrls();
    
    // 显示统计
    await processor.showStats();
    
    // 处理URL
    await processor.processUrls();
}

// 运行
main().catch(console.error);