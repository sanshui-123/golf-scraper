const fs = require('fs');
const path = require('path');

class BatchProgressTracker {
    constructor() {
        this.progressFile = path.join(__dirname, 'batch_progress.json');
        this.progress = {
            startTime: null,
            currentTime: null,
            totalArticles: 0,
            currentIndex: 0,
            processedArticles: 0,
            successfulArticles: 0,
            failedArticles: 0,
            currentArticle: {
                index: 0,
                url: '',
                title: '',
                status: 'idle', // idle, fetching, rewriting, saving, completed, failed
                startTime: null,
                message: ''
            },
            logs: [], // 最近的操作日志
            isRunning: false,
            processId: null
        };
    }

    // 初始化进度
    initialize(totalArticles, processId) {
        this.progress = {
            startTime: new Date().toISOString(),
            currentTime: new Date().toISOString(),
            totalArticles,
            currentIndex: 0,
            processedArticles: 0,
            successfulArticles: 0,
            failedArticles: 0,
            currentArticle: {
                index: 0,
                url: '',
                title: '',
                status: 'idle',
                startTime: null,
                message: ''
            },
            logs: [],
            isRunning: true,
            processId
        };
        this.save();
        this.addLog('系统启动', `开始处理 ${totalArticles} 篇文章`);
    }

    // 更新当前处理的文章
    updateCurrentArticle(index, url, status, message = '') {
        this.progress.currentIndex = index;
        this.progress.currentArticle = {
            index,
            url,
            title: this.progress.currentArticle.title || url,
            status,
            startTime: status === 'fetching' ? new Date().toISOString() : this.progress.currentArticle.startTime,
            message
        };
        this.progress.currentTime = new Date().toISOString();
        
        // 添加到日志
        if (message) {
            this.addLog(`文章 ${index}/${this.progress.totalArticles}`, message);
        }
        
        this.save();
    }

    // 更新文章标题
    updateArticleTitle(title) {
        if (this.progress.currentArticle) {
            this.progress.currentArticle.title = title;
            this.save();
        }
    }

    // 文章处理完成
    articleCompleted(success = true) {
        this.progress.processedArticles++;
        if (success) {
            this.progress.successfulArticles++;
            this.addLog(`成功`, `第 ${this.progress.currentIndex} 篇文章处理成功`);
        } else {
            this.progress.failedArticles++;
            this.addLog(`失败`, `第 ${this.progress.currentIndex} 篇文章处理失败`);
        }
        this.progress.currentTime = new Date().toISOString();
        this.save();
    }

    // 添加日志
    addLog(type, message) {
        const log = {
            time: new Date().toISOString(),
            type,
            message
        };
        
        this.progress.logs.unshift(log);
        
        // 只保留最近50条日志
        if (this.progress.logs.length > 50) {
            this.progress.logs = this.progress.logs.slice(0, 50);
        }
        
        this.save();
    }

    // 完成所有处理
    complete() {
        this.progress.isRunning = false;
        this.progress.currentTime = new Date().toISOString();
        this.addLog('完成', `所有文章处理完成。成功: ${this.progress.successfulArticles}, 失败: ${this.progress.failedArticles}`);
        this.save();
    }

    // 保存进度
    save() {
        try {
            fs.writeFileSync(this.progressFile, JSON.stringify(this.progress, null, 2));
        } catch (error) {
            console.error('保存进度失败:', error.message);
        }
    }

    // 读取进度
    load() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const data = fs.readFileSync(this.progressFile, 'utf8');
                this.progress = JSON.parse(data);
                return this.progress;
            }
        } catch (error) {
            console.error('读取进度失败:', error.message);
        }
        return this.progress;
    }

    // 获取当前进度
    getProgress() {
        return this.progress;
    }

    // 计算预计剩余时间
    getETA() {
        if (!this.progress.startTime || this.progress.processedArticles === 0) {
            return '计算中...';
        }

        const elapsed = Date.now() - new Date(this.progress.startTime).getTime();
        const avgTimePerArticle = elapsed / this.progress.processedArticles;
        const remaining = this.progress.totalArticles - this.progress.processedArticles;
        const eta = remaining * avgTimePerArticle;

        // 格式化时间
        const hours = Math.floor(eta / 3600000);
        const minutes = Math.floor((eta % 3600000) / 60000);
        const seconds = Math.floor((eta % 60000) / 1000);

        if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds}秒`;
        } else {
            return `${seconds}秒`;
        }
    }
}

module.exports = BatchProgressTracker;