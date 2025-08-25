/**
 * Golf Content Processing Dashboard - JavaScript
 * 深色主题实时监控面板的前端逻辑
 */

class GolfDashboard {
    constructor() {
        // 数据缓存
        this.currentData = {
            progress: 0,
            completed: 0,
            failed: 0,
            queue: 0,
            retries: 0,
            currentArticle: null,
            activities: [],
            errors: {
                timeout: 0,
                network: 0,
                parse: 0,
                other: 0
            }
        };
        
        this.init();
    }

    /**
     * 初始化面板
     */
    init() {
        console.log('🏌️ Golf Dashboard 初始化...');
        
        // 设置定时刷新（主要更新机制）
        this.setupPeriodicRefresh();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化数据获取
        this.fetchInitialData();
        
        // 更新连接状态为正常（使用HTTP轮询）
        this.updateConnectionStatus(true);
        
        console.log('✅ Dashboard 初始化完成');
    }


    /**
     * 处理实时更新
     */
    handleRealtimeUpdate(data) {
        console.log('📊 收到实时更新:', data);
        
        switch (data.type) {
            case 'progress':
                this.updateProgress(data.payload);
                break;
            case 'current_article':
                this.updateCurrentArticle(data.payload);
                break;
            case 'activity':
                this.addActivity(data.payload);
                break;
            case 'error':
                this.updateErrorStats(data.payload);
                break;
            case 'stats':
                this.updateStats(data.payload);
                break;
            case 'stage_change':
                this.updateStage(data.payload);
                break;
            default:
                console.log('未知的更新类型:', data.type);
        }
    }

    /**
     * 更新整体进度
     */
    updateProgress(data) {
        this.currentData.progress = data.percentage || 0;
        
        document.getElementById('overall-progress').textContent = `${Math.round(this.currentData.progress)}%`;
        document.getElementById('progress-text').textContent = 
            `正在处理第 ${data.current || 0} 篇，总共 ${data.total || 0} 篇`;
        
        if (data.eta) {
            document.getElementById('eta-text').textContent = `预计剩余时间: ${data.eta}`;
        }
        
        // 更新文章进度条
        const articleProgress = document.getElementById('article-progress');
        if (articleProgress) {
            articleProgress.style.width = `${this.currentData.progress}%`;
        }
    }

    /**
     * 更新当前处理的文章
     */
    updateCurrentArticle(data) {
        this.currentData.currentArticle = data;
        
        const titleEl = document.getElementById('current-title');
        const urlEl = document.getElementById('current-url');
        
        if (data.title) {
            titleEl.textContent = data.title;
            titleEl.title = data.title; // 完整标题在tooltip中显示
        }
        
        if (data.url) {
            urlEl.textContent = data.url;
            urlEl.title = data.url;
        }
        
        // 显示处理状态
        const loader = document.getElementById('processing-loader');
        if (data.status === 'processing') {
            loader.style.display = 'inline-block';
        } else {
            loader.style.display = 'none';
        }
    }

    /**
     * 更新处理阶段
     */
    updateStage(data) {
        const stageBadge = document.getElementById('stage-badge');
        const stageTime = document.getElementById('stage-time');
        
        if (stageBadge) {
            stageBadge.className = `stage-badge stage-${data.stage}`;
            stageBadge.textContent = `阶段${data.stage}: ${this.getStageText(data.stage)}`;
        }
        
        if (stageTime && data.elapsedTime) {
            stageTime.textContent = data.elapsedTime;
        }
    }

    /**
     * 获取阶段文本
     */
    getStageText(stage) {
        const stageTexts = {
            1: '正常处理',
            2: '警告模式',
            3: '精简模式',
            4: '强制终止'
        };
        return stageTexts[stage] || '未知阶段';
    }

    /**
     * 更新统计数据
     */
    updateStats(data) {
        this.currentData = { ...this.currentData, ...data };
        
        document.getElementById('completed-count').textContent = data.completed || 0;
        document.getElementById('failed-count').textContent = data.failed || 0;
        document.getElementById('queue-count').textContent = data.queue || 0;
        document.getElementById('retry-count').textContent = data.retries || 0;
    }

    /**
     * 添加活动记录
     */
    addActivity(data) {
        this.currentData.activities.unshift(data);
        
        // 限制活动记录数量
        if (this.currentData.activities.length > 50) {
            this.currentData.activities = this.currentData.activities.slice(0, 50);
        }
        
        this.updateActivityList();
    }

