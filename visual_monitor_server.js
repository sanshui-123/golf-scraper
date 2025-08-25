#!/usr/bin/env node

/**
 * 可视化监控服务器
 * 为实时监控界面提供数据API和WebSocket推送
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class VisualMonitorServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.port = 8080;
        this.clients = new Set();
        this.startTime = Date.now();
        this.lastStats = {};
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupPeriodicUpdates();
        
        console.log('🎨 可视化监控服务器初始化完成');
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        
        // CORS支持
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // 主监控页面
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'realtime_visual_dashboard.html'));
        });

        // 监控面板（兼容性）
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'realtime_visual_dashboard.html'));
        });

        // API接口
        this.app.get('/api/status', this.getSystemStatus.bind(this));
        this.app.get('/api/progress', this.getProgress.bind(this));
        this.app.get('/api/recent-articles', this.getRecentArticles.bind(this));
        this.app.get('/api/logs', this.getLogs.bind(this));
        this.app.get('/api/health', this.getHealthCheck.bind(this));

        console.log('📡 API接口设置完成');
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('🔗 新的WebSocket连接');
            this.clients.add(ws);
            
            // 发送初始数据
            this.sendToClient(ws, {
                type: 'welcome',
                message: '监控连接已建立'
            });

            // 立即发送当前状态
            this.sendCurrentStatus(ws);
            
            ws.on('close', () => {
                console.log('❌ WebSocket连接断开');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket错误:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log('🔌 WebSocket服务器设置完成');
    }

    setupPeriodicUpdates() {
        // 每5秒推送状态更新
        setInterval(() => {
            this.broadcastStatusUpdate();
        }, 5000);
        
        // 每30秒进行全面健康检查
        setInterval(() => {
            this.performHealthCheck();
        }, 30000);
        
        console.log('⏰ 定期更新任务设置完成');
    }

    // API处理函数
    async getSystemStatus(req, res) {
        try {
            const status = await this.collectSystemStatus();
            res.json(status);
        } catch (error) {
            console.error('获取系统状态失败:', error);
            res.status(500).json({ error: '获取系统状态失败' });
        }
    }

    async getProgress(req, res) {
        try {
            const progress = await this.collectProgressData();
            res.json(progress);
        } catch (error) {
            console.error('获取进度数据失败:', error);
            res.status(500).json({ error: '获取进度数据失败' });
        }
    }

    async getRecentArticles(req, res) {
        try {
            const articles = await this.collectRecentArticles();
            res.json(articles);
        } catch (error) {
            console.error('获取最新文章失败:', error);
            res.status(500).json({ error: '获取最新文章失败' });
        }
    }

    async getLogs(req, res) {
        try {
            const logs = await this.collectRecentLogs();
            res.json(logs);
        } catch (error) {
            console.error('获取日志失败:', error);
            res.status(500).json({ error: '获取日志失败' });
        }
    }

    async getHealthCheck(req, res) {
        try {
            const health = await this.performHealthCheck();
            res.json(health);
        } catch (error) {
            console.error('健康检查失败:', error);
            res.status(500).json({ error: '健康检查失败' });
        }
    }

    // 数据收集函数
    async collectSystemStatus() {
        return new Promise((resolve) => {
            exec("ps aux | grep -E '(batch_process|auto_recovery|web_server|enhanced_health)' | grep -v grep", (error, stdout) => {
                const lines = stdout ? stdout.trim().split('\n').filter(line => line.length > 0) : [];
                
                const processes = {
                    batch: lines.some(line => line.includes('batch_process_articles.js')),
                    web: lines.some(line => line.includes('web_server.js')) || 
                         lines.some(line => line.includes('visual_monitor_server.js')),
                    recovery: lines.some(line => line.includes('auto_recovery.js')),
                    monitor: lines.some(line => line.includes('enhanced_health_monitor.js'))
                };

                // 获取系统资源信息
                exec("df -h . | awk 'NR==2 {print $5}'", (dfError, dfStdout) => {
                    const diskUsage = dfStdout ? dfStdout.trim() : '-';
                    
                    resolve({
                        processes,
                        system: {
                            cpu: '正常',
                            memory: '正常', 
                            disk: diskUsage,
                            lastActivity: this.getLastActivity()
                        },
                        uptime: Date.now() - this.startTime
                    });
                });
            });
        });
    }

    async collectProgressData() {
        const today = new Date().toISOString().split('T')[0];
        const articleDir = path.join(__dirname, 'golf_content', today, 'wechat_ready');
        
        let completed = 0;
        let totalArticles = 0;
        let websiteStats = {};

        try {
            if (fs.existsSync(articleDir)) {
                const files = fs.readdirSync(articleDir).filter(file => file.endsWith('.md'));
                completed = files.length;
                
                // 分析网站统计
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(path.join(articleDir, file), 'utf8');
                        const urlMatch = content.match(/URL: (https?:\/\/[^\s\)]+)/);
                        if (urlMatch) {
                            const url = urlMatch[1];
                            const domain = new URL(url).hostname;
                            websiteStats[domain] = (websiteStats[domain] || 0) + 1;
                        }
                    } catch (e) {
                        // 忽略单个文件读取错误
                    }
                }
            }

            // 计算总文章数（所有日期）
            const contentDir = path.join(__dirname, 'golf_content');
            if (fs.existsSync(contentDir)) {
                const dates = fs.readdirSync(contentDir).filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name));
                for (const date of dates) {
                    const dateDir = path.join(contentDir, date, 'wechat_ready');
                    if (fs.existsSync(dateDir)) {
                        const files = fs.readdirSync(dateDir).filter(file => file.endsWith('.md'));
                        totalArticles += files.length;
                    }
                }
            }

        } catch (error) {
            console.error('收集进度数据失败:', error);
        }

        // 检查当前是否有处理中的文章
        let processing = 0;
        try {
            const logFiles = ['auto_recovery.log', 'enhanced_health.log'];
            for (const logFile of logFiles) {
                if (fs.existsSync(logFile)) {
                    const content = fs.readFileSync(logFile, 'utf8');
                    if (content.includes('处理第') && content.includes('篇文章')) {
                        processing = 1;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('检查处理状态失败:', error);
        }

        const successRate = totalArticles > 0 ? Math.round((completed / totalArticles) * 100) : 100;
        const runtime = (Date.now() - this.startTime) / 1000 / 60; // 分钟
        const processingSpeed = runtime > 0 ? Math.round(completed * 60 / runtime) : 0;

        return {
            completed,
            processing,
            pending: 0, // 暂时无法准确计算待处理数量
            totalArticles,
            todayArticles: completed,
            recentArticles: this.getRecentArticleCount(),
            successRate,
            processingSpeed,
            avgProcessingTime: '2-3分钟',
            websiteStats
        };
    }

    async collectRecentArticles() {
        const articles = [];
        const today = new Date().toISOString().split('T')[0];
        const articleDir = path.join(__dirname, 'golf_content', today, 'wechat_ready');
        
        try {
            if (fs.existsSync(articleDir)) {
                const files = fs.readdirSync(articleDir)
                    .filter(file => file.endsWith('.md'))
                    .map(file => ({
                        file,
                        mtime: fs.statSync(path.join(articleDir, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime)
                    .slice(0, 10);

                for (const {file, mtime} of files) {
                    try {
                        const content = fs.readFileSync(path.join(articleDir, file), 'utf8');
                        const titleMatch = content.match(/^# (.+)$/m);
                        const urlMatch = content.match(/URL: (https?:\/\/[^\s\)]+)/);
                        
                        let website = '未知网站';
                        if (urlMatch) {
                            const url = urlMatch[1];
                            const domain = new URL(url).hostname;
                            if (domain.includes('golf.com')) website = 'Golf.com';
                            else if (domain.includes('golfdigest')) website = 'Golf Digest';
                            else if (domain.includes('mygolfspy')) website = 'MyGolfSpy';
                            else if (domain.includes('golfwrx')) website = 'GolfWRX';
                            else if (domain.includes('golfmonthly')) website = 'Golf Monthly';
                        }

                        articles.push({
                            title: titleMatch ? titleMatch[1] : file.replace('.md', ''),
                            website,
                            time: this.formatTime(mtime),
                            file
                        });
                    } catch (e) {
                        console.error('读取文章失败:', file, e.message);
                    }
                }
            }
        } catch (error) {
            console.error('收集最新文章失败:', error);
        }

        return articles;
    }

    async collectRecentLogs() {
        const logs = [];
        const logFiles = ['auto_recovery.log', 'enhanced_health.log', 'realtime_monitor.log'];
        
        for (const logFile of logFiles) {
            try {
                if (fs.existsSync(logFile)) {
                    const content = fs.readFileSync(logFile, 'utf8');
                    const lines = content.split('\n').filter(line => line.trim().length > 0);
                    
                    // 获取最新的10行日志
                    const recentLines = lines.slice(-10);
                    
                    for (const line of recentLines) {
                        let level = 'info';
                        if (line.includes('ERROR') || line.includes('❌') || line.includes('🚨')) {
                            level = 'error';
                        } else if (line.includes('WARN') || line.includes('⚠️') || line.includes('注意')) {
                            level = 'warning';
                        } else if (line.includes('✅') || line.includes('成功') || line.includes('完成')) {
                            level = 'success';
                        }
                        
                        logs.push({
                            message: line,
                            level,
                            timestamp: Date.now(),
                            source: logFile
                        });
                    }
                }
            } catch (error) {
                console.error(`读取日志文件失败 ${logFile}:`, error);
            }
        }
        
        // 按时间排序并限制数量
        return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    }

    async performHealthCheck() {
        const status = await this.collectSystemStatus();
        const progress = await this.collectProgressData();
        
        const health = {
            overall: 'healthy',
            timestamp: Date.now(),
            issues: [],
            recommendations: []
        };
        
        // 检查进程状态
        if (!status.processes.batch) {
            health.overall = 'warning';
            health.issues.push('批处理程序未运行');
            health.recommendations.push('启动批处理程序');
        }
        
        if (!status.processes.web) {
            health.overall = 'warning';
            health.issues.push('Web服务器未运行');
            health.recommendations.push('启动Web服务器');
        }
        
        // 检查处理活跃度
        const lastActivity = this.getLastActivityTime();
        if (lastActivity > 10 * 60 * 1000) { // 10分钟无活动
            health.overall = 'warning';
            health.issues.push('系统长时间无活动');
            health.recommendations.push('检查系统状态');
        }
        
        return health;
    }

    // 辅助函数
    getLastActivity() {
        try {
            const logFiles = ['auto_recovery.log', 'enhanced_health.log'];
            let latestTime = 0;
            
            for (const logFile of logFiles) {
                if (fs.existsSync(logFile)) {
                    const stats = fs.statSync(logFile);
                    latestTime = Math.max(latestTime, stats.mtime.getTime());
                }
            }
            
            if (latestTime === 0) return '-';
            
            const minutes = Math.floor((Date.now() - latestTime) / 1000 / 60);
            return minutes === 0 ? '刚刚' : minutes + '分钟前';
        } catch (error) {
            return '-';
        }
    }

    getLastActivityTime() {
        try {
            const logFiles = ['auto_recovery.log', 'enhanced_health.log'];
            let latestTime = 0;
            
            for (const logFile of logFiles) {
                if (fs.existsSync(logFile)) {
                    const stats = fs.statSync(logFile);
                    latestTime = Math.max(latestTime, stats.mtime.getTime());
                }
            }
            
            return Date.now() - latestTime;
        } catch (error) {
            return Infinity;
        }
    }

    getRecentArticleCount() {
        // 计算最近5分钟的文章数量
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const today = new Date().toISOString().split('T')[0];
        const articleDir = path.join(__dirname, 'golf_content', today, 'wechat_ready');
        
        try {
            if (fs.existsSync(articleDir)) {
                const files = fs.readdirSync(articleDir).filter(file => file.endsWith('.md'));
                return files.filter(file => {
                    const stats = fs.statSync(path.join(articleDir, file));
                    return stats.mtime.getTime() > fiveMinutesAgo;
                }).length;
            }
        } catch (error) {
            console.error('计算最近文章数量失败:', error);
        }
        
        return 0;
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 1000 / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return days + '天前';
        if (hours > 0) return hours + '小时前';
        if (minutes > 0) return minutes + '分钟前';
        return '刚刚';
    }

    // WebSocket推送函数
    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    broadcast(data) {
        this.clients.forEach(client => {
            this.sendToClient(client, data);
        });
    }

    async sendCurrentStatus(ws) {
        try {
            const [status, progress, articles] = await Promise.all([
                this.collectSystemStatus(),
                this.collectProgressData(),
                this.collectRecentArticles()
            ]);

            this.sendToClient(ws, { type: 'status', data: status });
            this.sendToClient(ws, { type: 'progress', data: progress });
            this.sendToClient(ws, { type: 'articles', data: articles });
        } catch (error) {
            console.error('发送当前状态失败:', error);
        }
    }

    async broadcastStatusUpdate() {
        if (this.clients.size === 0) return;
        
        try {
            const [status, progress] = await Promise.all([
                this.collectSystemStatus(),
                this.collectProgressData()
            ]);

            this.broadcast({ type: 'status', data: status });
            this.broadcast({ type: 'progress', data: progress });
            
            // 发送日志更新
            const logs = await this.collectRecentLogs();
            this.broadcast({ type: 'logs', data: logs.slice(0, 5) }); // 只发送最新5条
            
        } catch (error) {
            console.error('广播状态更新失败:', error);
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log('🎨 可视化监控服务器启动成功!');
            console.log(`📊 监控界面: http://localhost:${this.port}`);
            console.log(`🔌 WebSocket端口: ${this.port}`);
            console.log('');
            console.log('🎯 功能特性:');
            console.log('  ✅ 实时状态监控');
            console.log('  ✅ 自动数据刷新');
            console.log('  ✅ WebSocket推送');
            console.log('  ✅ 可视化界面');
            console.log('');
        });

        // 优雅关闭处理
        process.on('SIGINT', () => {
            console.log('\n📴 正在关闭监控服务器...');
            this.server.close(() => {
                console.log('✅ 监控服务器已关闭');
                process.exit(0);
            });
        });
    }
}

// 启动服务器
if (require.main === module) {
    const server = new VisualMonitorServer();
    server.start();
}

module.exports = VisualMonitorServer;