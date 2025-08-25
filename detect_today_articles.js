#!/usr/bin/env node

/**
 * 今日文章AI检测脚本
 * 只检测今天的文章，跳过历史文章
 */

const fs = require('fs').promises;
const path = require('path');
const AIContentDetector = require('./ai_content_detector');

class TodayArticleDetector {
    constructor() {
        this.detector = new AIContentDetector();
        this.todayDate = new Date().toISOString().split('T')[0]; // 2025-08-13 格式
        this.baseDir = 'golf_content';
        this.wechatReadyDir = path.join(this.baseDir, this.todayDate, 'wechat_ready');
        this.stats = {
            total: 0,
            processed: 0,
            skipped: 0,
            failed: 0,
            alreadyDetected: 0
        };
    }

    /**
     * 主运行函数
     */
    async run() {
        console.log(`🚀 开始检测今日文章 (${this.todayDate})`);
        console.log(`📁 检测目录: ${this.wechatReadyDir}`);
        
        try {
            // 检查目录是否存在
            try {
                await fs.access(this.wechatReadyDir);
            } catch (error) {
                console.log(`❌ 今日文章目录不存在: ${this.wechatReadyDir}`);
                console.log('💡 提示: 请先运行文章处理程序生成今日文章');
                return;
            }

            // 初始化AI检测器
            console.log('\n📊 初始化AI检测器...');
            await this.detector.initialize();

            // 获取所有文章文件
            const files = await fs.readdir(this.wechatReadyDir);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            this.stats.total = mdFiles.length;

            if (mdFiles.length === 0) {
                console.log('❌ 今日没有找到任何文章');
                return;
            }

            console.log(`📄 找到 ${mdFiles.length} 篇今日文章\n`);

            // 处理每篇文章
            for (let i = 0; i < mdFiles.length; i++) {
                const file = mdFiles[i];
                const filePath = path.join(this.wechatReadyDir, file);
                
                console.log(`\n[${i + 1}/${mdFiles.length}] 处理文章: ${file}`);
                
                try {
                    const detected = await this.detectSingleArticle(filePath);
                    
                    if (detected === 'already') {
                        this.stats.alreadyDetected++;
                        console.log(`✅ 已有检测结果，跳过`);
                    } else if (detected === 'success') {
                        this.stats.processed++;
                        console.log(`✅ 检测成功`);
                    } else if (detected === 'failed') {
                        this.stats.failed++;
                        console.log(`❌ 检测失败`);
                    }
                    
                    // 添加延迟，避免请求过快
                    if (i < mdFiles.length - 1) {
                        console.log('⏳ 等待2秒后继续...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (error) {
                    console.error(`❌ 处理文件出错: ${error.message}`);
                    this.stats.failed++;
                }
            }

            // 显示统计结果
            this.showStats();

        } catch (error) {
            console.error('❌ 运行过程出错:', error);
        } finally {
            // 关闭检测器
            await this.detector.close();
        }
    }

    /**
     * 检测单篇文章
     * @param {string} filePath - 文件路径
     * @returns {Promise<string>} - 'already' | 'success' | 'failed'
     */
    async detectSingleArticle(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // 检查是否已经有AI检测结果（在文件开头的注释中）
            if (content.includes('<!-- AI检测:') || content.includes('<!-- ai_detection:')) {
                return 'already';
            }

            // 直接使用整个内容作为检测文本（限制长度）
            const maxLength = 3000; // 限制检测文本长度
            const articleBody = content.substring(0, maxLength);
            
            // 执行AI检测
            console.log('🤖 正在进行AI检测...');
            const aiProbability = await this.detector.detectText(articleBody);

            if (aiProbability !== null) {
                // 在文件开头添加AI检测结果
                const updatedContent = this.addAIDetectionResult(content, aiProbability);
                await fs.writeFile(filePath, updatedContent, 'utf8');
                console.log(`🎯 AI检测结果: ${aiProbability}%`);
                return 'success';
            } else {
                return 'failed';
            }

        } catch (error) {
            console.error(`处理文件时出错: ${error.message}`);
            return 'failed';
        }
    }

    /**
     * 在文件开头添加AI检测结果
     */
    addAIDetectionResult(content, aiProbability) {
        const detectionTime = new Date().toISOString().replace('T', ' ').split('.')[0];
        const aiDetectionComment = `<!-- AI检测: ${aiProbability}% | 检测时间: ${detectionTime} -->\n\n`;
        
        // 在文件开头添加注释
        return aiDetectionComment + content;
    }

    /**
     * 显示统计结果
     */
    showStats() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 AI检测统计结果');
        console.log('='.repeat(50));
        console.log(`📄 总文章数: ${this.stats.total}`);
        console.log(`✅ 新检测成功: ${this.stats.processed}`);
        console.log(`📌 已有检测结果: ${this.stats.alreadyDetected}`);
        console.log(`❌ 检测失败: ${this.stats.failed}`);
        console.log(`🎯 成功率: ${((this.stats.processed / (this.stats.total - this.stats.alreadyDetected)) * 100).toFixed(1)}%`);
        console.log('='.repeat(50));
        
        // 代理使用情况
        if (this.detector.proxyManager) {
            this.detector.proxyManager.getProxyStats().then(stats => {
                console.log('\n📡 代理使用情况:');
                console.log(`- 今日配额: ${stats.totalQuotaToday}`);
                console.log(`- 已使用: ${stats.usedQuotaToday}`);
                console.log(`- 剩余: ${stats.remainingQuotaToday}`);
                console.log(`- 使用率: ${((stats.usedQuotaToday / stats.totalQuotaToday) * 100).toFixed(1)}%`);
            }).catch(() => {
                // 忽略错误
            });
        }
    }
}

// 主程序入口
if (require.main === module) {
    const detector = new TodayArticleDetector();
    
    // 处理命令行参数
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
今日文章AI检测工具

使用方法:
  node detect_today_articles.js         # 检测今日所有文章
  node detect_today_articles.js --help  # 显示帮助信息

功能说明:
  - 自动检测 golf_content/${new Date().toISOString().split('T')[0]}/wechat_ready/ 目录下的所有文章
  - 跳过已经检测过的文章（包含ai_detection字段）
  - 使用代理轮换系统避开每日限制
  - 显示详细的处理进度和统计结果

注意事项:
  - 请确保已配置代理（proxy_config.json）
  - 每篇文章检测间隔2秒，避免请求过快
  - 检测结果会直接更新到文章文件中
        `);
        process.exit(0);
    }

    // 执行检测
    detector.run().catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}