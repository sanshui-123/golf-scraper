#!/usr/bin/env node

/**
 * 🚀 优化时间过滤器 
 * 解决24小时窗口过宽导致重复发现已处理文章的问题
 */

const fs = require('fs');
const path = require('path');

class OptimizedTimeFilter {
    constructor(options = {}) {
        this.options = {
            // 默认只查找6小时内的文章，而不是24小时
            defaultHours: options.defaultHours || 6,
            // 在高频运行时，进一步缩短到3小时
            highFrequencyHours: options.highFrequencyHours || 3,
            // 最小窗口小时数，即使高频运行也不会低于此值
            minimumWindowHours: options.minimumWindowHours || 2,
            // 最小间隔时间（毫秒）
            minIntervalMs: options.minIntervalMs || 2 * 60 * 60 * 1000, // 2小时
            // 最大间隔时间（毫秒） 
            maxIntervalMs: options.maxIntervalMs || 12 * 60 * 60 * 1000, // 12小时
            // 忽略时间过滤
            ignoreTimeFilter: options.ignoreTimeFilter || false,
            // 指定网站域名用于网站特定配置
            websiteDomain: options.websiteDomain || null
        };
        
        this.lastRunFile = 'last_run_timestamp.json';
    }

    /**
     * 智能计算时间窗口
     * 根据上次运行时间动态调整搜索窗口，支持网站特定配置
     */
    calculateOptimalTimeWindow() {
        const now = Date.now();
        let lastRun = null;
        let windowHours = this.options.defaultHours;
        
        // 如果设置了忽略时间过滤，返回24小时
        if (this.options.ignoreTimeFilter) {
            console.log(`🔓 忽略时间过滤: 搜索窗口24小时`);
            return {
                windowHours: 24,
                lastRun: null,
                timeSinceLastRun: null,
                reason: '忽略时间过滤'
            };
        }
        
        // 获取网站特定配置
        let websiteConfig = null;
        if (this.options.websiteDomain) {
            websiteConfig = this.getWebsiteSpecificWindow(this.options.websiteDomain);
            windowHours = websiteConfig.normal;
            console.log(`🌐 网站特定配置 (${this.options.websiteDomain}): 默认${websiteConfig.normal}小时, 高频${websiteConfig.highFreq}小时`);
        }
        
        // 读取上次运行时间
        if (fs.existsSync(this.lastRunFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.lastRunFile, 'utf8'));
                lastRun = data.timestamp;
            } catch (e) {
                // 忽略读取错误，使用默认值
            }
        }
        
        if (lastRun) {
            const timeSinceLastRun = now - lastRun;
            const hoursSinceLastRun = timeSinceLastRun / (1000 * 60 * 60);
            
            console.log(`⏰ 距离上次运行: ${Math.round(hoursSinceLastRun * 10) / 10} 小时`);
            
            if (timeSinceLastRun < this.options.minIntervalMs) {
                // 运行过于频繁，使用网站特定的高频配置
                const highFreqHours = websiteConfig ? websiteConfig.highFreq : this.options.highFrequencyHours;
                // 使用网站特定的高频窗口，不再基于运行间隔缩短
                windowHours = Math.max(
                    this.options.minimumWindowHours,
                    highFreqHours
                );
                console.log(`🔄 高频运行模式: 搜索窗口 ${windowHours} 小时 (网站特定高频配置: ${highFreqHours}小时)`);
            } else if (timeSinceLastRun > this.options.maxIntervalMs) {
                // 很久没运行，扩大搜索窗口
                windowHours = Math.min(24, hoursSinceLastRun);
                console.log(`📅 长间隔模式: 搜索窗口扩展为 ${windowHours} 小时`);
            } else {
                // 正常间隔，使用网站特定或默认窗口
                console.log(`⚡ 标准模式: 搜索窗口 ${windowHours} 小时`);
            }
        } else {
            console.log(`🆕 首次运行: 使用${websiteConfig ? '网站特定' : '默认'}搜索窗口 ${windowHours} 小时`);
        }
        
        // 更新运行时间戳
        this.updateLastRunTime();
        
        return {
            windowHours: Math.max(this.options.minimumWindowHours, Math.round(windowHours)),
            lastRun: lastRun,
            timeSinceLastRun: lastRun ? now - lastRun : null,
            websiteConfig: websiteConfig,
            reason: this.getWindowReason({ lastRun, timeSinceLastRun: lastRun ? now - lastRun : null })
        };
    }

    /**
     * 更新上次运行时间
     */
    updateLastRunTime() {
        const data = {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            version: '1.0.0'
        };
        
        fs.writeFileSync(this.lastRunFile, JSON.stringify(data, null, 2));
    }

    /**
     * 检查文章是否在时间窗口内
     */
    isArticleInTimeWindow(publishTime, windowHours) {
        if (!publishTime) return false;
        
        try {
            const now = new Date();
            let publishDate;
            
            // 处理相对时间格式 (e.g., "2 hours ago", "1 day ago")
            const relativeMatch = publishTime.match(/(?:Published|Posted)?\s*(\d{1,2})\s+(hours?|days?|mins?|minutes?)\s+ago/i);
            if (relativeMatch) {
                const amount = parseInt(relativeMatch[1]);
                const unit = relativeMatch[2].toLowerCase();
                
                let hoursAgo = 0;
                if (unit.startsWith('min')) {
                    hoursAgo = amount / 60;
                } else if (unit.startsWith('hour')) {
                    hoursAgo = amount;
                } else if (unit.startsWith('day')) {
                    hoursAgo = amount * 24;
                }
                
                return hoursAgo <= windowHours;
            }
            
            // 处理标准日期格式
            publishDate = new Date(publishTime);
            if (isNaN(publishDate.getTime())) {
                // 无法解析的时间格式，保守处理
                console.log(`⚠️ 无法解析时间格式: ${publishTime}`);
                return false;
            }
            
            const hoursAgo = (now - publishDate) / (1000 * 60 * 60);
            return hoursAgo <= windowHours;
            
        } catch (e) {
            console.log(`❌ 时间解析错误: ${publishTime} - ${e.message}`);
            return false;
        }
    }

    /**
     * 过滤文章列表，只保留时间窗口内的文章
     */
    filterArticlesByOptimalWindow(articles) {
        const timeInfo = this.calculateOptimalTimeWindow();
        const windowHours = timeInfo.windowHours;
        
        console.log(`\n🔍 使用优化时间窗口过滤文章...`);
        console.log(`   搜索窗口: ${windowHours} 小时`);
        console.log(`   总文章数: ${articles.length}`);
        
        const filteredArticles = articles.filter(article => {
            return this.isArticleInTimeWindow(article.publishTime, windowHours);
        });
        
        console.log(`   窗口内文章: ${filteredArticles.length}`);
        console.log(`   过滤掉: ${articles.length - filteredArticles.length} 篇`);
        
        // 显示部分过滤结果
        filteredArticles.slice(0, 3).forEach(article => {
            if (article.publishTime) {
                console.log(`     ✅ ${article.publishTime} - ${article.title?.substring(0, 50) || 'Unknown'}...`);
            }
        });
        
        return filteredArticles;
    }

    /**
     * 为不同网站推荐最佳时间窗口
     */
    getWebsiteSpecificWindow(domain) {
        const websiteConfig = {
            'golf.com': { 
                normal: 4, 
                highFreq: 2, 
                reason: 'Golf.com更新较频繁' 
            },
            'golfmonthly.com': { 
                normal: 18, 
                highFreq: 12, 
                reason: 'Golf Monthly更新很慢，需要更大窗口' 
            },
            'mygolfspy.com': { 
                normal: 6, 
                highFreq: 3, 
                reason: 'MyGolfSpy中等更新频率' 
            },
            'golfwrx.com': { 
                normal: 4, 
                highFreq: 2, 
                reason: 'GolfWRX论坛型网站更新频繁' 
            },
            'golfdigest.com': { 
                normal: 6, 
                highFreq: 3, 
                reason: 'Golf Digest专业媒体中等频率' 
            }
        };
        
        domain = domain.replace('www.', '');
        return websiteConfig[domain] || { normal: 6, highFreq: 3, reason: '默认配置' };
    }

    /**
     * 生成时间过滤报告
     */
    generateTimeFilterReport() {
        const timeInfo = this.calculateOptimalTimeWindow();
        
        const report = {
            timestamp: new Date().toISOString(),
            timeWindow: {
                hours: timeInfo.windowHours,
                reason: this.getWindowReason(timeInfo)
            },
            lastRun: timeInfo.lastRun ? new Date(timeInfo.lastRun).toISOString() : null,
            timeSinceLastRun: timeInfo.timeSinceLastRun ? 
                Math.round(timeInfo.timeSinceLastRun / (1000 * 60 * 60) * 10) / 10 : null,
            websiteRecommendations: {
                'golf.com': this.getWebsiteSpecificWindow('golf.com'),
                'golfmonthly.com': this.getWebsiteSpecificWindow('golfmonthly.com'),
                'mygolfspy.com': this.getWebsiteSpecificWindow('mygolfspy.com'),
                'golfwrx.com': this.getWebsiteSpecificWindow('golfwrx.com'),
                'golfdigest.com': this.getWebsiteSpecificWindow('golfdigest.com')
            }
        };
        
        fs.writeFileSync('time_filter_report.json', JSON.stringify(report, null, 2));
        
        return report;
    }

    getWindowReason(timeInfo) {
        if (!timeInfo.lastRun) {
            return '首次运行，使用默认窗口';
        }
        
        const hoursSince = timeInfo.timeSinceLastRun / (1000 * 60 * 60);
        
        if (hoursSince < 2) {
            return '高频运行，缩短窗口避免重复';
        } else if (hoursSince > 12) {
            return '长时间未运行，扩大窗口';
        } else {
            return '正常运行间隔，使用标准窗口';
        }
    }
}

// 命令行工具
if (require.main === module) {
    const args = process.argv.slice(2);
    const filter = new OptimizedTimeFilter();
    
    if (args.includes('--report')) {
        const report = filter.generateTimeFilterReport();
        console.log('📊 时间过滤报告:');
        console.log(JSON.stringify(report, null, 2));
    } else if (args.includes('--calculate')) {
        const timeInfo = filter.calculateOptimalTimeWindow();
        console.log(`🕐 建议时间窗口: ${timeInfo.windowHours} 小时`);
    } else {
        console.log('用法:');
        console.log('  --report    生成时间过滤报告');
        console.log('  --calculate 计算最佳时间窗口');
    }
}

module.exports = OptimizedTimeFilter;