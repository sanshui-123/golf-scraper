/**
 * 统一进度管理器 - 遵循"只留一个最优方案"原则
 * 所有进度更新都通过这个模块进行
 */
const fs = require('fs');
const path = require('path');

class UnifiedProgressManager {
    constructor() {
        this.progressFile = path.join(__dirname, 'system_progress.json');
        this.lockFile = path.join(__dirname, '.progress.lock');
        this.lastSaveTime = 0;
        this.saveInterval = 500; // 降低保存频率限制到500ms
    }

    // 获取当前进度（带文件锁保护）
    getCurrentProgress() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const data = fs.readFileSync(this.progressFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('读取进度失败:', error.message);
        }
        
        // 返回默认进度
        return {
            currentProgress: 0,
            totalArticles: 0,
            processedArticles: 0,
            successCount: 0,
            failedCount: 0,
            currentArticle: '',
            processStartTime: new Date().toISOString(),
            lastUpdateTime: new Date().toISOString(),
            status: 'idle',
            todayArticles: [],
            currentPhase: 'idle',
            phaseProgress: {
                url_generation: { status: 'pending', progress: 0, message: '等待启动...' },
                url_filtering: { status: 'pending', progress: 0, message: '等待启动...' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            },
            overallProgress: 0
        };
    }

