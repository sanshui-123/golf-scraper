#!/usr/bin/env node

/**
 * 🗄️ 统一历史数据库
 * 整合URL数据库和内容数据库，提供统一查询接口
 * 彻底解决URL筛选失效问题的核心组件
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class UnifiedHistoryDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'master_history_database.json');
        this.urlDbPath = path.join(__dirname, 'history_url_database.json');
        this.contentDbPath = path.join(__dirname, 'content_hash_database.json');
        this.lockPath = this.dbPath + '.lock';
        
        this.masterDB = {
            urls: {},           // URL -> 处理记录映射
            contents: {},       // 内容hash -> URL映射
            titles: {},         // 标题hash -> URL映射 (模糊匹配)
            metadata: {
                lastUpdate: null,
                totalRecords: 0,
                version: '2.0'
            }
        };
        
        // 使用Set优化查询性能
        this.urlKeysSet = new Set();
        
        // 自动保存标志
        this.autoSave = true;
        this.saveTimer = null;
        
        this.loadDatabase();
    }

    /**
     * 加载并整合所有历史数据库
     */
    loadDatabase() {
        try {
            // 1. 尝试加载主数据库
            if (fs.existsSync(this.dbPath)) {
                console.log('📊 加载统一历史数据库...');
                const data = fs.readFileSync(this.dbPath, 'utf8');
                this.masterDB = { ...this.masterDB, ...JSON.parse(data) };
                // 初始化URL键集合
                this.urlKeysSet = new Set(Object.keys(this.masterDB.urls));
                console.log(`✅ 已加载 ${this.urlKeysSet.size} 条URL记录`);
                return;
            }

            // 2. 如果主数据库不存在，从旧数据库迁移
            console.log('🔄 检测到旧数据库，开始迁移整合...');
            this.migrateFromLegacyDatabases();
            
        } catch (error) {
            console.error('❌ 数据库加载失败:', error.message);
            console.log('🆕 创建新的统一数据库');
            this.masterDB = {
                urls: {},
                contents: {},
                titles: {},
                metadata: {
                    lastUpdate: new Date().toISOString(),
                    totalRecords: 0,
                    version: '2.0'
                }
            };
        }
    }

    /**
     * 从旧数据库迁移数据
     */
    migrateFromLegacyDatabases() {
        let migrated = 0;

        // 迁移URL数据库
        if (fs.existsSync(this.urlDbPath)) {
            const urlDB = JSON.parse(fs.readFileSync(this.urlDbPath, 'utf8'));
            console.log('📥 迁移URL历史数据...');
            
            for (const [normalizedUrl, records] of Object.entries(urlDB)) {
                if (Array.isArray(records)) {
                    records.forEach(record => {
                        const key = this.generateUrlKey(record.originalUrl || normalizedUrl);
                        this.masterDB.urls[key] = {
                            originalUrl: record.originalUrl,
                            normalizedUrl: normalizedUrl,
                            status: record.status,
                            date: record.date,
                            articleNum: record.articleNum,
                            processedAt: new Date().toISOString(),
                            source: 'url_db_migration'
                        };
                        this.urlKeysSet.add(key);
                        migrated++;
                    });
                }
            }
            console.log(`✅ 已迁移 ${migrated} 条URL记录`);
        }

        // 迁移内容hash数据库
        if (fs.existsSync(this.contentDbPath)) {
            const contentDB = JSON.parse(fs.readFileSync(this.contentDbPath, 'utf8'));
            console.log('📥 迁移内容hash数据...');
            
            let contentMigrated = 0;
            for (const [hash, record] of Object.entries(contentDB)) {
                this.masterDB.contents[hash] = {
                    url: record.url,
                    title: record.title || '',
                    publishDate: record.publishDate,
                    processedDate: record.processedDate,
                    contentLength: record.contentLength,
                    source: 'content_db_migration'
                };

                // 同时为标题建立索引
                if (record.title) {
                    const titleHash = this.generateTitleHash(record.title);
                    this.masterDB.titles[titleHash] = hash;
                }
                contentMigrated++;
            }
            console.log(`✅ 已迁移 ${contentMigrated} 条内容记录`);
        }

        this.masterDB.metadata.totalRecords = migrated;
        this.masterDB.metadata.lastUpdate = new Date().toISOString();
        this.saveDatabase();
        console.log('🎉 数据库迁移完成！');
    }

    /**
     * 生成URL唯一键
     */
    generateUrlKey(url) {
        return crypto.createHash('md5').update(url.toLowerCase()).digest('hex');
    }

    /**
     * 生成标题hash用于模糊匹配
     */
    generateTitleHash(title) {
        const cleanTitle = title
            .replace(/[.,!?;:"'"（）【】]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
        return crypto.createHash('md5').update(cleanTitle).digest('hex');
    }

    /**
     * 检查URL是否已处理（优化版）
     * @param {string} url - 要检查的URL
     * @returns {object|null} - 处理记录或null
     */
    isUrlProcessed(url) {
        const key = this.generateUrlKey(url);
        
        // 使用Set快速检查
        if (!this.urlKeysSet.has(key)) {
            return null;
        }
        
        const record = this.masterDB.urls[key];
        if (record) {
            // 减少日志输出，提高性能
            if (process.env.DEBUG_DEDUP) {
                console.log(`🔍 发现URL历史记录: ${url}`);
                console.log(`   状态: ${record.status}, 处理时间: ${record.date}`);
            }
            return record;
        }
        return null;
    }

    /**
     * 检查内容是否已处理（通过标题匹配）
     * @param {string} title - 文章标题
     * @returns {object|null} - 内容记录或null
     */
    isContentProcessed(title) {
        const titleHash = this.generateTitleHash(title);
        const contentHash = this.masterDB.titles[titleHash];
        
        if (contentHash && this.masterDB.contents[contentHash]) {
            const record = this.masterDB.contents[contentHash];
            console.log(`🔍 发现标题重复: "${title}"`);
            console.log(`   原文章: ${record.url} (${record.processedDate})`);
            return record;
        }
        return null;
    }

    /**
     * 检查单个URL的状态（增强版）
     * @param {string} url - 要检查的URL
     * @returns {object} - URL状态信息
     */
    checkUrl(url) {
        const key = this.generateUrlKey(url);
        const record = this.masterDB.urls[key];
        
        if (record) {
            // 增加状态验证
            if (record.status === 'completed' && record.date && record.articleNum) {
                // 验证文章文件是否真的存在
                const path = require('path');
                const fs = require('fs');
                const articlePath = path.join(
                    __dirname, 
                    'golf_content', 
                    record.date, 
                    'wechat_ready',
                    `wechat_article_${record.articleNum}.md`
                );
                
                if (!fs.existsSync(articlePath)) {
                    // 文件不存在，返回需要重新处理的状态
                    return {
                        ...record,
                        status: 'missing',
                        needsReprocess: true,
                        originalStatus: 'completed',
                        missingFile: articlePath
                    };
                }
            }
            return record;
        }
        
        return { status: 'new' };
    }

    /**
     * 获取处理历史统计
     * @param {number} days - 查询最近几天的记录
     * @returns {object} - 统计信息
     */
    getProcessingHistory(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentUrls = Object.values(this.masterDB.urls).filter(record => {
            return new Date(record.processedAt || record.date) > cutoffDate;
        });

        const recentContents = Object.values(this.masterDB.contents).filter(record => {
            return new Date(record.processedDate) > cutoffDate;
        });

        return {
            totalUrls: Object.keys(this.masterDB.urls).length,
            totalContents: Object.keys(this.masterDB.contents).length,
            recentUrls: recentUrls.length,
            recentContents: recentContents.length,
            lastUpdate: this.masterDB.metadata.lastUpdate
        };
    }

    /**
     * 添加处理记录
     * @param {object} record - 处理记录
     */
    addProcessedRecord(record) {
        if (record.url) {
            const urlKey = this.generateUrlKey(record.url);
            this.masterDB.urls[urlKey] = {
                originalUrl: record.url,
                normalizedUrl: record.normalizedUrl || record.url,
                status: record.status || 'completed',
                date: record.date || new Date().toISOString().split('T')[0],
                articleNum: record.articleNum,
                processedAt: new Date().toISOString(),
                source: 'new_record'
            };
            // 更新Set
            this.urlKeysSet.add(urlKey);
        }

        if (record.contentHash && record.title) {
            this.masterDB.contents[record.contentHash] = {
                url: record.url,
                title: record.title,
                publishDate: record.publishDate,
                processedDate: new Date().toISOString(),
                contentLength: record.contentLength,
                source: 'new_record'
            };

            const titleHash = this.generateTitleHash(record.title);
            this.masterDB.titles[titleHash] = record.contentHash;
        }

        this.masterDB.metadata.totalRecords = this.urlKeysSet.size;
        this.masterDB.metadata.lastUpdate = new Date().toISOString();
        
        // 自动保存
        if (this.autoSave) {
            this.scheduleSave();
        }
    }
    
    /**
     * 立即添加已处理的URL（新增方法）
     * @param {string} url - URL
     * @param {object} metadata - 元数据
     */
    addProcessedUrl(url, metadata = {}) {
        const urlKey = this.generateUrlKey(url);
        
        this.masterDB.urls[urlKey] = {
            originalUrl: url,
            normalizedUrl: metadata.normalizedUrl || url,
            status: metadata.status || 'completed',
            date: metadata.date || new Date().toISOString().split('T')[0],
            articleNum: metadata.articleNum,
            processedAt: new Date().toISOString(),
            source: metadata.source || 'batch_processor',
            siteName: metadata.siteName,
            ...metadata
        };
        
        // 更新Set
        this.urlKeysSet.add(urlKey);
        
        this.masterDB.metadata.totalRecords = this.urlKeysSet.size;
        this.masterDB.metadata.lastUpdate = new Date().toISOString();
        
        // 自动保存
        if (this.autoSave) {
            this.scheduleSave();
        }
    }

    /**
     * 批量检查URL列表（优化版）
     * @param {array} urls - URL列表
     * @returns {object} - 筛选结果
     */
    batchCheckUrls(urls) {
        const results = {
            newUrls: [],
            duplicateUrls: [],
            statistics: {
                total: urls.length,
                new: 0,
                duplicate: 0,
                completed: 0,
                failed: 0,
                skipped: 0,
                other: 0
            }
        };

        // 批量检查，减少重复计算
        const urlsWithKeys = urls.map(url => ({
            url,
            key: this.generateUrlKey(url)
        }));

        urlsWithKeys.forEach(({url, key}) => {
            if (this.urlKeysSet.has(key)) {
                const record = this.masterDB.urls[key];
                if (record && record.status) {
                    // 所有已处理的状态都应该被认为是"已处理"，而不是"新"URL
                    const processedStatuses = ['completed', 'duplicate', 'failed', 'skipped', 'permanent_failed'];
                    
                    if (processedStatuses.includes(record.status)) {
                        results.duplicateUrls.push({
                            url: url,
                            reason: 'url_already_processed',
                            originalDate: record.date,
                            status: record.status,
                            articleNum: record.articleNum
                        });
                        
                        // 统计各种状态
                        if (record.status === 'completed') results.statistics.completed++;
                        else if (record.status === 'failed') results.statistics.failed++;
                        else if (record.status === 'skipped') results.statistics.skipped++;
                        else if (record.status === 'duplicate') results.statistics.duplicate++;
                        else results.statistics.other++;
                        
                        return;
                    } else if (record.status === 'processing') {
                        // processing状态特殊处理：如果超过1小时，认为是处理中断，算作新URL
                        const processedAt = new Date(record.processedAt || record.date);
                        const hoursSinceProcessing = (Date.now() - processedAt) / (1000 * 60 * 60);
                        
                        if (hoursSinceProcessing > 1) {
                            console.log(`⚠️ URL处理超时，将重新处理: ${url}`);
                            results.newUrls.push(url);
                        } else {
                            // 仍在处理中，算作已处理
                            results.duplicateUrls.push({
                                url: url,
                                reason: 'currently_processing',
                                originalDate: record.date,
                                status: record.status,
                                articleNum: record.articleNum
                            });
                            results.statistics.other++;
                        }
                        return;
                    }
                }
            }
            results.newUrls.push(url);
        });

        results.statistics.new = results.newUrls.length;
        results.statistics.duplicate = results.duplicateUrls.length;

        console.log(`🔍 批量检查结果: ${results.statistics.new}个新URL, ${results.statistics.duplicate}个已处理URL`);
        if (results.statistics.completed > 0) console.log(`   ✅ completed: ${results.statistics.completed}`);
        if (results.statistics.failed > 0) console.log(`   ❌ failed: ${results.statistics.failed}`);
        if (results.statistics.skipped > 0) console.log(`   ⏭️ skipped: ${results.statistics.skipped}`);
        if (results.statistics.duplicate > 0) console.log(`   🔄 duplicate: ${results.statistics.duplicate}`);
        
        return results;
    }
    
    /**
     * 延迟保存数据库（防止频繁写入）
     */
    scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        this.saveTimer = setTimeout(() => {
            this.saveDatabase();
            this.saveTimer = null;
        }, 1000); // 1秒后保存
    }

    /**
     * 清理过期记录
     * @param {number} days - 保留最近几天的记录
     */
    cleanExpiredRecords(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        let cleaned = 0;
        
        // 清理过期URL记录
        for (const [key, record] of Object.entries(this.masterDB.urls)) {
            const recordDate = new Date(record.processedAt || record.date);
            if (recordDate < cutoffDate) {
                delete this.masterDB.urls[key];
                this.urlKeysSet.delete(key);
                cleaned++;
            }
        }

        console.log(`🧹 已清理 ${cleaned} 条过期记录 (${days}天前)`);
        this.saveDatabase();
    }

    /**
     * 保存数据库（并发安全）
     */
    saveDatabase() {
        try {
            // 使用临时文件避免并发写入问题
            const tempPath = this.dbPath + '.tmp';
            
            // 写入临时文件
            fs.writeFileSync(tempPath, JSON.stringify(this.masterDB, null, 2), 'utf8');
            
            // 原子性地替换原文件
            fs.renameSync(tempPath, this.dbPath);
            
            if (process.env.DEBUG_DEDUP) {
                console.log('💾 统一历史数据库已保存');
            }
        } catch (error) {
            console.error('❌ 数据库保存失败:', error.message);
            // 清理临时文件
            try {
                fs.unlinkSync(this.dbPath + '.tmp');
            } catch (e) {
                // 忽略清理错误
            }
        }
    }

    /**
     * 获取数据库状态
     */
    getStatus() {
        return {
            totalUrls: Object.keys(this.masterDB.urls).length,
            totalContents: Object.keys(this.masterDB.contents).length,
            totalTitles: Object.keys(this.masterDB.titles).length,
            lastUpdate: this.masterDB.metadata.lastUpdate,
            version: this.masterDB.metadata.version
        };
    }

    /**
     * 记录失败的URL
     * @param {string} url - URL地址
     * @param {string} reason - 失败原因
     * @param {object} metadata - 额外元数据
     */
    addFailedUrl(url, reason, metadata = {}) {
        const urlKey = this.generateUrlKey(url);
        
        // 初始化失败记录结构
        if (!this.masterDB.failedUrls) {
            this.masterDB.failedUrls = {};
        }
        
        // 记录失败信息
        this.masterDB.failedUrls[urlKey] = {
            url: url,
            reason: reason,
            failedAt: new Date().toISOString(),
            attempts: (this.masterDB.failedUrls[urlKey]?.attempts || 0) + 1,
            metadata: {
                ...metadata,
                source: metadata.source || 'unknown',
                errorType: this.classifyError(reason),
                canRetry: this.isRetryable(reason)
            },
            history: [
                ...(this.masterDB.failedUrls[urlKey]?.history || []),
                {
                    timestamp: new Date().toISOString(),
                    reason: reason,
                    metadata: metadata
                }
            ]
        };
        
        this.saveDatabase();
        return true;
    }

    /**
     * 分类错误类型
     */
    classifyError(reason) {
        if (reason.includes('Claude返回空内容')) return 'empty_response';
        if (reason.includes('超时')) return 'timeout';
        if (reason.includes('API')) return 'api_error';
        if (reason.includes('网络')) return 'network_error';
        if (reason.includes('抓取失败')) return 'scraping_error';
        if (reason.includes('内容无效')) return 'invalid_content';
        return 'unknown';
    }

    /**
     * 判断是否可重试
     */
    isRetryable(reason) {
        const nonRetryableErrors = ['内容无效', '文章不存在', '404', '403'];
        return !nonRetryableErrors.some(err => reason.includes(err));
    }
}

module.exports = UnifiedHistoryDatabase;

// 如果直接运行此脚本，执行数据库状态检查
if (require.main === module) {
    const db = new UnifiedHistoryDatabase();
    const status = db.getStatus();
    console.log('\n📊 统一历史数据库状态:');
    console.log(JSON.stringify(status, null, 2));
    
    const history = db.getProcessingHistory(7);
    console.log('\n📈 最近7天处理历史:');
    console.log(JSON.stringify(history, null, 2));
}