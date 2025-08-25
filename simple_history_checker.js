#!/usr/bin/env node

/**
 * 🚀 简化历史检测器
 * 替换复杂的多层检测系统，直接基于实际输出文件进行URL去重
 * 
 * 核心逻辑：
 * - 扫描所有日期文件夹中的输出文件
 * - 建立URL到文件路径的映射缓存  
 * - 简单对比：存在输出文件 = 已处理
 */

const fs = require('fs');
const path = require('path');

class SimpleHistoryChecker {
    constructor() {
        this.historyCache = new Map(); // URL -> 文件路径映射
        this.cacheTime = 0;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
        this.MAX_CACHE_SIZE = 10000; // 最大缓存条目数
        this.contentDir = path.join(__dirname, 'golf_content');
        this.stats = {
            totalScanned: 0,
            urlsFound: 0,
            errors: 0,
            cacheHits: 0
        };
    }
    
    /**
     * 扫描所有输出文件建立URL映射
     */
    async buildHistoryCache() {
        console.log('📚 扫描历史输出文件...');
        this.historyCache.clear();
        
        if (!fs.existsSync(this.contentDir)) {
            console.log('⚠️ golf_content目录不存在，创建空缓存');
            this.cacheTime = Date.now();
            return;
        }
        
        // 扫描所有日期文件夹
        const dateFolders = fs.readdirSync(this.contentDir)
            .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
            .sort(); // 按日期排序
        
        console.log(`📁 发现 ${dateFolders.length} 个日期文件夹`);
        
        // 重置统计信息
        this.stats = { totalScanned: 0, urlsFound: 0, errors: 0, cacheHits: 0 };
        
        for (const dateFolder of dateFolders) {
            let totalFiles = 0;
            
            // 扫描 wechat_ready 文件夹
            const wechatReadyPath = path.join(this.contentDir, dateFolder, 'wechat_ready');
            if (fs.existsSync(wechatReadyPath)) {
                try {
                    const files = fs.readdirSync(wechatReadyPath);
                    const outputFiles = files.filter(file => file.endsWith('.html') || file.endsWith('.md'));
                    
                    for (const file of outputFiles) {
                        const processed = await this.processFile(wechatReadyPath, file, dateFolder);
                        if (processed) totalFiles++;
                    }
                } catch (dirError) {
                    console.log(`⚠️ 读取wechat_ready目录失败: ${dateFolder}, ${dirError.message}`);
                }
            }
            
            // 扫描 wechat_html 文件夹
            const wechatHtmlPath = path.join(this.contentDir, dateFolder, 'wechat_html');
            if (fs.existsSync(wechatHtmlPath)) {
                try {
                    const files = fs.readdirSync(wechatHtmlPath);
                    const htmlFiles = files.filter(file => file.endsWith('.html'));
                    
                    for (const file of htmlFiles) {
                        const processed = await this.processFile(wechatHtmlPath, file, dateFolder);
                        if (processed) totalFiles++;
                    }
                } catch (dirError) {
                    console.log(`⚠️ 读取wechat_html目录失败: ${dateFolder}, ${dirError.message}`);
                }
            }
            
            if (totalFiles > 0) {
                console.log(`  📄 ${dateFolder}: ${totalFiles} 个输出文件`);
            }
        }
        
        this.cacheTime = Date.now();
        this.stats.urlsFound = this.historyCache.size;
        
        // 🚀 自动清理缓存
        this.cleanupCache();
        
        console.log(`✅ 历史缓存建立完成: ${this.historyCache.size} 个URL`);
        if (this.stats.errors > 0) {
            console.log(`⚠️ 扫描过程中出现 ${this.stats.errors} 个错误`);
        }
    }
    
    /**
     * 处理单个文件，提取URL（优化版）
     */
    async processFile(dirPath, file, dateFolder) {
        this.stats.totalScanned++;
        
        try {
            const filePath = path.join(dirPath, file);
            
            // 检查文件大小，避免处理过大文件
            const stats = fs.statSync(filePath);
            if (stats.size > 1024 * 1024) { // 1MB限制
                console.log(`⚠️ 跳过过大文件: ${file} (${Math.round(stats.size/1024)}KB)`);
                return false;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 🚀 优化：使用单个正则表达式匹配所有格式
            const urlPattern = /(?:<!-- 原文链接: (.+?) -->|<a href="([^"]+)">点击查看原文<\/a>|\[点击查看原文\]\(([^)]+)\)|原文链接[:\s]*([^\n\r]+))/;
            const urlMatch = content.match(urlPattern);
            
            if (urlMatch) {
                // 获取匹配到的URL（可能在不同的捕获组中）
                const originalUrl = (urlMatch[1] || urlMatch[2] || urlMatch[3] || urlMatch[4]).trim();
                
                if (originalUrl && originalUrl.startsWith('http')) {
                    const normalizedUrl = this.normalizeUrl(originalUrl);
                    this.historyCache.set(normalizedUrl, {
                        filePath: filePath,
                        date: dateFolder,
                        originalUrl: originalUrl,
                        fileName: file,
                        fileSize: stats.size,
                        lastModified: stats.mtime
                    });
                    return true;
                }
            }
            return false;
        } catch (fileError) {
            this.stats.errors++;
            // 🔧 优化：根据错误类型提供不同的处理
            if (fileError.code === 'ENOENT') {
                console.log(`⚠️ 文件不存在: ${file}`);
            } else if (fileError.code === 'EACCES') {
                console.log(`⚠️ 文件权限不足: ${file}`);
            } else {
                console.log(`⚠️ 读取文件失败: ${file}, ${fileError.message}`);
            }
            return false;
        }
    }
    