    /**
     * 更新活动列表
     */
    updateActivityList() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        const activities = this.currentData.activities.slice(0, 10); // 只显示最近10条
        
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <span class="activity-time">${this.formatTime(activity.time)}</span>
                <span class="activity-source">${activity.source || 'System'}</span>
                <span class="activity-title" title="${activity.title}">${activity.title}</span>
                <span class="activity-status">${this.getStatusIcon(activity.status)}</span>
            </div>
        `).join('') || '<div class="activity-item"><span class="activity-title">暂无活动记录</span></div>';
    }

    /**
     * 更新错误统计
     */
    updateErrorStats(data) {
        if (data.errors) {
            this.currentData.errors = { ...this.currentData.errors, ...data.errors };
        }
        
        this.updateErrorChart();
    }

    /**
     * 更新错误图表
     */
    updateErrorChart() {
        const errors = this.currentData.errors;
        const total = Object.values(errors).reduce((sum, count) => sum + count, 0);
        
        if (total === 0) return;
        
        Object.entries(errors).forEach(([type, count]) => {
            const percentage = (count / total) * 100;
            const element = document.getElementById(`${type === 'timeout' ? 'timeout' : 
                                                    type === 'network' ? 'network' : 
                                                    type === 'parse' ? 'parse' : 'other'}-errors`);
            
            if (element) {
                element.style.width = `${percentage}%`;
                element.querySelector('.error-count').textContent = count.toString();
            }
        });
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            'success': '✅',
            'failed': '❌',
            'processing': '🔄',
            'warning': '⚠️',
            'timeout': '⏰',
            'retry': '🔄'
        };
        return icons[status] || '📄';
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '--:--';
        
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }



    /**
     * 设置定期刷新
     */
    setupPeriodicRefresh() {
        // 每5秒刷新一次数据（主要更新机制）
        setInterval(() => {
            this.fetchDashboardData();
        }, 5000);
        
        // 每10秒刷新待处理URL
        setInterval(() => {
            this.fetchPendingUrls();
        }, 10000);
        
        // 每3秒刷新详细进度
        setInterval(() => {
            this.fetchDetailedProgress();
        }, 3000);
        
        // 初始加载
        this.fetchPendingUrls();
        this.fetchDetailedProgress();
    }
    
    /**
     * 获取待处理URL列表
     */
    fetchPendingUrls() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:8080/api/pending-urls', true);
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    this.displayPendingUrls(data);
                } catch (e) {
                    console.error('解析待处理URL失败:', e);
                }
            }
        };
        
        xhr.onerror = () => {
            console.error('获取待处理URL失败');
        };
        
        xhr.send();
    }
    
    /**
     * 显示待处理URL
     */
    displayPendingUrls(data) {
        const container = document.getElementById('pending-urls-container');
        if (!container) return;
        
        if (data.totalUrls === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无待处理URL</div>';
            return;
        }
        
        let html = `<div style="padding: 10px;">`;
        html += `<div style="margin-bottom: 10px; font-weight: bold;">总计: ${data.totalUrls} 个URL</div>`;
        
        for (const [site, urls] of Object.entries(data.urls)) {
            if (urls.length > 0) {
                html += `<div style="margin-bottom: 15px;">`;
                html += `<div style="color: var(--info); font-weight: bold; margin-bottom: 5px;">${site} (${urls.length})</div>`;
                html += `<div style="font-size: 12px; color: var(--text-secondary); max-height: 100px; overflow-y: auto;">`;
                urls.forEach(url => {
                    html += `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${url}">${url}</div>`;
                });
                html += `</div></div>`;
            }
        }
        
        html += `</div>`;
        container.innerHTML = html;
    }
    
    /**
     * 获取详细进度
     */
    fetchDetailedProgress() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:8080/api/detailed-progress', true);
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    this.displayProcessLogs(data);
                } catch (e) {
                    console.error('解析详细进度失败:', e);
                }
            }
        };
        
        xhr.onerror = () => {
            console.error('获取详细进度失败');
        };
        
        xhr.send();
    }
    
    /**
     * 显示处理日志
     */
    displayProcessLogs(data) {
        const logsContainer = document.getElementById('process-logs');
        if (!logsContainer) return;
        
        if (!data.logs || data.logs.length === 0) {
            logsContainer.innerHTML = '<div style="color: var(--text-secondary);">暂无日志...</div>';
            return;
        }
        
        // 显示最新的日志
        const logsHtml = data.logs.map(log => {
            // 根据日志内容添加颜色
            let color = 'var(--text-secondary)';
            if (log.includes('✅') || log.includes('成功')) color = 'var(--success)';
            else if (log.includes('❌') || log.includes('失败')) color = 'var(--error)';
            else if (log.includes('⚠️') || log.includes('警告')) color = 'var(--warning)';
            else if (log.includes('🚀') || log.includes('启动')) color = 'var(--info)';
            
            return `<div style="color: ${color}; margin-bottom: 2px;">${log}</div>`;
        }).join('');
        
        logsContainer.innerHTML = logsHtml;
        // 自动滚动到底部
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    /**
     * 获取初始数据
     */
    fetchInitialData() {
        this.fetchDashboardData();
        console.log('✅ 初始数据加载启动');
    }

    /**
     * 获取面板数据
     */
    fetchDashboardData() {
        // 使用XMLHttpRequest避免代理问题
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:8080/api/system-progress', true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const progress = JSON.parse(xhr.responseText);
                    this.updateSystemProgress(progress);
                    this.updateConnectionStatus(true);
                } catch (e) {
                    console.error('解析进度数据失败:', e);
                }
            } else {
                console.error('获取进度数据失败: HTTP', xhr.status);
                this.updateConnectionStatus(false);
            }
        };
        
        xhr.onerror = () => {
            console.error('获取进度数据失败: 网络错误');
            this.updateConnectionStatus(false);
        };
        
        xhr.send();
    }
    
    /**
     * 更新系统整体进度
     */
    updateSystemProgress(progress) {
        // 更新整体进度
        const percentage = progress.currentProgress || 0;
        document.getElementById('overall-progress').textContent = `${percentage}%`;
        
        // 更新当前处理信息
        if (progress.status === 'processing') {
            const current = progress.processedArticles || 0;
            const total = progress.totalArticles || 0;
            document.getElementById('progress-text').textContent = 
                `正在处理第 ${current} 篇，总共 ${total} 篇`;
            
            // 更新当前文章
            if (progress.currentArticle) {
                document.getElementById('current-title').textContent = '正在处理';
                document.getElementById('current-url').textContent = progress.currentArticle;
            }
            
            // 计算预计剩余时间
            if (current > 0 && total > 0) {
                const elapsed = new Date() - new Date(progress.processStartTime);
                const avgTime = elapsed / current;
                const remaining = (total - current) * avgTime;
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                document.getElementById('eta-text').textContent = 
                    `预计剩余时间: ${minutes}分${seconds}秒`;
            }
        } else if (progress.status === 'completed') {
            document.getElementById('progress-text').textContent = '处理完成';
            document.getElementById('eta-text').textContent = '预计剩余时间: 已完成';
        } else {
            document.getElementById('progress-text').textContent = '等待启动...';
            document.getElementById('eta-text').textContent = '预计剩余时间: --';
        }
        
        // 更新统计数据
        document.getElementById('completed-count').textContent = progress.successCount || 0;
        document.getElementById('failed-count').textContent = progress.failedCount || 0;
        document.getElementById('queue-count').textContent = 
            (progress.totalArticles || 0) - (progress.processedArticles || 0);
        }
    }

    /**
     * 更新面板数据
     */
    updateDashboardData(data) {
        if (data.progress) {
            this.updateProgress(data.progress);
        }
        
        if (data.current) {
            this.updateCurrentArticle(data.current);
        }
        
        if (data.stats) {
            this.updateStats(data.stats);
        }
        
        if (data.activities) {
            this.currentData.activities = data.activities;
            this.updateActivityList();
        }
        
        if (data.errors) {
            this.updateErrorStats(data);
        }
        
        if (data.stage) {
            this.updateStage(data.stage);
        }
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(connected) {
        const indicator = document.querySelector('.live-indicator');
        const dot = document.querySelector('.live-dot');
        
        // 始终显示为正常状态（使用HTTP轮询）
        indicator.style.color = 'var(--success)';
        dot.style.background = 'var(--success)';
        indicator.querySelector('span').textContent = '实时监控';
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 页面可见性变化时的处理
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 页面变为可见时，立即刷新数据
                this.fetchDashboardData();
            }
        });
        
        // 窗口焦点变化时的处理
        window.addEventListener('focus', () => {
            this.fetchDashboardData();
        });
        
        
        // 控制按钮事件
        this.bindControlButtons();
    }
    
    /**
     * 绑定控制按钮事件
     */
    bindControlButtons() {
        console.log('🎮 开始绑定控制按钮事件');
        const statusDiv = document.getElementById('control-status');
        
        // 智能启动按钮
        const smartStartBtn = document.getElementById('btn-smart-startup');
        if (smartStartBtn) {
            console.log('✅ 找到智能启动按钮');
            // 移除所有现有的事件监听器
            const newBtn = smartStartBtn.cloneNode(true);
            smartStartBtn.parentNode.replaceChild(newBtn, smartStartBtn);
            
            newBtn.addEventListener('click', (e) => {
                console.log('🚀 智能启动按钮被点击');
                e.preventDefault(); // 防止默认行为
                this.updateControlStatus('🚀 正在启动智能处理系统...');
                
                // 使用XMLHttpRequest避免代理问题
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'http://localhost:8080/api/control/smart-startup', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                xhr.onload = () => {
                    console.log('📨 收到响应:', xhr.status);
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            console.log('📊 响应数据:', result);
                            if (result.success) {
                                if (result.alreadyRunning) {
                                    this.updateControlStatus('ℹ️ 智能处理系统已在运行中');
                                } else {
                                    this.updateControlStatus('✅ 智能处理系统已启动');
                                }
                                // 启动后立即刷新数据
                                setTimeout(() => this.fetchDashboardData(), 1000);
                            } else {
                                this.updateControlStatus(`❌ 启动失败: ${result.error}`);
                            }
                        } catch (e) {
                            console.error('❌ 解析响应失败:', e);
                            this.updateControlStatus('❌ 请求失败: 解析响应失败');
                        }
                    } else {
                        this.updateControlStatus(`❌ 请求失败: HTTP ${xhr.status}`);
                    }
                };
                
                xhr.onerror = () => {
                    console.error('❌ 请求出错: 网络错误');
                    this.updateControlStatus('❌ 请求失败: 网络错误');
                    this.showProxyWarning();
                };
                
                console.log('📡 发送请求到 /api/control/smart-startup');
                xhr.send();
            });
        } else {
            console.error('❌ 未找到智能启动按钮');
        }
        
        // 仅批量处理按钮
        const batchOnlyBtn = document.getElementById('btn-batch-only');
        if (batchOnlyBtn) {
            batchOnlyBtn.addEventListener('click', () => {
                this.updateControlStatus('📦 正在启动批量处理...');
                
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'http://localhost:8080/api/control/batch-only', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            if (result.success) {
                                this.updateControlStatus('✅ 批量处理已启动');
                            } else {
                                this.updateControlStatus(`❌ 启动失败: ${result.error}`);
                            }
                        } catch (e) {
                            this.updateControlStatus('❌ 请求失败: 解析响应失败');
                        }
                    } else {
                        this.updateControlStatus(`❌ 请求失败: HTTP ${xhr.status}`);
                    }
                };
                
                xhr.onerror = () => {
                    this.updateControlStatus('❌ 请求失败: 网络错误');
                    this.showProxyWarning();
                };
                
                xhr.send();
            });
        }
        
        // 停止所有按钮
        const stopAllBtn = document.getElementById('btn-stop-all');
        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => {
                if (confirm('确定要停止所有处理进程吗？')) {
                    this.updateControlStatus('🛑 正在停止所有进程...');
                    
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', 'http://localhost:8080/api/control/stop-all', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    
                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                if (result.success) {
                                    this.updateControlStatus('✅ 所有进程已停止');
                                } else {
                                    this.updateControlStatus(`❌ 停止失败: ${result.error}`);
                                }
                            } catch (e) {
                                this.updateControlStatus('❌ 请求失败: 解析响应失败');
                            }
                        } else {
                            this.updateControlStatus(`❌ 请求失败: HTTP ${xhr.status}`);
                        }
                    };
                    
                    xhr.onerror = () => {
                        this.updateControlStatus('❌ 请求失败: 网络错误');
                    };
                    
                    xhr.send();
                }
            });
        }
        
        // 检查状态按钮
        const checkStatusBtn = document.getElementById('btn-check-status');
        if (checkStatusBtn) {
            checkStatusBtn.addEventListener('click', () => {
                this.updateControlStatus('🔍 正在检查系统状态...');
                
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'http://localhost:8080/api/control/check-status', true);
                xhr.setRequestHeader('Accept', 'application/json');
                
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            if (result.success) {
                                this.updateControlStatus(`✅ 系统状态: ${result.status}`);
                                // 立即刷新数据
                                this.fetchDashboardData();
                            } else {
                                this.updateControlStatus(`❌ 检查失败: ${result.error}`);
                            }
                        } catch (e) {
                            this.updateControlStatus('❌ 请求失败: 解析响应失败');
                        }
                    } else {
                        this.updateControlStatus(`❌ 请求失败: HTTP ${xhr.status}`);
                    }
                };
                
                xhr.onerror = () => {
                    this.updateControlStatus('❌ 请求失败: 网络错误');
                    this.showProxyWarning();
                };
                
                xhr.send();
            });
        }
    }
    
    /**
     * 更新控制状态显示
     */
    updateControlStatus(message) {
        console.log('📝 更新控制状态:', message);
        const statusDiv = document.getElementById('control-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = message.includes('❌') ? 'var(--error)' : 
                                   message.includes('✅') ? 'var(--success)' : 
                                   'var(--text-secondary)';
            
            // 清除之前的定时器
            if (this.statusTimeout) {
                clearTimeout(this.statusTimeout);
            }
            
            // 5秒后恢复默认状态
            this.statusTimeout = setTimeout(() => {
                statusDiv.textContent = '等待命令...';
                statusDiv.style.color = 'var(--text-secondary)';
            }, 5000);
        } else {
            console.error('❌ 未找到 control-status 元素');
        }
    }
    
    /**
     * 显示代理警告
     */
    showProxyWarning() {
        const warningDiv = document.getElementById('proxy-warning');
        if (warningDiv) {
            warningDiv.style.display = 'block';
            console.warn('⚠️ 显示代理警告提示');
        }
    }
    
    // 🎮 控制面板功能方法
    
    /**
     * 更新控制状态显示
     */
    updateControlStatus(message) {
        const statusElement = document.getElementById('controlStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.display = 'block';
            console.log('📝 控制状态更新:', message);
        }
    }
    
    /**
     * 启动智能处理系统
     */
    startSystem() {
        console.log('🚀 调用startSystem方法');
        this.updateControlStatus('🔄 正在启动智能处理系统...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:8080/api/control/smart-startup', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        this.updateControlStatus(`✅ ${result.message}`);
                        // 3秒后开始刷新数据
                        setTimeout(() => this.fetchDashboardData(), 3000);
                    } else {
                        this.updateControlStatus(`❌ 启动失败: ${result.error}`);
                    }
                } catch (e) {
                    this.updateControlStatus('❌ 启动失败: 解析响应失败');
                }
            } else {
                this.updateControlStatus(`❌ 启动失败: HTTP ${xhr.status}`);
            }
        };
        
        xhr.onerror = () => {
            this.updateControlStatus('❌ 启动失败: 网络错误');
            this.showProxyWarning();
        };
        
        console.log('📡 发送请求到 /api/control/smart-startup');
        xhr.send();
    }
    
    /**
     * 停止所有进程
     */
    stopAllProcesses() {
        console.log('⏹️ 调用stopAllProcesses方法');
        if (!confirm('确定要停止所有进程吗？')) {
            return;
        }
        
        this.updateControlStatus('🔄 正在停止所有进程...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:8080/api/control/stop-all', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        this.updateControlStatus(`✅ ${result.message}`);
                        // 更新界面状态
                        this.updateProgress(0, 0, 0, '已停止');
                    } else {
                        this.updateControlStatus(`❌ 停止失败: ${result.error}`);
                    }
                } catch (e) {
                    this.updateControlStatus('❌ 停止失败: 解析响应失败');
                }
            } else {
                this.updateControlStatus(`❌ 停止失败: HTTP ${xhr.status}`);
            }
        };
        
        xhr.onerror = () => {
            this.updateControlStatus('❌ 停止失败: 网络错误');
            this.showProxyWarning();
        };
        
        xhr.send();
    }
    
    /**
     * 启动仅批处理模式
     */
    startBatchOnly() {
        console.log('📦 调用startBatchOnly方法');
        this.updateControlStatus('🔄 正在启动批处理模式...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:8080/api/control/batch-only', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        this.updateControlStatus(`✅ ${result.message}`);
                        // 3秒后开始刷新数据
                        setTimeout(() => this.fetchDashboardData(), 3000);
                    } else {
                        this.updateControlStatus(`❌ 启动失败: ${result.error}`);
                    }
                } catch (e) {
                    this.updateControlStatus('❌ 启动失败: 解析响应失败');
                }
            } else {
                this.updateControlStatus(`❌ 启动失败: HTTP ${xhr.status}`);
            }
        };
        
        xhr.onerror = () => {
            this.updateControlStatus('❌ 启动失败: 网络错误');
            this.showProxyWarning();
        };
        
        xhr.send();
    }
    
    /**
     * 检查系统状态
     */
    checkSystemStatus() {
        console.log('🔍 调用checkSystemStatus方法');
        this.updateControlStatus('🔄 正在检查系统状态...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:8080/api/control/check-status', true);
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        const status = result.status;
                        let statusText = '📊 系统状态:\n';
                        statusText += `  • 批处理: ${status.batchProcess ? '✅ 运行中' : '❌ 未运行'}\n`;
                        statusText += `  • 自动恢复: ${status.autoRecovery ? '✅ 运行中' : '❌ 未运行'}\n`;
                        statusText += `  • 智能启动: ${status.smartStartup ? '✅ 运行中' : '❌ 未运行'}\n`;
                        statusText += `  • Web服务器: ${status.webServer ? '✅ 运行中' : '❌ 未运行'}`;
                        this.updateControlStatus(statusText);
                        // 同时刷新数据
                        this.fetchDashboardData();
                    } else {
                        this.updateControlStatus(`❌ 检查失败: ${result.error}`);
                    }
                } catch (e) {
                    this.updateControlStatus('❌ 检查失败: 解析响应失败');
                }
            } else {
                this.updateControlStatus(`❌ 检查失败: HTTP ${xhr.status}`);
            }
        };
        
        xhr.onerror = () => {
            this.updateControlStatus('❌ 检查失败: 网络错误');
            this.showProxyWarning();
        };
        
        xhr.send();
    }
}

