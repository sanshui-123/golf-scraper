/**
 * 自适应访问策略 - 智能切换获取方式
 * 解决反爬虫限制的终极方案
 * 
 * 增强版 - 集成系统资源发现和问题诊断能力
 */

const fs = require('fs');
const path = require('path'); 

class AdaptiveAccessStrategy {
    constructor() {
        this.accessMethods = {
            'mygolfspy.com': ['rss', 'direct', 'proxy'],
            'golfwrx.com': ['direct', 'cloudflare', 'proxy'], 
            'golfdigest.com': ['direct', 'rss', 'proxy']
        };
        this.failureCount = new Map();
        this.lastSuccessMethod = new Map();
        
        // 系统诊断增强
        this.systemResources = new Map(); // 可用系统资源映射
        this.problemPatterns = new Map(); // 问题模式识别
        this.solutionHistory = new Map(); // 解决方案历史
        this.autoDiscoveryEnabled = true;
        
        // 初始化系统诊断
        this.initializeSystemDiagnostics();
    }

    /**
     * 智能选择访问方法
     */
    getOptimalMethod(domain) {
        const failures = this.failureCount.get(domain) || 0;
        const methods = this.accessMethods[domain] || ['direct'];
        
        // 失败次数过多，切换到备用方法
        if (failures > 5) {
            return methods.includes('rss') ? 'rss' : 'proxy';
        }
        
        // 使用上次成功的方法
        const lastSuccess = this.lastSuccessMethod.get(domain);
        if (lastSuccess && methods.includes(lastSuccess)) {
            return lastSuccess;
        }
        
        return methods[0]; // 默认方法
    }

    /**
     * 记录访问结果
     */
    recordResult(domain, method, success) {
        if (success) {
            this.lastSuccessMethod.set(domain, method);
            this.failureCount.delete(domain);
        } else {
            const current = this.failureCount.get(domain) || 0;
            this.failureCount.set(domain, current + 1);
        }
    }

    /**
     * 判断是否需要暂停访问
     */
    shouldPauseAccess(domain) {
        const failures = this.failureCount.get(domain) || 0;
        return failures > 10; // 连续失败10次后暂停
    }

    /**
     * 获取暂停时间（分钟）
     */
    getPauseTime(domain) {
        const failures = this.failureCount.get(domain) || 0;
        return Math.min(failures * 5, 60); // 最多暂停1小时
    }

    /**
     * 初始化系统诊断能力
     */
    initializeSystemDiagnostics() {
        // 定义问题模式
        this.problemPatterns.set('mygolfspy_403', {
            keywords: ['403', 'forbidden', 'mygolfspy'],
            solutions: ['mygolfspy_rss_scraper.js', 'process_mygolfspy_rss.js'],
            strategy: 'rss'
        });
        
        this.problemPatterns.set('cloudflare_protection', {
            keywords: ['cloudflare', 'checking', 'just a moment', 'golfwrx'],
            solutions: ['site_specific_scrapers.js'],
            strategy: 'cloudflare'
        });
        
        this.problemPatterns.set('content_extraction', {
            keywords: ['empty content', 'no content', 'extraction failed'],
            solutions: ['site_specific_scrapers.js'],
            strategy: 'specialized_scraper'
        });
        
        this.problemPatterns.set('successful_processing', {
            keywords: ['success', 'completed', 'processed'],
            solutions: ['batch_process_articles.js', 'site_specific_scrapers.js'],
            strategy: 'proven_method'
        });
        
        this.problemPatterns.set('http_404_error', {
            keywords: ['404', 'not found', '文章不存在', 'nonexistent'],
            solutions: ['enhanced_deep_scraper.js', 'auto_scrape_three_sites.js'],
            strategy: 'find_alternative_urls'
        });
        
        // 自动发现系统资源
        if (this.autoDiscoveryEnabled) {
            this.discoverSystemResources();
        }
        
        // 加载历史数据
        this.loadSolutionHistory();
    }

