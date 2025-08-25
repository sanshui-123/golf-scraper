#!/usr/bin/env node

/**
 * 每日高尔夫文章自动抓取程序
 * 严格遵循2025-08-09建立的优化流程
 * 目标：每天自动获取150-200个URL并处理
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

class DailyGolfScraper {
    constructor() {
        this.date = new Date().toISOString().split('T')[0];
        this.logFile = `daily_scraper_${this.date}.log`;
        this.reportFile = `daily_report_${this.date}.md`;
        this.startTime = new Date();
    }

    // 写入日志
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logMessage.trim());
        await fs.appendFile(this.logFile, logMessage);
    }

    // 执行shell命令
    async execCommand(command, description) {
        await this.log(`执行: ${description}`);
        try {
            const { stdout, stderr } = await execPromise(command);
            if (stdout) await this.log(stdout);
            if (stderr) await this.log(stderr, 'WARN');
            return { success: true, stdout, stderr };
        } catch (error) {
            await this.log(`错误: ${error.message}`, 'ERROR');
            return { success: false, error };
        }
    }

    // 步骤1: URL生成
    async generateURLs() {
        await this.log('=== 步骤1: URL生成阶段 ===');
        
        // 确保脚本可执行
        await this.execCommand(
            'chmod +x generate_all_urls_enhanced.sh',
            '设置脚本执行权限'
        );

        // 执行增强版URL生成脚本
        const result = await this.execCommand(
            './generate_all_urls_enhanced.sh',
            '生成所有网站的URL文件'
        );

        // 统计URL数量
        const urlStats = {};
        const files = [
            'deep_urls_golf_com.txt',
            'deep_urls_golfmonthly_com.txt',
            'deep_urls_mygolfspy_com.txt',
            'deep_urls_www_golfwrx_com.txt',
            'deep_urls_www_golfdigest_com.txt',
            'deep_urls_todays_golfer_com.txt'
        ];

        let totalUrls = 0;
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const urls = content.split('\n').filter(line => line.startsWith('https://'));
                urlStats[file] = urls.length;
                totalUrls += urls.length;
            } catch (e) {
                urlStats[file] = 0;
            }
        }

        await this.log(`URL生成完成: 总计 ${totalUrls} 个URL`);
        return { urlStats, totalUrls };
    }

    // 步骤2: URL文件修复
    async repairURLFiles() {
        await this.log('=== 步骤2: URL文件修复 ===');
        
        const result = await this.execCommand(
            'node url_file_manager.js --repair',
            '修复URL文件格式'
        );

        return result.success;
    }

    // 步骤3: 智能并发处理
    async processArticles() {
        await this.log('=== 步骤3: 智能并发处理 ===');
        
        // 设置超时（10分钟）
        const timeout = 600000;
        const command = 'node intelligent_concurrent_controller.js';
        
        return new Promise(async (resolve) => {
            const child = exec(command);
            let processStats = {
                processed: 0,
                failed: 0,
                timeout: false
            };

            const timer = setTimeout(() => {
                child.kill();
                processStats.timeout = true;
                this.log('处理超时，强制终止', 'WARN');
                resolve(processStats);
            }, timeout);

            child.stdout.on('data', async (data) => {
                await this.log(data);
                // 解析处理统计
                if (data.includes('✅ 完成处理')) {
                    processStats.processed++;
                }
                if (data.includes('❌') || data.includes('失败')) {
                    processStats.failed++;
                }
            });

            child.stderr.on('data', async (data) => {
                await this.log(data, 'ERROR');
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                this.log(`处理完成，退出码: ${code}`);
                resolve(processStats);
            });
        });
    }

    // 步骤4: 统计结果
    async generateReport(urlStats, processStats) {
        await this.log('=== 步骤4: 生成报告 ===');
        
        const endTime = new Date();
        const duration = Math.round((endTime - this.startTime) / 1000);
        
        // 统计今日处理的文章
        let articleCount = 0;
        const dateFolder = `golf_content/${this.date}/wechat_ready/`;
        try {
            const files = await fs.readdir(dateFolder);
            articleCount = files.filter(f => f.endsWith('.md') || f.endsWith('.html')).length;
        } catch (e) {
            await this.log('无法读取文章目录', 'WARN');
        }

        // 生成报告
        const report = `# 每日高尔夫文章抓取报告

## 📅 日期: ${this.date}

## ⏱️ 执行时间
- 开始时间: ${this.startTime.toLocaleString('zh-CN')}
- 结束时间: ${endTime.toLocaleString('zh-CN')}
- 总耗时: ${duration} 秒

## 📊 URL生成统计
- Golf.com: ${urlStats.urlStats?.deep_urls_golf_com || 0} 个
- Golf Monthly: ${urlStats.urlStats?.deep_urls_golfmonthly_com || 0} 个
- MyGolfSpy: ${urlStats.urlStats?.deep_urls_mygolfspy_com || 0} 个
- GolfWRX: ${urlStats.urlStats?.deep_urls_www_golfwrx_com || 0} 个
- Golf Digest: ${urlStats.urlStats?.deep_urls_www_golfdigest_com || 0} 个
- Today's Golfer: ${urlStats.urlStats?.deep_urls_todays_golfer_com || 0} 个
- **总计: ${urlStats.totalUrls} 个URL**

## 🔄 处理统计
- 处理成功: ${processStats.processed} 个网站
- 处理失败: ${processStats.failed} 个
- 是否超时: ${processStats.timeout ? '是' : '否'}

## 📝 最终结果
- **今日新增文章: ${articleCount} 篇**
- **处理成功率: ${urlStats.totalUrls > 0 ? Math.round(articleCount / urlStats.totalUrls * 100) : 0}%**

## 💡 执行日志
详细日志请查看: ${this.logFile}

---
*此报告由每日自动抓取程序生成*`;

        await fs.writeFile(this.reportFile, report);
        await this.log(`报告已生成: ${this.reportFile}`);
        
        return { articleCount, report };
    }

    // 主执行函数
    async run() {
        await this.log('🚀 每日高尔夫文章自动抓取开始');
        await this.log('📋 使用2025-08-09优化流程');
        
        try {
            // 步骤1: URL生成
            const urlStats = await this.generateURLs();
            
            // 步骤2: URL文件修复
            await this.repairURLFiles();
            
            // 步骤3: 智能并发处理
            const processStats = await this.processArticles();
            
            // 步骤4: 生成报告
            const { articleCount, report } = await this.generateReport(urlStats, processStats);
            
            // 输出摘要
            console.log('\n' + '='.repeat(50));
            console.log('✅ 每日抓取完成！');
            console.log(`📊 URL总数: ${urlStats.totalUrls}`);
            console.log(`📝 新增文章: ${articleCount}`);
            console.log(`📄 报告文件: ${this.reportFile}`);
            console.log('='.repeat(50));
            
            return { success: true, articleCount, urlCount: urlStats.totalUrls };
            
        } catch (error) {
            await this.log(`严重错误: ${error.message}`, 'ERROR');
            return { success: false, error };
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const scraper = new DailyGolfScraper();
    scraper.run().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = DailyGolfScraper;