// 页面加载完成后初始化面板
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded - 开始初始化面板');
    
    // 等待一小段时间确保所有元素都已加载
    setTimeout(() => {
        try {
            window.golfDashboard = new GolfDashboard();
            window.dashboard = window.golfDashboard; // 添加别名以兼容按钮函数
            console.log('✅ Golf Dashboard 初始化成功');
            
            // 验证按钮是否存在
            const buttons = ['btn-smart-startup', 'btn-batch-only', 'btn-stop-all', 'btn-check-status'];
            buttons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    console.log(`✅ 按钮 ${id} 存在`);
                } else {
                    console.error(`❌ 按钮 ${id} 不存在`);
                }
            });
        } catch (error) {
            console.error('❌ Dashboard 初始化失败:', error);
        }
    }, 100);
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('页面错误:', event.error);
});

// 未处理的Promise错误
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise错误:', event.reason);
});

// 🎮 控制面板按钮函数 - 全局函数，供HTML调用
function startSystem() {
    console.log('🚀 启动系统按钮被点击');
    if (window.dashboard) {
        window.dashboard.startSystem();
    } else {
        console.error('Dashboard实例未初始化');
        alert('系统未初始化，请刷新页面重试');
    }
}

function stopSystem() {
    console.log('⏹️ 停止系统按钮被点击');
    if (window.dashboard) {
        window.dashboard.stopAllProcesses();
    } else {
        console.error('Dashboard实例未初始化');
        alert('系统未初始化，请刷新页面重试');
    }
}

function startBatch() {
    console.log('📦 仅批处理按钮被点击');
    if (window.dashboard) {
        window.dashboard.startBatchOnly();
    } else {
        console.error('Dashboard实例未初始化');
        alert('系统未初始化，请刷新页面重试');
    }
}

function checkStatus() {
    console.log('🔍 检查状态按钮被点击');
    if (window.dashboard) {
        window.dashboard.checkSystemStatus();
    } else {
        console.error('Dashboard实例未初始化');
        alert('系统未初始化，请刷新页面重试');
    }
}