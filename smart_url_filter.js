#!/usr/bin/env node

/**
 * 🔍 智能URL筛选器
 * 多层筛选：URL -> 标题 -> 内容特征 -> 时间
 * 彻底消除重复URL进入处理阶段
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const UnifiedHistoryDatabase = require('./unified_history_database');
const OptimizedTimeFilter = require('./optimized_time_filter');

class SmartUrlFilter {
    constructor(options = {}) {
        this.historyDB = new UnifiedHistoryDatabase();
        this.configPath = path.join(__dirname, 'smart_filter_config.json');
        this.loadConfig();
        
        // 初始化优化的时间过滤器
        this.timeFilter = new OptimizedTimeFilter({
            ignoreTimeFilter: options.ignoreTimeFilter || false,
            websiteDomain: options.websiteDomain || null
        });
        
        // 筛选统计
        this.stats = {
            input: 0,
            filtered: {
                urlHistory: 0,
                titleSimilarity: 0,
                publishTime: 0,
                contentSignature: 0
            },
            output: 0
        };
    }

    /**
     * 加载筛选配置
     */
    loadConfig() {
        const defaultConfig = {
            // 标题相似度阈值 (0-1)
            titleSimilarityThreshold: 0.85,
            
            // 时间过滤设置
            timeFilter: {
                enabled: true,
                maxDaysOld: 7,  // 只处理7天内的文章
                ignoreNoDate: false  // 是否忽略无日期的文章
            },
            
            // URL模式排除列表 (保守设置，只排除明显的旧内容)
            excludePatterns: [
                '\\/archive\\/',
                '\\/archives\\/',
                '\\/category\\/archived',
                '\\/tag\\/old',
                '\\?.*year=201[0-9]'   // 只排除2010-2019年的参数
            ],
            
            // 网站特定规则
            siteRules: {
                'golf.com': {
                    maxArticlesPerRun: 25,
                    contentSignatureCheck: true
                },
                'golfwrx.com': {
                    maxArticlesPerRun: 10,
                    contentSignatureCheck: true
                },
                'golfmonthly.com': {
                    maxArticlesPerRun: 20,
                    contentSignatureCheck: false
                },
                'mygolfspy.com': {
                    maxArticlesPerRun: 15,
                    contentSignatureCheck: false
                },
                'golfdigest.com': {
                    maxArticlesPerRun: 20,
                    contentSignatureCheck: true
                }
            }
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const userConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                // 合并配置但保持默认的excludePatterns
                this.config = { 
                    ...defaultConfig, 
                    ...userConfig,
                    excludePatterns: defaultConfig.excludePatterns  // 总是使用默认模式
                };
            } else {
                this.config = defaultConfig;
                // 暂时不自动保存配置文件，避免正则表达式序列化问题
                // this.saveConfig();
            }
        } catch (error) {
            console.log('⚠️ 配置加载失败，使用默认配置');
            this.config = defaultConfig;
        }
    }

    /**
     * 保存配置
     */
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('❌ 配置保存失败:', error.message);
        }
    }

    /**
     * 主要筛选方法 - 多层过滤
     * @param {array} urls - 原始URL列表
     * @param {string} site - 网站域名
     * @returns {object} - 筛选结果
     */
    async filterUrls(urls, site = null) {
        console.log(`\n🔍 开始智能URL筛选 (输入: ${urls.length} 个URL)`);
        this.stats.input = urls.length;
        
        // 重置筛选统计
        Object.keys(this.stats.filtered).forEach(key => {
            this.stats.filtered[key] = 0;
        });

        let filteredUrls = [...urls];

        // 第1层：URL历史检查
        console.log('\n📚 第1层：URL历史检查...');
        filteredUrls = await this.filterByUrlHistory(filteredUrls);
        
        // 第2层：URL模式排除
        console.log('\n🔍 第2层：URL模式筛选...');
        filteredUrls = this.filterByUrlPatterns(filteredUrls);

        // 第3层：发布时间检查
        if (this.config.timeFilter.enabled) {
            console.log('\n⏰ 第3层：发布时间筛选...');
            filteredUrls = await this.filterByPublishTime(filteredUrls);
        }

        // 第4层：标题相似度检查 (如果能提取到标题)
        console.log('\n📝 第4层：标题相似度检查...');
        filteredUrls = await this.filterByTitleSimilarity(filteredUrls);

        // 第5层：网站特定规则
        if (site && this.config.siteRules[site]) {
            console.log(`\n🌐 第5层：${site} 特定规则筛选...`);
            filteredUrls = this.applysSiteSpecificRules(filteredUrls, site);
        }

        this.stats.output = filteredUrls.length;
        this.printFilterStats();

        return {
            originalCount: urls.length,
            filteredCount: filteredUrls.length,
            urls: filteredUrls,
            removed: urls.length - filteredUrls.length,
            stats: { ...this.stats }
        };
    }

    /**
     * 第1层：URL历史检查
     */
    async filterByUrlHistory(urls) {
        const result = this.historyDB.batchCheckUrls(urls);
        
        if (result.duplicateUrls.length > 0) {
            console.log(`   🚫 过滤重复URL: ${result.duplicateUrls.length} 个`);
            result.duplicateUrls.forEach(item => {
                console.log(`      - ${item.url} (${item.originalDate})`);
            });
        }

        this.stats.filtered.urlHistory = result.duplicateUrls.length;
        return result.newUrls;
    }

    /**
     * 第2层：URL模式排除
     */
    filterByUrlPatterns(urls) {
        const filtered = urls.filter(url => {
            for (const patternStr of this.config.excludePatterns) {
                try {
                    const pattern = new RegExp(patternStr, 'i');
                    if (pattern.test(url)) {
                        console.log(`   🚫 排除模式匹配: ${url} (模式: ${patternStr})`);
                        this.stats.filtered.contentSignature++;
                        return false;
                    }
                } catch (error) {
                    console.warn(`⚠️ 无效的正则表达式模式: ${patternStr}`);
                }
            }
            return true;
        });

        if (filtered.length < urls.length) {
            console.log(`   ✅ 通过模式筛选: ${filtered.length}/${urls.length}`);
        } else if (urls.length > 0) {
            console.log(`   ✅ 所有URL通过模式筛选: ${urls.length}`);
        }

        return filtered;
    }

    /**
     * 第3层：发布时间筛选 (使用优化的时间过滤器)
     */
    async filterByPublishTime(urls) {
        const timeInfo = this.timeFilter.calculateOptimalTimeWindow();
        console.log(`   ⏰ 使用智能时间窗口: ${timeInfo.windowHours} 小时 (${timeInfo.reason || '标准模式'})`);
        
        const filtered = [];
        let timeFiltered = 0;
        const now = new Date();
        
        for (const url of urls) {
            try {
                // 从URL路径提取日期信息
                const dateFromUrl = this.extractDateFromUrl(url);
                
                if (dateFromUrl) {
                    const hoursAgo = (now - dateFromUrl) / (1000 * 60 * 60);
                    
                    if (hoursAgo <= timeInfo.windowHours) {
                        filtered.push(url);
                    } else {
                        const daysAgo = Math.round(hoursAgo / 24 * 10) / 10;
                        console.log(`   🚫 超出时间窗口: ${url} (${daysAgo}天前)`);
                        timeFiltered++;
                    }
                } else {
                    // 无法提取日期，根据配置决定是否包含
                    if (!this.config.timeFilter.ignoreNoDate) {
                        filtered.push(url);
                        console.log(`   📅 无日期信息，保守包含: ${url}`);
                    } else {
                        console.log(`   🚫 无日期信息，排除: ${url}`);
                        timeFiltered++;
                    }
                }
            } catch (error) {
                // 错误的URL，保守处理包含在内
                filtered.push(url);
                console.log(`   ⚠️ URL处理错误，保守包含: ${url}`);
            }
        }

        this.stats.filtered.publishTime = timeFiltered;
        
        if (timeFiltered > 0) {
            console.log(`   ✅ 通过时间筛选: ${filtered.length}/${urls.length} (筛选率: ${((timeFiltered/urls.length)*100).toFixed(1)}%)`);
        } else {
            console.log(`   ✅ 时间筛选完成: ${filtered.length} 个URL全部通过`);
        }

        return filtered;
    }

    /**
     * 第4层：标题相似度检查
     * 通过快速抓取页面标题进行检查
     */
    async filterByTitleSimilarity(urls) {
        const filtered = [];
        let similarityFiltered = 0;

        for (const url of urls) {
            try {
                // 简单提取标题（从URL或页面标题提取）
                const title = await this.extractTitleFromUrl(url);
                
                if (title) {
                    const existingRecord = this.historyDB.isContentProcessed(title);
                    if (existingRecord) {
                        console.log(`   🚫 标题重复: "${title}"`);
                        console.log(`      原文: ${existingRecord.url}`);
                        similarityFiltered++;
                        continue;
                    }
                }
                
                filtered.push(url);
            } catch (error) {
                // 提取失败，保守包含
                filtered.push(url);
            }
        }

        this.stats.filtered.titleSimilarity = similarityFiltered;
        if (similarityFiltered > 0) {
            console.log(`   ✅ 通过标题筛选: ${filtered.length}/${urls.length}`);
        }

        return filtered;
    }

    /**
     * 第5层：应用网站特定规则
     */
    applysSiteSpecificRules(urls, site) {
        const rules = this.config.siteRules[site];
        if (!rules) return urls;

        let filtered = [...urls];

        // 限制每次运行的文章数量
        if (rules.maxArticlesPerRun && filtered.length > rules.maxArticlesPerRun) {
            filtered = filtered.slice(0, rules.maxArticlesPerRun);
            console.log(`   ✂️ 限制${site}文章数量: ${rules.maxArticlesPerRun}/${urls.length}`);
        }

        return filtered;
    }

    /**
     * 从URL中提取日期信息
     */
    extractDateFromUrl(url) {
        // 常见日期格式匹配
        const patterns = [
            /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,  // /2025/01/15/
            /\/(\d{4})-(\d{1,2})-(\d{1,2})/,     // /2025-01-15
            /\?.*date=(\d{4}-\d{1,2}-\d{1,2})/,  // ?date=2025-01-15
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // JavaScript月份从0开始
                const day = parseInt(match[3]);
                
                if (year >= 2020 && year <= 2030 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                    return new Date(year, month, day);
                }
            }
        }

        return null;
    }

    /**
     * 从URL提取标题（简化版）
     */
    async extractTitleFromUrl(url) {
        try {
            // 从URL路径提取可能的标题
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0);
            
            if (pathSegments.length > 0) {
                // 取最后一个路径段作为标题猜测
                const lastSegment = pathSegments[pathSegments.length - 1];
                
                // 清理URL编码和连字符
                const title = decodeURIComponent(lastSegment)
                    .replace(/[-_]/g, ' ')
                    .replace(/\.(html?|php|aspx?)$/i, '')
                    .trim();
                    
                if (title.length > 5) {
                    return title;
                }
            }
        } catch (error) {
            // 提取失败，返回null
        }
        
        return null;
    }

    /**
     * 打印筛选统计信息
     */
    printFilterStats() {
        console.log('\n📊 筛选统计结果:');
        console.log(`   输入URL: ${this.stats.input}`);
        console.log(`   历史重复过滤: ${this.stats.filtered.urlHistory}`);
        console.log(`   模式排除过滤: ${this.stats.filtered.contentSignature}`);
        console.log(`   时间过滤: ${this.stats.filtered.publishTime}`);
        console.log(`   标题重复过滤: ${this.stats.filtered.titleSimilarity}`);
        console.log(`   最终输出: ${this.stats.output}`);
        
        const filterRate = this.stats.input > 0 ? 
            ((this.stats.input - this.stats.output) / this.stats.input * 100).toFixed(1) : 0;
        console.log(`   筛选率: ${filterRate}%`);
        
        if (this.stats.output === 0) {
            console.log('⚠️ 警告：所有URL都被筛选，可能筛选规则过于严格');
        }
    }

    /**
     * 获取筛选器状态
     */
    getStatus() {
        return {
            config: this.config,
            stats: this.stats,
            historyDbStatus: this.historyDB.getStatus()
        };
    }
}

module.exports = SmartUrlFilter;

// 如果直接运行此脚本，执行测试
if (require.main === module) {
    async function testFilter() {
        const filter = new SmartUrlFilter();
        
        // 测试URL列表 (模拟真实高尔夫网站URL)
        const testUrls = [
            'https://golf.com/news/pga-tour-championship-2025-preview',
            'https://golf.com/instruction/putting-tips-for-beginners', 
            'https://www.golfwrx.com/764173/golfwrx-members-choice-presented-by-2nd-swing-best-fairway-wood-of-2025',
            'https://www.golfmonthly.com/archive/old-golf-tips',  // 这个应该被过滤
        ];
        
        console.log('🧪 测试智能URL筛选器...');
        const result = await filter.filterUrls(testUrls, 'golf.com');
        
        console.log('\n✅ 测试完成');
        console.log('筛选结果:', result);
    }
    
    testFilter().catch(console.error);
}