    // 保存进度（带节流和锁保护）
    saveProgress(progress) {
        const now = Date.now();
        if (now - this.lastSaveTime < this.saveInterval) {
            return; // 节流保护
        }
        this.lastSaveTime = now;

        try {
            // 更新时间戳
            progress.lastUpdateTime = new Date().toISOString();
            
            // 原子性写入
            const tempFile = this.progressFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(progress, null, 2));
            fs.renameSync(tempFile, this.progressFile);
            
            console.log(`📊 进度已更新: ${progress.currentProgress}% (${progress.processedArticles}/${progress.totalArticles})`);
        } catch (error) {
            console.error('保存进度失败:', error.message);
        }
    }

    // 初始化批处理进度
    initBatchProcessing(totalArticles) {
        const progress = this.getCurrentProgress();
        
        // 更新批处理相关字段
        progress.currentProgress = 0;
        progress.totalArticles = totalArticles;
        progress.processedArticles = 0;
        progress.successCount = 0;
        progress.failedCount = 0;
        progress.currentArticle = '准备开始处理...';
        progress.processStartTime = new Date().toISOString();
        progress.status = 'processing';
        progress.todayArticles = [];
        
        // 更新阶段进度
        progress.currentPhase = 'batch_processing';
        if (!progress.phaseProgress) {
            progress.phaseProgress = {
                url_generation: { status: 'completed', progress: 100, message: '已完成' },
                url_filtering: { status: 'completed', progress: 100, message: '已完成' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            };
        }
        progress.phaseProgress.batch_processing = {
            status: 'running',
            progress: 0,
            message: `开始处理 ${totalArticles} 篇文章...`
        };
        progress.overallProgress = 50; // URL生成和过滤已完成，批处理占50%
        
        this.saveProgress(progress);
        console.log(`\n🚀 批处理初始化完成，共 ${totalArticles} 篇文章待处理`);
    }

    // 更新当前处理的文章
    updateCurrentArticle(articleNumber, totalArticles, url) {
        const progress = this.getCurrentProgress();
        
        // 计算进度百分比
        const percentage = Math.floor((articleNumber / totalArticles) * 100);
        
        progress.currentProgress = percentage;
        progress.processedArticles = articleNumber;
        progress.currentArticle = url;
        
        // 更新批处理阶段进度
        if (!progress.phaseProgress) {
            progress.phaseProgress = {
                url_generation: { status: 'completed', progress: 100, message: '已完成' },
                url_filtering: { status: 'completed', progress: 100, message: '已完成' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            };
        }
        progress.phaseProgress.batch_processing = {
            status: 'running',
            progress: percentage,
            message: `正在处理第 ${articleNumber}/${totalArticles} 篇: ${url.substring(0, 50)}...`
        };
        
        // 总体进度 = 50% + (批处理进度 * 50%)
        progress.overallProgress = 50 + Math.floor(percentage * 0.5);
        
        this.saveProgress(progress);
    }

    // 记录成功
    recordSuccess(articleId, articleNumber) {
        const progress = this.getCurrentProgress();
        
        progress.successCount++;
        
        // 添加到今日文章列表
        const today = new Date().toISOString().split('T')[0];
        progress.todayArticles.push({
            id: articleId,
            number: articleNumber,
            time: new Date().toISOString(),
            status: 'success'
        });
        
        // 保持最新的20篇
        if (progress.todayArticles.length > 20) {
            progress.todayArticles = progress.todayArticles.slice(-20);
        }
        
        this.saveProgress(progress);
        console.log(`✅ 文章 ${articleId} 处理成功 (${progress.successCount}/${progress.processedArticles})`);
    }

    // 记录失败
    recordFailure(url, reason) {
        const progress = this.getCurrentProgress();
        
        progress.failedCount++;
        
        // 记录失败信息
        progress.todayArticles.push({
            url: url,
            time: new Date().toISOString(),
            status: 'failed',
            reason: reason
        });
        
        // 保持最新的20篇
        if (progress.todayArticles.length > 20) {
            progress.todayArticles = progress.todayArticles.slice(-20);
        }
        
        this.saveProgress(progress);
        console.log(`❌ 文章处理失败 (${progress.failedCount} 个失败)`);
    }

    // 完成批处理
    finishBatchProcessing() {
        const progress = this.getCurrentProgress();
        
        progress.status = 'completed';
        progress.currentProgress = 100;
        progress.currentArticle = '所有文章处理完成';
        
        // 更新阶段进度
        if (!progress.phaseProgress) {
            progress.phaseProgress = {
                url_generation: { status: 'completed', progress: 100, message: '已完成' },
                url_filtering: { status: 'completed', progress: 100, message: '已完成' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            };
        }
        progress.phaseProgress.batch_processing = {
            status: 'completed',
            progress: 100,
            message: `处理完成: ${progress.successCount} 成功, ${progress.failedCount} 失败`
        };
        progress.overallProgress = 100;
        
        this.saveProgress(progress);
        console.log(`\n🎉 批处理完成！成功: ${progress.successCount}, 失败: ${progress.failedCount}`);
    }

    // URL生成阶段
    updateUrlGeneration(status, message) {
        const progress = this.getCurrentProgress();
        
        progress.currentPhase = 'url_generation';
        if (!progress.phaseProgress) {
            progress.phaseProgress = {
                url_generation: { status: 'pending', progress: 0, message: '等待启动...' },
                url_filtering: { status: 'pending', progress: 0, message: '等待启动...' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            };
        }
        progress.phaseProgress.url_generation = {
            status: status,
            progress: status === 'completed' ? 100 : 50,
            message: message
        };
        progress.overallProgress = status === 'completed' ? 25 : 10;
        
        this.saveProgress(progress);
    }

    // URL过滤阶段
    updateUrlFiltering(status, message, filtered, total) {
        const progress = this.getCurrentProgress();
        
        progress.currentPhase = 'url_filtering';
        if (!progress.phaseProgress) {
            progress.phaseProgress = {
                url_generation: { status: 'completed', progress: 100, message: '已完成' },
                url_filtering: { status: 'pending', progress: 0, message: '等待启动...' },
                batch_processing: { status: 'pending', progress: 0, message: '等待启动...' }
            };
        }
        progress.phaseProgress.url_filtering = {
            status: status,
            progress: status === 'completed' ? 100 : 50,
            message: message,
            filtered: filtered,
            total: total
        };
        progress.overallProgress = status === 'completed' ? 50 : 35;
        
        this.saveProgress(progress);
    }

    // 重置为空闲状态
    setIdle() {
        const progress = this.getCurrentProgress();
        
        progress.status = 'idle';
        progress.currentPhase = 'idle';
        progress.currentArticle = '';
        progress.overallProgress = 0;
        
        this.saveProgress(progress);
    }
}

// 导出单例
module.exports = new UnifiedProgressManager();