    /**
     * 自动发现系统中的可用资源
     */
    discoverSystemResources() {
        const resourceFiles = [
            'mygolfspy_rss_scraper.js',
            'process_mygolfspy_rss.js',
            'mygolfspy_hybrid_scraper.js',
            'site_specific_scrapers.js',
            'adaptive_access_strategy.js'
        ];
        
        resourceFiles.forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const capabilities = this.analyzeResourceCapabilities(filePath);
                this.systemResources.set(file, {
                    path: filePath,
                    available: true,
                    capabilities: capabilities,
                    lastChecked: new Date().toISOString()
                });
            }
        });
        
        console.log(`🔍 系统资源发现完成: 找到 ${this.systemResources.size} 个可用资源`);
    }

    /**
     * 分析资源文件的能力
     */
    analyzeResourceCapabilities(filePath) {
        const capabilities = [];
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 基于文件内容分析能力
            if (content.includes('mygolfspy') || content.includes('MyGolfSpy')) {
                capabilities.push('mygolfspy_handler');
            }
            if (content.includes('golfwrx') || content.includes('GolfWRX')) {
                capabilities.push('golfwrx_handler');
            }
            if (content.includes('cloudflare') || content.includes('Cloudflare')) {
                capabilities.push('cloudflare_bypass');
            }
            if (content.includes('rss') || content.includes('RSS')) {
                capabilities.push('rss_processor');
            }
            if (content.includes('scrape') || content.includes('Scrape')) {
                capabilities.push('content_scraper');
            }
            
        } catch (error) {
            capabilities.push('unknown');
        }
        
        return capabilities;
    }

    /**
     * 智能问题诊断 - 基于错误信息和上下文
     */
    diagnoseAndResolve(errorMessage, domain, context = {}) {
        console.log(`🔍 开始智能诊断: ${domain} - ${errorMessage}`);
        
        // 1. 问题模式匹配
        const matchedProblems = [];
        for (const [problemType, config] of this.problemPatterns.entries()) {
            const matchScore = this.calculateMatchScore(errorMessage, config.keywords);
            if (matchScore > 0) {
                matchedProblems.push({
                    type: problemType,
                    score: matchScore,
                    config: config
                });
            }
        }
        
        // 按匹配分数排序
        matchedProblems.sort((a, b) => b.score - a.score);
        
        if (matchedProblems.length === 0) {
            console.log('❌ 未识别出已知问题模式');
            return { success: false, reason: 'unknown_problem' };
        }
        
        // 2. 选择最佳解决方案
        const primaryProblem = matchedProblems[0];
        console.log(`🎯 识别问题类型: ${primaryProblem.type} (匹配度: ${primaryProblem.score})`);
        
        // 3. 检查历史成功记录
        const historicalSolution = this.getHistoricalSuccessfulSolution(primaryProblem.type, domain);
        if (historicalSolution) {
            console.log(`📚 使用历史成功方案: ${historicalSolution.solution}`);
            return {
                success: true,
                solution: historicalSolution,
                problemType: primaryProblem.type,
                confidence: 'high'
            };
        }
        
        // 4. 选择可用资源
        const availableSolutions = this.findAvailableSolutions(primaryProblem.config.solutions);
        if (availableSolutions.length > 0) {
            const bestSolution = availableSolutions[0];
            console.log(`🔧 推荐解决方案: ${bestSolution.resource}`);
            
            return {
                success: true,
                solution: bestSolution,
                problemType: primaryProblem.type,
                strategy: primaryProblem.config.strategy,
                confidence: 'medium'
            };
        }
        
        return { success: false, reason: 'no_available_solutions' };
    }

    /**
     * 计算错误信息与问题模式的匹配分数
     */
    calculateMatchScore(errorMessage, keywords) {
        const message = errorMessage.toLowerCase();
        let score = 0;
        
        keywords.forEach(keyword => {
            if (message.includes(keyword.toLowerCase())) {
                score += 1;
            }
        });
        
        return score / keywords.length; // 归一化分数
    }

    /**
     * 查找可用的解决方案
     */
    findAvailableSolutions(solutionFiles) {
        const available = [];
        
        solutionFiles.forEach(file => {
            const resource = this.systemResources.get(file);
            if (resource && resource.available) {
                available.push({
                    resource: file,
                    path: resource.path,
                    capabilities: resource.capabilities
                });
            }
        });
        
        return available;
    }

    /**
     * 获取历史成功解决方案
     */
    getHistoricalSuccessfulSolution(problemType, domain) {
        const history = this.solutionHistory.get(`${problemType}_${domain}`);
        if (history && history.successes.length > 0) {
            // 返回最近成功的解决方案
            return history.successes[history.successes.length - 1];
        }
        return null;
    }

    /**
     * 记录解决方案执行结果
     */
    recordSolutionResult(problemType, domain, solution, success, metadata = {}) {
        const key = `${problemType}_${domain}`;
        
        if (!this.solutionHistory.has(key)) {
            this.solutionHistory.set(key, {
                successes: [],
                failures: []
            });
        }
        
        const history = this.solutionHistory.get(key);
        
        if (success) {
            history.successes.push({
                solution: solution,
                timestamp: new Date().toISOString(),
                metadata: metadata
            });
            console.log(`✅ 记录成功方案: ${problemType} -> ${solution}`);
        } else {
            history.failures.push({
                solution: solution,
                timestamp: new Date().toISOString(),
                error: metadata.error || 'Unknown error'
            });
            console.log(`❌ 记录失败方案: ${problemType} -> ${solution}`);
        }
        
        // 持久化历史数据
        this.saveSolutionHistory();
    }

    /**
     * 加载解决方案历史
     */
    loadSolutionHistory() {
        const historyFile = path.join(__dirname, 'solution_history.json');
        
        try {
            if (fs.existsSync(historyFile)) {
                const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                this.solutionHistory = new Map(Object.entries(data));
                console.log('📚 已加载解决方案历史记录'); 
            }
        } catch (error) {
            console.log('⚠️  解决方案历史加载失败，使用空历史');
        }
    }

    /**
     * 保存解决方案历史
     */
    saveSolutionHistory() {
        const historyFile = path.join(__dirname, 'solution_history.json');
        
        try {
            const data = Object.fromEntries(this.solutionHistory);
            fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.log('⚠️  解决方案历史保存失败');
        }
    }

    /**
     * 获取系统健康状态报告
     */
    getSystemHealthReport() {
        const report = {
            availableResources: this.systemResources.size,
            knownProblemTypes: this.problemPatterns.size,
            historicalData: this.solutionHistory.size,
            activeDomains: Array.from(this.failureCount.keys()),
            lastUpdate: new Date().toISOString()
        };
        
        // 计算成功率
        let totalSuccesses = 0;
        let totalFailures = 0;
        
        for (const history of this.solutionHistory.values()) {
            totalSuccesses += history.successes.length;
            totalFailures += history.failures.length;
        }
        
        report.successRate = totalSuccesses + totalFailures > 0 
            ? (totalSuccesses / (totalSuccesses + totalFailures) * 100).toFixed(2) + '%'
            : 'N/A';
        
        return report;
    }
}

module.exports = AdaptiveAccessStrategy;