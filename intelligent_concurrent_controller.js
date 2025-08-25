#!/usr/bin/env node

/**
 * 智能并发控制器 - 无限制版本
 * 根据API响应时间动态调整并发数
 * 无并发上限：完全由API响应速度决定
 * 自动优化：响应快时增加并发，响应慢时减少并发
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const UnifiedHistoryDatabase = require('./unified_history_database');

class IntelligentConcurrentController {
    constructor() {
        this.maxConcurrency = null;       // 无并发限制
        this.optimalConcurrency = 1;      // 当前最优并发数
        this.currentProcesses = [];       // 当前运行的进程
        this.urlFiles = [];              // 待处理的URL文件
        this.apiResponseTimes = [];      // 最近的API响应时间
        this.responseTimeWindow = [];     // 响应时间滑动窗口（最近20个样本）
        this.checkInterval = 10000;       // 检查间隔（10秒，更快响应）
        this.logFile = `concurrent_controller_${new Date().toISOString().split('T')[0]}.log`;
        this.consecutiveIdleCycles = 0;      // 连续空闲周期计数
        this.IDLE_EXIT_THRESHOLD = 10;       // 空闲退出阈值（5分钟）
        this.stats = { processed: 0, success: 0, failed: 0 }; // 处理统计
        this.historyDB = new UnifiedHistoryDatabase(); // 历史数据库
        this.dedupStats = { total: 0, skipped: 0, processed: 0 }; // 去重统计
        this.statusFile = 'processing_status.json'; // 状态文件
        this.processingStatus = {}; // 当前处理状态
        
        // 改写统计
        this.rewriteStats = {
            activeProcessors: 0,
            completedArticles: 0,
            rewritingArticles: 0
        };
        
        // 全局错误监控
        this.globalErrorMonitor = {
            criticalErrors: 0,
            lastCriticalError: null,
            recoveryInProgress: false
        };
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    /**
     * 更新处理状态文件
     */
    updateStatusFile() {
        try {
            // 同步批处理进度文件
            this.syncBatchProgress();
            
            // 计算URL级别的汇总统计
            let totalUrlsProcessed = 0;
            let totalUrlsRemaining = 0;
            let activeUrls = [];
            
            for (const [file, status] of Object.entries(this.processingStatus)) {
                if (status.totalUrls) {
                    const processed = status.processedUrls || status.processedArticles || 0;
                    totalUrlsProcessed += processed;
                    
                    if (status.status === 'processing') {
                        totalUrlsRemaining += (status.totalUrls - processed);
                        if (status.currentUrl) {
                            activeUrls.push({
                                file: file,
                                url: status.currentUrl,
                                index: status.currentIndex || 0,
                                total: status.totalUrls
                            });
                        }
                    }
                }
            }
            
            const status = {
                timestamp: new Date().toISOString(),
                running: true,
                currentConcurrency: this.currentProcesses.length,
                optimalConcurrency: this.optimalConcurrency,
                stats: this.stats,
                dedupStats: this.dedupStats,
                // URL级别汇总
                urlProgress: {
                    totalProcessed: totalUrlsProcessed,
                    totalRemaining: totalUrlsRemaining,
                    activeUrls: activeUrls,
                    completionRate: this.dedupStats.total > 0 
                        ? Math.round((totalUrlsProcessed / this.dedupStats.total) * 100) 
                        : 0
                },
                processing: this.processingStatus,
                urlFiles: this.urlFiles.map(file => {
                    const name = this.getWebsiteName(file);
                    return {
                        file: file,
                        name: name,
                        status: this.processingStatus[file] || 'pending'
                    };
                })
            };
            
            fs.writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
        } catch (e) {
            console.error('更新状态文件失败:', e);
        }
    }

    /**
     * 从文件名获取网站名称
     */
    getWebsiteName(file) {
        const mapping = {
            'deep_urls_golf_com.txt': 'Golf.com',
            'deep_urls_golfmonthly_com.txt': 'Golf Monthly',
            'deep_urls_mygolfspy_com.txt': 'MyGolfSpy (RSS模式)',
            'deep_urls_www_golfwrx_com.txt': 'GolfWRX',
            'deep_urls_www_golfdigest_com.txt': 'Golf Digest',
            'deep_urls_todays_golfer_com.txt': "Today's Golfer",
            'deep_urls_golfweek_usatoday_com.txt': 'Golfweek',
            'deep_urls_nationalclubgolfer_com.txt': 'National Club Golfer',
            'deep_urls_www_pgatour_com.txt': 'PGA Tour',
            'deep_urls_skysports_com.txt': 'Sky Sports Golf',
            'deep_urls_golfmagic_com.txt': 'Golf Magic',
            'deep_urls_yardbarker_com.txt': 'Yardbarker',
            'deep_urls_golf_net_cn.txt': '中国高尔夫网',
            'deep_urls_si_com.txt': 'SI Golf',
            'deep_urls_yahoo_golf.txt': 'Yahoo Golf',
            'deep_urls_espn_golf.txt': 'ESPN Golf',
            'deep_urls_lpga_com.txt': 'LPGA',
            'deep_urls_cbssports_golf.txt': 'CBS Sports Golf'
        };
        
        return mapping[path.basename(file)] || path.basename(file);
    }

    /**
     * 同步批处理进度文件
     */
    syncBatchProgress() {
        try {
            // 遍历所有正在处理的文件
            for (const urlFile in this.processingStatus) {
                if (this.processingStatus[urlFile].status === 'processing') {
                    const progressFile = path.join(__dirname, `batch_progress_${urlFile.replace('.txt', '')}.json`);
                    
                    if (fs.existsSync(progressFile)) {
                        try {
                            const batchProgress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
                            
                            // 合并批处理进度到主状态
                            this.processingStatus[urlFile] = {
                                ...this.processingStatus[urlFile],
                                ...batchProgress,
                                status: 'processing'
                            };
                        } catch (e) {
                            // 忽略读取错误
                        }
                    }
                }
            }
        } catch (e) {
            // 静默处理错误
        }
    }

    /**
     * 启动时验证
     */
    async validateStartup(urlFiles) {
        // 检测URL文件
        if (urlFiles.length === 0) {
            console.error('❌ 错误：未指定URL文件');
            console.log('✅ 正确用法：node intelligent_concurrent_controller.js deep_urls_*.txt');
            console.log('✅ 或使用：node intelligent_concurrent_controller.js（自动查找所有URL文件）');
            process.exit(1);
        }
        
        // 预检查URL文件完整性
        console.log('\n📋 URL文件预检查...');
        const fileIssues = [];
        const validFiles = [];
        
        for (const file of urlFiles) {
            if (!fs.existsSync(file)) {
                fileIssues.push(`❌ ${file}: 文件不存在`);
                continue;
            }
            
            const content = fs.readFileSync(file, 'utf8').trim();
            const urls = content.split('\n').filter(line => line.trim() && line.includes('http'));
            
            if (urls.length === 0) {
                fileIssues.push(`⚠️  ${file}: 空文件或无有效URL`);
                continue;
            }
            
            // 检查URL格式
            const invalidUrls = urls.filter(url => !url.match(/^https?:\/\//));
            if (invalidUrls.length > 0) {
                fileIssues.push(`⚠️  ${file}: 包含${invalidUrls.length}个格式错误的URL`);
            }
            
            validFiles.push(file);
            console.log(`✅ ${file}: ${urls.length}个URL`);
        }
        
        // 如果有问题，显示汇总
        if (fileIssues.length > 0) {
            console.log('\n⚠️  发现以下问题：');
            fileIssues.forEach(issue => console.log(issue));
            
            if (validFiles.length === 0) {
                console.log('\n❌ 没有有效的URL文件可处理');
                console.log('💡 建议：运行 node auto_scrape_three_sites.js --all-sites 重新生成URL');
                process.exit(1);
            }
            
            console.log(`\n将继续处理 ${validFiles.length} 个有效文件`);
            urlFiles = validFiles;
        }
        
        // 检查是否强制模式
        const forceMode = process.argv.includes('--force');
        if (forceMode) {
            console.log('🔄 强制重新处理模式已启用');
        }
        
        // 检查是否继续模式
        const continueMode = process.argv.includes('--continue');
        if (continueMode) {
            console.log('▶️ 继续处理模式：智能检查并处理未完成的URL');
        }
        
        // 加载处理状态
        let processingStatus = {};
        let failedUrls = 0;
        let incompleteUrls = 0;
        
        try {
            if (fs.existsSync(this.statusFile)) {
                const statusData = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
                processingStatus = statusData.urls || {};
                
                // 统计失败和未完成的URL
                for (const [url, info] of Object.entries(processingStatus)) {
                    if (info.status === 'failed') failedUrls++;
                    if (info.status === 'processing' || info.status === 'incomplete_processing') incompleteUrls++;
                }
            }
        } catch (e) {
            console.log('⚠️ 无法读取处理状态文件');
        }
        
        // 检测是否有待处理任务（包含去重检查）
        let totalUrls = 0;
        let newUrls = 0;
        let duplicateUrls = 0;
        
        for (const file of urlFiles) {
            const content = fs.readFileSync(file, 'utf8').trim();
            const urls = content.split('\n').filter(line => line.includes('http'));
            
            if (forceMode) {
                // 强制模式下，所有URL都视为新URL
                totalUrls += urls.length;
                newUrls += urls.length;
            } else {
                // 批量检查去重
                const checkResult = this.historyDB.batchCheckUrls(urls);
                totalUrls += urls.length;
                newUrls += checkResult.statistics.new;
                duplicateUrls += checkResult.statistics.duplicate;
            }
        }
        
        this.dedupStats.total = totalUrls;
        this.dedupStats.skipped = duplicateUrls;
        this.dedupStats.processed = newUrls;
        
        // 修改退出条件
        if (newUrls === 0 && failedUrls === 0 && incompleteUrls === 0 && !forceMode) {
            console.log('✅ 所有文章已处理完成！');
            console.log(`📊 去重统计：总计${totalUrls}个URL，全部为重复`);
            console.log('💡 如需重新生成URL：node auto_scrape_three_sites.js --all-sites');
            console.log('💡 如需强制重新处理：添加 --force 参数');
            process.exit(0);
        } else if (newUrls === 0 && (failedUrls > 0 || incompleteUrls > 0) && !forceMode) {
            console.log(`🔄 检测到 ${failedUrls} 个失败URL和 ${incompleteUrls} 个未完成URL`);
            console.log('🚀 将重新处理这些URL...');
            // 继续处理而不退出
        }
        
        if (forceMode) {
            this.log(`🔍 强制模式：将处理所有 ${totalUrls} 个URL`);
        } else {
            this.log(`🔍 检测到${totalUrls}个URL，其中${newUrls}个新URL，${duplicateUrls}个重复`);
            if (failedUrls > 0 || incompleteUrls > 0) {
                this.log(`🔄 包含 ${failedUrls} 个失败URL和 ${incompleteUrls} 个未完成URL`);
            }
        }
    }

    /**
     * 检查API压力
     * 通过分析日志文件中的响应时间判断
     */
    async checkAPIPressure() {
        try {
            // 查找最近的批处理日志
            const logs = fs.readdirSync('.')
                .filter(f => f.startsWith('batch_') && f.endsWith('.log'))
                .sort((a, b) => {
                    const statA = fs.statSync(a);
                    const statB = fs.statSync(b);
                    return statB.mtime - statA.mtime;
                })
                .slice(0, 3); // 检查最近3个日志

            let totalResponseTime = 0;
            let responseCount = 0;

            for (const logFile of logs) {
                const content = fs.readFileSync(logFile, 'utf8');
                // 提取Claude响应时间
                const matches = content.match(/等待Claude响应... (\d+)秒/g);
                if (matches) {
                    matches.forEach(match => {
                        const time = parseInt(match.match(/(\d+)秒/)[1]);
                        if (time > 5) { // 统计超过5秒的响应，更敏感
                            totalResponseTime += time;
                            responseCount++;
                        }
                    });
                }
            }

            const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
            
            if (responseCount === 0) {
                this.log(`💤 等待任务中...`);
                if (this.stats.processed === 0) {
                    // 检查URL文件状态
                    if (!this.urlFiles || this.urlFiles.length === 0) {
                        this.log(`⚠️ 未指定URL文件，请先运行: node auto_scrape_three_sites.js --all-sites`);
                    } else {
                        // 统计待处理的URL数量
                        let totalPending = 0;
                        let fileStatus = [];
                        
                        for (const urlFile of this.urlFiles) {
                            try {
                                if (fs.existsSync(urlFile)) {
                                    const content = fs.readFileSync(urlFile, 'utf8').trim();
                                    const urls = content.split('\n').filter(url => url && url.includes('http'));
                                    totalPending += urls.length;
                                    
                                    const siteName = this.getWebsiteName(urlFile);
                                    fileStatus.push(`   - ${siteName}: ${urls.length}个待处理`);
                                } else {
                                    const siteName = this.getWebsiteName(urlFile);
                                    fileStatus.push(`   - ${siteName}: ❌ 文件不存在`);
                                }
                            } catch (e) {
                                const siteName = this.getWebsiteName(urlFile);
                                fileStatus.push(`   - ${siteName}: ⚠️ 读取失败`);
                            }
                        }
                        
                        if (totalPending === 0) {
                            this.log(`✅ 所有URL文件为空或已处理完成`);
                            if (fileStatus.length > 0) {
                                this.log(`📁 URL文件状态:`);
                                fileStatus.forEach(status => this.log(status));
                            }
                        } else {
                            this.log(`📋 系统启动中，URL文件状态:`);
                            fileStatus.forEach(status => this.log(status));
                            this.log(`   总计: ${totalPending}个URL待处理`);
                        }
                    }
                } else {
                    // 已经处理过一些文章
                    this.log(`📊 已处理 ${this.stats.processed} 篇文章 (成功: ${this.stats.success}, 失败: ${this.stats.failed})`);
                }
                return 0;
            }
            
            this.log(`📊 API平均响应时间: ${avgResponseTime.toFixed(1)}秒 (基于${responseCount}个样本)`);
            
            return avgResponseTime;
        } catch (error) {
            this.log(`⚠️ 检查API压力时出错: ${error.message}`);
            return 0;
        }
    }

    /**
     * 更新响应时间窗口
     */
    updateResponseTimeWindow(responseTime) {
        this.responseTimeWindow.push(responseTime);
        // 保持最近20个样本
        if (this.responseTimeWindow.length > 20) {
            this.responseTimeWindow.shift();
        }
    }

    /**
     * 获取当前并发数建议 - 无限制版本
     */
    async getRecommendedConcurrency() {
        const avgResponseTime = await this.checkAPIPressure();
        
        // 更新响应时间窗口
        if (avgResponseTime > 0) {
            this.updateResponseTimeWindow(avgResponseTime);
        }
        
        // 计算窗口内的平均响应时间
        const windowAvg = this.responseTimeWindow.length > 0 
            ? this.responseTimeWindow.reduce((a, b) => a + b, 0) / this.responseTimeWindow.length
            : avgResponseTime;
        
        const currentConcurrency = this.currentProcesses.length;
        
        // 动态调整策略
        if (windowAvg === 0 || this.responseTimeWindow.length < 3) {
            // 初始阶段或无数据，保守启动
            this.optimalConcurrency = Math.max(1, currentConcurrency);
            this.log(`🔄 初始阶段，当前并发: ${this.optimalConcurrency}`);
        } else if (windowAvg < 30) {
            // 响应非常快，大幅增加并发
            this.optimalConcurrency = currentConcurrency + 2;
            this.log(`🚀 API响应极快（${windowAvg.toFixed(1)}秒），增加到 ${this.optimalConcurrency} 个并发`);
        } else if (windowAvg < 45) {
            // 响应快，增加并发
            this.optimalConcurrency = currentConcurrency + 1;
            this.log(`⚡ API响应快速（${windowAvg.toFixed(1)}秒），增加到 ${this.optimalConcurrency} 个并发`);
        } else if (windowAvg < 60) {
            // 响应正常，维持当前并发
            this.optimalConcurrency = Math.max(1, currentConcurrency);
            this.log(`✅ API响应正常（${windowAvg.toFixed(1)}秒），维持 ${this.optimalConcurrency} 个并发`);
        } else if (windowAvg < 90) {
            // 响应变慢，减少并发
            this.optimalConcurrency = Math.max(1, currentConcurrency - 1);
            this.log(`⚠️ API响应变慢（${windowAvg.toFixed(1)}秒），降低到 ${this.optimalConcurrency} 个并发`);
        } else {
            // 响应很慢，快速降到最低
            this.optimalConcurrency = 1;
            this.log(`🚨 API响应过慢（${windowAvg.toFixed(1)}秒），降低到 ${this.optimalConcurrency} 个并发`);
        }
        
        // 记录详细统计
        if (this.responseTimeWindow.length >= 5) {
            const recent5 = this.responseTimeWindow.slice(-5);
            const trend = recent5[4] - recent5[0]; // 最近趋势
            const trendStr = trend > 5 ? '↗️上升' : trend < -5 ? '↘️下降' : '➡️稳定';
            this.log(`📊 响应时间趋势: ${trendStr} | 最近5次: ${recent5.map(t => t.toFixed(0)).join(', ')}秒`);
        }
        
        return this.optimalConcurrency;
    }

    /**
     * 创建去重后的URL文件
     */
    createDedupedUrlFile(urlFile) {
        // 检查文件是否存在
        if (!fs.existsSync(urlFile)) {
            this.log(`⚠️ URL文件不存在: ${urlFile}，跳过此文件`);
            return null;
        }
        
        const content = fs.readFileSync(urlFile, 'utf8').trim();
        const urls = content.split('\n').filter(line => line.includes('http'));
        
        // 检查是否强制模式
        const forceMode = process.argv.includes('--force');
        const continueMode = process.argv.includes('--continue');
        
        if (forceMode) {
            // 强制模式下，处理所有URL
            const dedupedFile = urlFile.replace('.txt', '_deduped.txt');
            fs.writeFileSync(dedupedFile, urls.join('\n') + '\n');
            this.log(`📝 创建文件（强制模式）：${dedupedFile} (${urls.length}个URL)`);
            return dedupedFile;
        }
        
        // 继续模式下的诊断信息
        if (continueMode) {
            this.log(`\n📊 URL分析 - ${urlFile}:`);
            this.log(`  - 文件修改时间: ${new Date(fs.statSync(urlFile).mtime).toISOString()}`);
            this.log(`  - 总URL数: ${urls.length}`);
        }
        
        // 批量检查去重 - 确保检查所有URL
        this.log(`🔍 批量检查 ${urls.length} 个URL的本地状态...`);
        const checkResult = this.historyDB.batchCheckUrls(urls);
        
        // 新增：检查本地文件系统，确认文章是否真的存在
        const verifiedNewUrls = [];
        const verifiedFailedUrls = [];
        const verifiedProcessingUrls = [];
        let missingCount = 0;
        
        for (const url of urls) {
            const urlData = this.historyDB.checkUrl(url);
            
            if (!urlData || urlData.status === 'new') {
                // 新URL，直接加入
                verifiedNewUrls.push(url);
            } else if (urlData.status === 'completed') {
                // 声称已完成，但需要验证文件是否真的存在
                if (urlData.date && urlData.articleNum) {
                    const articlePath = this.getArticlePath(urlData.date, urlData.articleNum);
                    if (!fs.existsSync(articlePath)) {
                        // 文件不存在，需要重新处理
                        verifiedNewUrls.push(url);
                        missingCount++;
                        this.log(`⚠️ 发现丢失的文章: ${urlData.date}/文章${urlData.articleNum} (${url})`);
                    } else if (continueMode) {
                        // 在继续模式下，检查是否是今天的文章
                        const today = new Date().toISOString().split('T')[0];
                        if (urlData.date === today) {
                            // 今天的文章，可能需要重新处理（比如URL是今天生成的但已经处理过）
                            this.log(`ℹ️ 今天的文章已存在: ${urlData.date}/文章${urlData.articleNum}`);
                        }
                    }
                } else {
                    // 缺少必要信息，需要重新处理
                    verifiedNewUrls.push(url);
                }
            } else if (urlData.status === 'failed') {
                // 失败的URL，如果不是--retry-failed模式，跳过
                if (process.argv.includes('--retry-failed')) {
                    verifiedFailedUrls.push(url);
                }
            } else if (urlData.status === 'processing') {
                // 处理中的URL
                verifiedProcessingUrls.push(url);
            }
        }
        
        // 确保所有URL都被检查
        const totalChecked = verifiedNewUrls.length + verifiedFailedUrls.length + verifiedProcessingUrls.length;
        const duplicateUrls = urls.length - totalChecked;
        
        if (continueMode) {
            this.log(`✅ 检查完成: 总计${urls.length}个URL`);
            this.log(`  - 新URL: ${verifiedNewUrls.length}`);
            this.log(`  - 失败URL: ${verifiedFailedUrls.length}`);
            this.log(`  - 处理中: ${verifiedProcessingUrls.length}`);
            this.log(`  - 已完成（重复）: ${duplicateUrls}`);
            
            if (totalChecked < urls.length) {
                // 找出未被正确分类的URL
                const uncategorized = urls.filter(url => 
                    !verifiedNewUrls.includes(url) && 
                    !verifiedFailedUrls.includes(url) && 
                    !verifiedProcessingUrls.includes(url)
                );
                this.log(`⚠️ 警告: 有${uncategorized.length}个URL未被正确分类，将补充处理`);
                // 将这些URL加入到新URL列表
                verifiedNewUrls.push(...uncategorized);
            }
        }
        
        // 合并所有需要处理的URL
        const urlsToProcess = [...new Set([
            ...verifiedNewUrls, 
            ...verifiedFailedUrls,
            ...verifiedProcessingUrls
        ])];
        
        if (missingCount > 0) {
            this.log(`📊 发现 ${missingCount} 个声称已完成但文件丢失的文章`);
        }
        
        if (urlsToProcess.length === 0) {
            this.log(`⏭️  跳过${urlFile}：所有URL都已成功处理且文件存在`);
            return null;
        }
        
        // 创建去重后的临时文件
        const dedupedFile = urlFile.replace('.txt', '_deduped.txt');
        fs.writeFileSync(dedupedFile, urlsToProcess.join('\n') + '\n');
        
        const stats = {
            new: verifiedNewUrls.length - missingCount,
            missing: missingCount,
            failed: verifiedFailedUrls.length,
            processing: verifiedProcessingUrls.length
        };
        
        this.log(`📝 创建去重文件：${dedupedFile} (${urlsToProcess.length}个URL：${stats.new}个新URL + ${stats.missing}个丢失文件 + ${stats.failed}个失败 + ${stats.processing}个处理中)`);
        return dedupedFile;
    }
    
    /**
     * 启动批处理进程
     */
    startBatchProcess(urlFile) {
        return new Promise((resolve, reject) => {
            // 先创建去重后的URL文件
            const dedupedFile = this.createDedupedUrlFile(urlFile);
            if (!dedupedFile) {
                resolve(); // 没有新URL，直接返回
                return;
            }
            
            const logFileName = `batch_${path.basename(urlFile, '.txt')}_${Date.now()}.log`;
            const logStream = fs.createWriteStream(logFileName);
            
            this.log(`🚀 启动处理: ${dedupedFile} -> ${logFileName}`);
            
            // 更新处理状态
            this.processingStatus[urlFile] = {
                status: 'processing',
                startTime: new Date().toISOString(),
                totalUrls: fs.readFileSync(dedupedFile, 'utf8').trim().split('\n').filter(line => line.includes('http')).length,
                processedUrls: 0
            };
            this.updateStatusFile();
            
            const process = spawn('node', ['batch_process_articles.js', dedupedFile], {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // 增强日志转发机制
            const processIndex = this.currentProcesses.length + 1;
            
            process.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    // 识别改写相关日志并标记
                    if (line.includes('开始改写') || line.includes('改写完成') || line.includes('改写中...') || 
                        line.includes('AI检测') || line.includes('自动重写')) {
                        console.log(`[处理器${processIndex}] ${line}`);
                        
                        // 写入专门的改写日志文件
                        if (!fs.existsSync('rewrite_progress.log')) {
                            fs.writeFileSync('rewrite_progress.log', '');
                        }
                        fs.appendFileSync('rewrite_progress.log', `[${new Date().toISOString()}] ${line}\n`);
                        
                        // 更新改写统计
                        if (line.includes('开始改写')) {
                            this.rewriteStats.rewritingArticles++;
                        } else if (line.includes('改写完成')) {
                            this.rewriteStats.completedArticles++;
                            if (this.rewriteStats.rewritingArticles > 0) {
                                this.rewriteStats.rewritingArticles--;
                            }
                        }
                    }
                    
                    // 将日志写入原始日志文件
                    logStream.write(line + '\n');
                });
            });
            
            process.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    console.error(`[处理器${processIndex}] ❌ ${line}`);
                    logStream.write(`[ERROR] ${line}\n`);
                });
            });
            
            process.on('exit', (code) => {
                this.log(`✅ 完成处理: ${urlFile} (退出码: ${code})`);
                
                // 更新处理状态
                this.processingStatus[urlFile] = {
                    status: 'completed',
                    endTime: new Date().toISOString(),
                    exitCode: code
                };
                this.updateStatusFile();
                
                // 清理去重临时文件
                try {
                    if (fs.existsSync(dedupedFile)) {
                        fs.unlinkSync(dedupedFile);
                        this.log(`🧹 清理临时文件: ${dedupedFile}`);
                    }
                    
                    // 清理批处理进度文件
                    // 去掉_deduped后缀，使用原始文件名
                    const baseFileName = urlFile.replace('_deduped.txt', '.txt').replace('.txt', '');
                    const progressFile = path.join(__dirname, `batch_progress_${baseFileName}.json`);
                    if (fs.existsSync(progressFile)) {
                        fs.unlinkSync(progressFile);
                        this.log(`🧹 清理进度文件: ${progressFile}`);
                    }
                } catch (err) {
                    // 忽略清理错误
                }
                
                // 更新统计
                this.stats.processed++;
                if (code === 0) {
                    this.stats.success++;
                } else {
                    this.stats.failed++;
                }
                // 从运行列表中移除
                this.currentProcesses = this.currentProcesses.filter(p => p.pid !== process.pid);
                resolve(code);
            });
            
            process.on('error', (err) => {
                this.log(`❌ 处理出错: ${urlFile} - ${err.message}`);
                reject(err);
            });
            
            // 计算动态超时时间
            const dynamicTimeout = this.getTimeoutForFile(urlFile);
            
            this.currentProcesses.push({
                pid: process.pid,
                urlFile: urlFile,
                process: process,
                startTime: Date.now(),
                timeout: dynamicTimeout
            });
        });
    }

    /**
     * 获取URL文件的行数
     */
    getUrlCount(urlFile) {
        try {
            const content = fs.readFileSync(urlFile, 'utf8');
            return content.split('\n').filter(line => line.includes('http')).length;
        } catch (e) {
            return 0;
        }
    }

    /**
     * 获取文章文件路径
     */
    getArticlePath(date, articleNum) {
        const dir = path.join(__dirname, 'golf_content', date, 'wechat_ready');
        return path.join(dir, `wechat_article_${articleNum}.md`);
    }

    /**
     * 根据URL文件动态计算超时时间
     */
    getTimeoutForFile(urlFile) {
        const urlCount = this.getUrlCount(urlFile);
        const websiteName = this.getWebsiteName(urlFile);
        
        // 每个URL 3.5分钟（3分钟处理 + 0.5分钟缓冲）
        let baseTimeout = urlCount * 3.5 * 60 * 1000;
        
        // 调整最小和最大限制
        const minTimeout = 15 * 60 * 1000;     // 最小15分钟（从30分钟降低）
        const maxTimeout = 2 * 60 * 60 * 1000; // 最大2小时（从3小时降低）
        
        const finalTimeout = Math.min(Math.max(baseTimeout, minTimeout), maxTimeout);
        
        this.log(`⏱️ ${websiteName} 进程超时设置: ${Math.round(finalTimeout/60000)}分钟 (${urlCount}个URL，每个3分钟)`);
        
        return finalTimeout;
    }

    /**
     * 检查并终止超时进程
     */
    checkTimeoutProcesses() {
        const now = Date.now();
        
        this.currentProcesses.forEach(proc => {
            const timeout = proc.timeout || (30 * 60 * 1000); // 使用动态超时或默认30分钟
            
            if (now - proc.startTime > timeout) {
                this.log(`⏱️ 进程超时，终止: PID ${proc.pid} (${proc.urlFile}) - 超时时间: ${Math.round(timeout/60000)}分钟`);
                
                // 保存中断位置以便恢复
                this.saveInterruptionPoint(proc.urlFile);
                
                proc.process.kill('SIGTERM');
            }
        });
    }
    
    /**
     * 保存中断点信息
     */
    saveInterruptionPoint(urlFile) {
        const interruptFile = 'interruption_points.json';
        let interruptions = {};
        
        try {
            if (fs.existsSync(interruptFile)) {
                interruptions = JSON.parse(fs.readFileSync(interruptFile, 'utf8'));
            }
        } catch (e) {
            // 忽略错误
        }
        
        // 记录中断信息
        interruptions[urlFile] = {
            timestamp: new Date().toISOString(),
            status: this.processingStatus[urlFile] || {},
            reason: 'timeout'
        };
        
        fs.writeFileSync(interruptFile, JSON.stringify(interruptions, null, 2));
        this.log(`💾 已保存中断点: ${urlFile}`);
    }
    
    /**
     * 检查并恢复中断的处理
     */
    checkAndResumeInterruptions() {
        const interruptFile = 'interruption_points.json';
        
        if (!fs.existsSync(interruptFile)) {
            return false;
        }
        
        try {
            const interruptions = JSON.parse(fs.readFileSync(interruptFile, 'utf8'));
            const hasInterruptions = Object.keys(interruptions).length > 0;
            
            if (hasInterruptions) {
                console.log(`\n🔄 检测到上次中断的任务，准备恢复处理...`);
                for (const [file, info] of Object.entries(interruptions)) {
                    console.log(`   - ${file}: 中断于 ${info.timestamp}`);
                    if (info.status.currentIndex) {
                        console.log(`     进度: ${info.status.currentIndex}/${info.status.totalUrls}`);
                    }
                }
                
                // 清空中断文件
                fs.writeFileSync(interruptFile, '{}');
                
                return true;
            }
        } catch (e) {
            console.error('读取中断点文件失败:', e);
        }
        
        return false;
    }

    /**
     * 检查未完成的批处理
     */
    checkIncompleteBatch() {
        // 检查是否有 *_deduped.txt 文件存在
        const dedupedFiles = fs.readdirSync('.')
            .filter(f => f.endsWith('_deduped.txt'));
        
        if (dedupedFiles.length > 0) {
            // 检查对应的进度文件
            const dedupedFile = dedupedFiles[0];
            const baseFileName = dedupedFile.replace('_deduped.txt', '');
            const progressFile = `batch_progress_${baseFileName}.json`;
            
            if (fs.existsSync(progressFile)) {
                try {
                    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
                    return {
                        file: dedupedFile,
                        originalFile: baseFileName + '.txt',
                        processed: progress.processedArticles || 0,
                        total: progress.totalUrls || 0,
                        progress: progress
                    };
                } catch (e) {
                    this.log(`⚠️ 无法读取进度文件: ${progressFile}`);
                }
            }
        }
        return null;
    }

    /**
     * 恢复未完成的批处理
     */
    async resumeIncompleteBatch(batch) {
        this.log(`🔄 恢复未完成的批处理: ${batch.file}`);
        this.log(`   已处理: ${batch.processed}/${batch.total} (${Math.round(batch.processed/batch.total*100)}%)`);
        
        // 直接使用现有的去重文件继续处理
        // 注意：batch_process_articles.js 会自动从中断点继续
        const originalUrlFile = batch.originalFile;
        
        // 将原始文件加入到处理队列的开头
        if (this.urlFiles && !this.urlFiles.includes(originalUrlFile)) {
            this.urlFiles.unshift(originalUrlFile);
        }
        
        // 标记为恢复模式
        this.isResuming = true;
        this.resumeFile = batch.file;
        
        this.log(`✅ 已将 ${originalUrlFile} 加入处理队列，将从中断点继续`);
    }

    /**
     * 显示详细的处理进度汇总
     */
    displayProgressSummary() {
        const now = Date.now();
        const runTime = now - (this.processingStartTime || now);
        const runTimeMinutes = Math.floor(runTime / 60000);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 处理进度汇总 [运行时间: ${runTimeMinutes}分钟]`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 并发状态
        console.log(`并发状态: ${this.currentProcesses.length}个进程运行中 (最优: ${this.optimalConcurrency})`);
        
        // API响应状态
        const avgResponseTime = this.apiResponseTimes.length > 0 
            ? this.apiResponseTimes.reduce((a, b) => a + b, 0) / this.apiResponseTimes.length 
            : 0;
        if (avgResponseTime > 0) {
            const status = avgResponseTime < 60 ? '正常' : avgResponseTime < 120 ? '缓慢' : '过载';
            console.log(`API响应: 平均${avgResponseTime.toFixed(0)}秒 (${status})`);
        }
        
        console.log('\n网站进度:');
        
        // 收集每个网站的进度信息
        let totalUrls = 0;
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        
        for (const urlFile of this.urlFiles) {
            const siteName = this.getWebsiteName(urlFile);
            const status = this.processingStatus[urlFile] || 'pending';
            let progressBar = '';
            let urlCount = 0;
            let processedCount = 0;
            
            // 读取进度文件
            try {
                const progressFile = path.join(__dirname, `batch_progress_${path.basename(urlFile, '.txt')}.json`);
                if (fs.existsSync(progressFile)) {
                    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
                    urlCount = progress.totalUrls || 0;
                    processedCount = progress.processedArticles || 0;
                    
                    // 生成进度条
                    const percentage = urlCount > 0 ? Math.floor((processedCount / urlCount) * 100) : 0;
                    const barLength = 20;
                    const filled = Math.floor((percentage / 100) * barLength);
                    const empty = barLength - filled;
                    progressBar = `[█`.repeat(filled) + `░`.repeat(empty) + `] ${processedCount}/${urlCount}`;
                    
                    totalUrls += urlCount;
                    totalProcessed += processedCount;
                    totalSuccess += progress.successCount || 0;
                    totalFailed += progress.failedCount || 0;
                }
            } catch (e) {}
            
            // 显示状态图标
            const statusIcon = {
                'completed': '✅',
                'processing': '🔄',
                'pending': '⏳',
                'failed': '❌'
            }[status] || '❓';
            
            // 打印网站进度
            console.log(`${statusIcon} ${siteName.padEnd(20)} ${progressBar.padEnd(30)} ${status}`);
            
            // 如果正在处理，显示当前文章
            if (status === 'processing' && this.currentProcesses.find(p => p.urlFile === urlFile)) {
                try {
                    const progressFile = path.join(__dirname, `batch_progress_${path.basename(urlFile, '.txt')}.json`);
                    if (fs.existsSync(progressFile)) {
                        const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
                        if (progress.currentUrl) {
                            const shortUrl = progress.currentUrl.length > 50 
                                ? '...' + progress.currentUrl.slice(-47) 
                                : progress.currentUrl;
                            console.log(`   └─ ${progress.stageText || '处理中'}: ${shortUrl}`);
                        }
                    }
                } catch (e) {}
            }
        }
        
        // 统计数据
        console.log('\n统计数据:');
        console.log(`• 总进度: ${totalProcessed}/${totalUrls} (${totalUrls > 0 ? ((totalProcessed/totalUrls)*100).toFixed(1) : 0}%)`);
        console.log(`• 成功: ${totalSuccess}篇 | 失败: ${totalFailed}篇`);
        
        // 预计完成时间
        if (totalProcessed > 0 && totalProcessed < totalUrls) {
            const avgTimePerArticle = runTime / totalProcessed;
            const remainingTime = avgTimePerArticle * (totalUrls - totalProcessed);
            const remainingMinutes = Math.ceil(remainingTime / 60000);
            const hours = Math.floor(remainingMinutes / 60);
            const minutes = remainingMinutes % 60;
            
            const timeStr = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
            console.log(`• 平均处理时间: ${Math.round(avgTimePerArticle / 1000)}秒/篇`);
            console.log(`• 预计剩余时间: ${timeStr}`);
        }
        
        // 最近错误
        try {
            const failedFile = 'failed_articles.json';
            if (fs.existsSync(failedFile)) {
                const failed = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
                const recentErrors = failed.slice(-3).reverse();
                if (recentErrors.length > 0) {
                    console.log('\n最近错误:');
                    recentErrors.forEach(err => {
                        const time = new Date(err.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        const shortUrl = err.url.length > 50 ? '...' + err.url.slice(-47) : err.url;
                        console.log(`❌ [${time}] ${shortUrl}`);
                        console.log(`   ${err.error}`);
                    });
                }
            }
        } catch (e) {}
        
        // 显示实际处理统计
        console.log('\n文件处理详情:');
        let totalShouldProcess = 0;
        let totalActuallyProcessed = 0;
        let totalLocalArticles = 0;
        
        for (const urlFile of this.urlFiles) {
            const siteName = this.getWebsiteName(urlFile);
            let shouldProcess = 0;
            let actuallyProcessed = 0;
            let localArticles = 0;
            
            // 读取原始文件
            if (fs.existsSync(urlFile)) {
                const urls = fs.readFileSync(urlFile, 'utf8')
                    .split('\n')
                    .filter(line => line.includes('http'));
                shouldProcess = urls.length;
            }
            
            // 检查实际处理情况
            const progressFile = `batch_progress_${path.basename(urlFile, '.txt')}.json`;
            if (fs.existsSync(progressFile)) {
                try {
                    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
                    actuallyProcessed = progress.processedArticles || 0;
                } catch (e) {}
            }
            
            // 检查本地文件
            const today = new Date().toISOString().split('T')[0];
            const todayDir = path.join(__dirname, 'golf_content', today, 'wechat_ready');
            if (fs.existsSync(todayDir)) {
                // 根据网站名称模糊匹配文章
                const articles = fs.readdirSync(todayDir)
                    .filter(f => f.startsWith('wechat_article_') && f.endsWith('.md'));
                localArticles = articles.length; // 暂时显示总数，后续可以根据内容精确匹配
            }
            
            if (shouldProcess > 0) {
                const percentage = (actuallyProcessed / shouldProcess * 100).toFixed(1);
                console.log(`  ${siteName.padEnd(20)}: ${actuallyProcessed}/${shouldProcess} (${percentage}%)`);
                totalShouldProcess += shouldProcess;
                totalActuallyProcessed += actuallyProcessed;
                totalLocalArticles = localArticles;
            }
        }
        
        console.log(`\n总体进度:`);
        console.log(`  应处理: ${totalShouldProcess} 个URL`);
        console.log(`  已处理: ${totalActuallyProcessed} 个URL`);
        console.log(`  本地文章: ${totalLocalArticles} 篇`);
        console.log(`  完成率: ${totalShouldProcess > 0 ? (totalActuallyProcessed/totalShouldProcess*100).toFixed(1) : 0}%`);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    /**
     * 主处理循环
     */
    async processAll(urlFiles) {
        this.urlFiles = urlFiles;
        this.processingStartTime = Date.now(); // 记录开始时间
        this.log(`📋 开始智能并发处理，共${urlFiles.length}个网站`);
        
        // 检查并恢复中断的任务
        const hasInterruptions = this.checkAndResumeInterruptions();
        if (hasInterruptions) {
            console.log(`📌 将优先处理上次中断的任务`);
        }
        
        // 初始化状态文件
        this.updateStatusFile();
        
        let index = 0;
        
        // 创建定期输出改写统计的定时器
        const rewriteStatsInterval = setInterval(() => {
            if (this.currentProcesses.length > 0) {
                const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${timestamp}] 📊 改写统计 | 活跃处理器: ${this.currentProcesses.length} | 已完成: ${this.rewriteStats.completedArticles} | 改写中: ${this.rewriteStats.rewritingArticles}`);
            }
        }, 5000);
        
        // 定期检查API压力和超时进程
        const pressureCheckInterval = setInterval(async () => {
            // 空闲检测
            if (this.currentProcesses.length === 0 && index >= this.urlFiles.length) {
                this.consecutiveIdleCycles++;
                this.log(`⏳ 空闲检测 (${this.consecutiveIdleCycles}/${this.IDLE_EXIT_THRESHOLD})`);
                
                if (this.consecutiveIdleCycles >= this.IDLE_EXIT_THRESHOLD) {
                    console.log('\n✅ 检测到持续空闲，所有任务可能已完成');
                    console.log('🔍 建议检查：');
                    console.log('   1. ls golf_content/$(date +%Y-%m-%d)/wechat_ready/ | wc -l');
                    console.log('   2. node auto_scrape_three_sites.js --all-sites（生成新URL）');
                    clearInterval(pressureCheckInterval);
                    clearInterval(rewriteStatsInterval);
                    process.exit(0);
                }
            } else {
                this.consecutiveIdleCycles = 0;
            }
            
            this.checkTimeoutProcesses();
            
            // 显示进度汇总（每30秒显示一次）
            if (this.currentProcesses.length > 0 || (index < this.urlFiles.length && this.stats.processed > 0)) {
                this.displayProgressSummary();
            }
            
            // 动态调整并发 - 无限制版本
            if (index < this.urlFiles.length) {
                const recommendedConcurrency = await this.getRecommendedConcurrency();
                
                // 可以启动多个新进程
                while (index < this.urlFiles.length && this.currentProcesses.length < recommendedConcurrency) {
                    const urlFile = this.urlFiles[index++];
                    this.startBatchProcess(urlFile).catch(err => {
                        this.log(`❌ 启动失败: ${err.message}`);
                    });
                    
                    // 根据API响应速度调整启动间隔
                    if (this.currentProcesses.length > 1) {
                        const delay = this.responseTimeWindow.length > 0 
                            ? Math.min(5000, Math.max(1000, this.responseTimeWindow[this.responseTimeWindow.length - 1] * 100))
                            : 3000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            // 检查是否真正完成（基于URL级别）
            if (index >= this.urlFiles.length && this.currentProcesses.length === 0) {
                // 同步最新状态
                this.syncBatchProgress();
                
                // 计算实际完成情况
                let totalUrlsExpected = this.dedupStats.processed; // 期望处理的新URL数
                let totalUrlsActuallyProcessed = 0;
                let totalUrlsFailed = 0;
                let unprocessedUrls = [];
                
                for (const [file, status] of Object.entries(this.processingStatus)) {
                    if (status.status === 'completed') {
                        const processed = status.processedUrls || status.processedArticles || 0;
                        const failed = status.failedCount || 0;
                        totalUrlsActuallyProcessed += processed;
                        totalUrlsFailed += failed;
                    } else if (status.status === 'processing' || status.status === 'pending') {
                        // 记录未完成的文件
                        const totalUrls = status.totalUrls || 0;
                        const processed = status.processedUrls || status.processedArticles || 0;
                        const remaining = totalUrls - processed;
                        if (remaining > 0) {
                            unprocessedUrls.push({
                                file: file,
                                remaining: remaining,
                                total: totalUrls
                            });
                        }
                    }
                }
                
                // 如果有未处理的URL，不退出
                if (unprocessedUrls.length > 0) {
                    console.log(`\n⚠️ 检测到未完成的处理任务：`);
                    unprocessedUrls.forEach(item => {
                        console.log(`   - ${item.file}: 还有 ${item.remaining} 个URL未处理`);
                    });
                    console.log(`\n🔄 系统将继续监控，等待处理完成...`);
                    
                    // 尝试重启失败的处理器
                    if (this.currentProcesses.length === 0) {
                        console.log(`\n🚀 尝试重新启动处理器...`);
                        // 重置index以重新扫描未完成的文件
                        index = 0;
                    }
                } else {
                    // 真正完成了
                    clearInterval(pressureCheckInterval);
                    clearInterval(rewriteStatsInterval);
                    this.log(`🎉 所有处理完成！`);
                    console.log('\n📊 最终处理报告：');
                    console.log(`   总计URL: ${this.dedupStats.total}`);
                    console.log(`   重复跳过: ${this.dedupStats.skipped} (${(this.dedupStats.skipped/this.dedupStats.total*100).toFixed(1)}%)`);
                    console.log(`   期望处理: ${this.dedupStats.processed}`);
                    console.log(`   成功处理: ${totalUrlsActuallyProcessed}`);
                    console.log(`   处理失败: ${totalUrlsFailed}`);
                    console.log(`   处理成功率: ${(totalUrlsActuallyProcessed/this.dedupStats.processed*100).toFixed(1)}%`);
                    
                    if (totalUrlsFailed > 0) {
                        console.log(`\n⚠️ 有 ${totalUrlsFailed} 个URL处理失败，可能需要检查：`);
                        console.log(`   - Claude API状态`);
                        console.log(`   - 网站访问限制`);
                        console.log(`   - 文章内容格式`);
                    }
                    
                    // 保存最终状态
                    this.updateStatusFile();
                    process.exit(0);
                }
            }
        }, this.checkInterval);
        
        // 立即开始处理 - 动态启动
        const initialConcurrency = await this.getRecommendedConcurrency();
        this.log(`🚀 初始并发数: ${initialConcurrency}`);
        
        // 逐步启动进程
        for (let i = 0; i < initialConcurrency && index < this.urlFiles.length; i++) {
            const urlFile = this.urlFiles[index++];
            await this.startBatchProcess(urlFile);
            
            // 动态启动间隔：第一个立即，后续根据并发数递增延迟
            if (i < initialConcurrency - 1) {
                const delay = Math.min(5000, (i + 1) * 1500); // 1.5秒、3秒、4.5秒...
                this.log(`⏱️ 等待 ${delay/1000} 秒后启动下一个进程...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    /**
     * 全局错误恢复尝试
     */
    async attemptGlobalRecovery() {
        this.globalErrorMonitor.recoveryInProgress = true;
        console.log(`\n🔧 启动全局错误恢复程序...`);
        
        try {
            // 1. 停止所有处理器
            for (const processor of this.currentProcesses) {
                try {
                    processor.process.kill();
                } catch (e) {}
            }
            this.currentProcesses = [];
            
            // 2. 等待系统稳定
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            // 3. 重新初始化
            console.log(`🔄 重新初始化系统...`);
            
            // 4. 继续处理剩余任务
            if (this.urlFiles.length > 0) {
                console.log(`📋 继续处理剩余 ${this.urlFiles.length} 个文件`);
                // 处理逻辑会自动继续
            }
            
            this.globalErrorMonitor.recoveryInProgress = false;
            console.log(`✅ 全局恢复完成`);
            
        } catch (recoveryError) {
            console.error(`❌ 全局恢复失败:`, recoveryError);
            process.exit(1); // 无法恢复时才退出
        }
    }
}

// 全局控制器实例
let globalController = null;

// 全局错误捕获
process.on('uncaughtException', (error) => {
    console.error(`\n🚨 捕获未处理异常:`, error);
    
    if (globalController) {
        globalController.globalErrorMonitor.criticalErrors++;
        globalController.globalErrorMonitor.lastCriticalError = error;
        
        // 尝试优雅恢复
        if (!globalController.globalErrorMonitor.recoveryInProgress) {
            globalController.attemptGlobalRecovery();
        }
    } else {
        // 如果控制器还未初始化，直接退出
        console.error('❌ 控制器未初始化，无法恢复');
        process.exit(1);
    }
});

// 主程序
async function main() {
    console.log('🤖 智能并发控制器启动 - 无限制版本');
    console.log('📊 特性：');
    console.log('  - 🚀 无并发上限限制');
    console.log('  - 📈 根据API响应速度动态调整');
    console.log('  - ⚡ 响应快时自动增加并发');
    console.log('  - 🛡️ 响应慢时自动降低并发');
    console.log('  - 📊 实时性能监控和优化\n');
    
    // 收集所有URL文件（过滤掉参数）
    const urlFiles = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    
    if (urlFiles.length === 0) {
        // 自动查找所有deep_urls_*.txt文件（排除_deduped.txt临时文件）
        const allUrlFiles = fs.readdirSync('.')
            .filter(f => f.startsWith('deep_urls_') && f.endsWith('.txt') && !f.includes('_deduped'))
            .filter(f => {
                const content = fs.readFileSync(f, 'utf8').trim();
                return content.length > 0 && content.includes('http');
            });
        
        if (allUrlFiles.length === 0) {
            console.log('❌ 未找到任何URL文件');
            process.exit(1);
        }
        
        urlFiles.push(...allUrlFiles);
    }
    
    console.log(`📁 找到${urlFiles.length}个URL文件:`);
    urlFiles.forEach(f => console.log(`  - ${f}`));
    console.log('');
    
    const controller = new IntelligentConcurrentController();
    globalController = controller; // 设置全局实例
    
    // 在开始处理前，检查是否有未完成的批处理
    const incompleteBatch = controller.checkIncompleteBatch();
    if (incompleteBatch) {
        console.log(`\n🔄 发现未完成的批处理`);
        await controller.resumeIncompleteBatch(incompleteBatch);
    }
    
    await controller.validateStartup(urlFiles);
    await controller.processAll(urlFiles);
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n⚠️ 收到中断信号，正在优雅退出...');
    // 终止所有子进程
    const { execSync } = require('child_process');
    try {
        execSync('pkill -f batch_process_articles.js');
    } catch (e) {
        // 忽略错误
    }
    process.exit(0);
});

// 启动
if (require.main === module) {
    main().catch(err => {
        console.error('❌ 致命错误:', err);
        process.exit(1);
    });
}

module.exports = IntelligentConcurrentController;