    /**
     * URL规范化 - 统一对比标准
     */
    normalizeUrl(url) {
        return url.toLowerCase()
            .replace(/^https?:\/\//, '') // 移除协议
            .replace(/^www\./, '')        // 移除www
            .replace(/\/$/, '')           // 移除尾部斜杠
            .replace(/\?.*$/, '')         // 移除查询参数
            .replace(/#.*$/, '');         // 移除锚点
    }
    
    /**
     * 检查URL是否已处理（存在输出文件）
     */
    async isUrlProcessed(url) {
        // 检查缓存是否过期
        if (Date.now() - this.cacheTime > this.CACHE_DURATION) {
            console.log('🔄 缓存过期，重新扫描...');
            await this.buildHistoryCache();
        }
        
        const normalizedUrl = this.normalizeUrl(url);
        const record = this.historyCache.get(normalizedUrl);
        
        if (record) {
            this.stats.cacheHits++;
            // 额外验证文件是否确实存在且不为空
            if (fs.existsSync(record.filePath)) {
                const stats = fs.statSync(record.filePath);
                return stats.size > 1000; // 确保文件有实际内容（大于1KB）
            }
        }
        
        return false;
    }
    
    /**
     * 获取URL的处理记录详情
     */
    async getUrlRecord(url) {
        if (Date.now() - this.cacheTime > this.CACHE_DURATION) {
            await this.buildHistoryCache();
        }
        
        const normalizedUrl = this.normalizeUrl(url);
        return this.historyCache.get(normalizedUrl);
    }
    
    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        return {
            totalUrls: this.historyCache.size,
            cacheTime: new Date(this.cacheTime).toISOString(),
            cacheAge: Math.floor((Date.now() - this.cacheTime) / 1000) + '秒',
            maxCacheSize: this.MAX_CACHE_SIZE,
            cacheUtilization: ((this.historyCache.size / this.MAX_CACHE_SIZE) * 100).toFixed(1) + '%',
            ...this.stats
        };
    }
    
    /**
     * 🚀 新增：清理过期或过多的缓存条目
     */
    cleanupCache() {
        if (this.historyCache.size > this.MAX_CACHE_SIZE) {
            console.log(`🧹 缓存超出限制(${this.historyCache.size}/${this.MAX_CACHE_SIZE})，开始清理...`);
            
            // 转换为数组并按最后修改时间排序
            const entries = Array.from(this.historyCache.entries());
            entries.sort((a, b) => {
                const aTime = a[1].lastModified || 0;
                const bTime = b[1].lastModified || 0;
                return aTime - bTime; // 旧的在前
            });
            
            // 删除最旧的条目，保留90%
            const keepCount = Math.floor(this.MAX_CACHE_SIZE * 0.9);
            const toDelete = entries.slice(0, entries.length - keepCount);
            
            toDelete.forEach(([url]) => {
                this.historyCache.delete(url);
            });
            
            console.log(`✅ 清理完成：删除 ${toDelete.length} 个旧条目，保留 ${this.historyCache.size} 个`);
        }
    }
    
    /**
     * 🚀 新增：批量检查URL列表的处理状态
     */
    async batchCheckUrls(urls) {
        if (Date.now() - this.cacheTime > this.CACHE_DURATION) {
            await this.buildHistoryCache();
        }
        
        const results = {
            processed: [],
            unprocessed: [],
            errors: []
        };
        
        for (const url of urls) {
            try {
                const isProcessed = await this.isUrlProcessed(url);
                if (isProcessed) {
                    const record = await this.getUrlRecord(url);
                    results.processed.push({ url, record });
                } else {
                    results.unprocessed.push(url);
                }
            } catch (error) {
                results.errors.push({ url, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = SimpleHistoryChecker;

// 如果直接运行此脚本，执行测试
if (require.main === module) {
    (async () => {
        console.log('🧪 测试简化历史检测器...\n');
        
        const checker = new SimpleHistoryChecker();
        
        // 测试缓存建立
        await checker.buildHistoryCache();
        
        // 显示统计信息
        const stats = checker.getCacheStats();
        console.log('\n📊 缓存统计:', JSON.stringify(stats, null, 2));
        
        // 测试几个URL
        const testUrls = [
            'https://www.golf.com/test-url',
            'https://www.golfdigest.com/test-url',
            'https://mygolfspy.com/test-url'
        ];
        
        console.log('\n🔍 URL检测测试:');
        for (const url of testUrls) {
            const isProcessed = await checker.isUrlProcessed(url);
            console.log(`  ${isProcessed ? '🚫' : '✅'} ${url} - ${isProcessed ? '已处理' : '未处理'}`);
        }
        
        console.log('\n✅ 测试完成');
    })().catch(error => {
        console.error('❌ 测试失败:', error);
    });
}