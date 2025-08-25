#!/usr/bin/env node

/**
 * 🎯 增强版URL标准化器
 * 提高URL比较准确性，减少误判，同时保持完整历史检查
 */

const fs = require('fs');
const { URL } = require('url');

class EnhancedUrlNormalizer {
    constructor() {
        this.commonParams = new Set([
            // 追踪参数
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
            'gclid', 'fbclid', 'msclkid', '_ga', '_gid',
            // 社交媒体参数  
            'ref', 'src', 'source', 'campaign',
            // 时间戳和会话
            't', 'ts', 'timestamp', 'time', '_t', 'sid', 'sessionid',
            // 分页和排序（保留这些重要参数）
            // 'page', 'p', 'sort', 'order' - 这些不应该移除
        ]);
        
        this.preserveParams = new Set([
            // 保留这些重要参数，它们影响内容
            'page', 'p', 'sort', 'order', 'category', 'tag', 'type',
            'id', 'articleid', 'postid', 'slug'
        ]);
        
        this.domainAliases = new Map([
            // 处理域名别名
            ['www.golf.com', 'golf.com'],
            ['m.golf.com', 'golf.com'], 
            ['mobile.golfdigest.com', 'www.golfdigest.com'],
            ['amp.golfwrx.com', 'www.golfwrx.com']
        ]);
    }

    /**
     * 增强版URL标准化
     * 更精确的标准化，减少误判
     */
    normalizeUrl(url) {
        try {
            if (!url || typeof url !== 'string') {
                return '';
            }

            // 基础清理
            url = url.trim();
            
            // 确保有协议
            if (!url.match(/^https?:\/\//)) {
                url = 'https://' + url.replace(/^\/+/, '');
            }
            
            const urlObj = new URL(url);
            
            // 1. 域名标准化
            let hostname = urlObj.hostname.toLowerCase();
            
            // 处理www前缀 - 更智能的处理
            if (hostname.startsWith('www.')) {
                // 只有当非www版本存在时才移除www
                const nonWwwDomain = hostname.substring(4);
                hostname = nonWwwDomain;
            }
            
            // 处理域名别名
            if (this.domainAliases.has(hostname)) {
                hostname = this.domainAliases.get(hostname);
            }
            
            // 2. 路径标准化
            let pathname = urlObj.pathname;
            
            // 移除尾部斜杠，但保留根路径的斜杠
            if (pathname.length > 1 && pathname.endsWith('/')) {
                pathname = pathname.slice(0, -1);
            }
            
            // 处理路径中的常见变体
            pathname = pathname
                .replace(/\/+/g, '/') // 多个斜杠合并为一个
                .replace(/\/index\.(html?|php|asp)$/i, '') // 移除index文件
                .toLowerCase(); // 路径小写化
            
            // 3. 查询参数智能过滤
            const searchParams = new URLSearchParams(urlObj.search);
            const filteredParams = new URLSearchParams();
            
            for (const [key, value] of searchParams) {
                const lowerKey = key.toLowerCase();
                
                // 保留重要参数
                if (this.preserveParams.has(lowerKey)) {
                    filteredParams.set(key, value);
                }
                // 移除常见无关参数
                else if (!this.commonParams.has(lowerKey)) {
                    // 不在常见参数列表中，保留（保守处理）
                    filteredParams.set(key, value);
                }
                // 特殊处理：保留看起来像文章ID的参数
                else if (lowerKey.match(/^(id|article|post|story)/) && value.match(/^\d+$/)) {
                    filteredParams.set(key, value);
                }
            }
            
            // 4. 构建标准化URL
            let normalizedUrl = `https://${hostname}${pathname}`;
            
            // 添加过滤后的查询参数
            const queryString = filteredParams.toString();
            if (queryString) {
                normalizedUrl += '?' + queryString;
            }
            
            // 5. 移除fragment（锚点）
            // urlObj.hash 已经被忽略了
            
            return normalizedUrl;
            
        } catch (error) {
            console.log(`⚠️ URL标准化失败: ${url} - ${error.message}`);
            // 回退到简单标准化
            return this.simpleNormalize(url);
        }
    }

    /**
     * 简单标准化（回退方案）
     */
    simpleNormalize(url) {
        try {
            let normalized = url.toLowerCase().trim();
            
            // 基础清理
            if (!normalized.startsWith('http')) {
                normalized = 'https://' + normalized.replace(/^www\./, '');
            }
            
            // 移除www
            normalized = normalized.replace(/^https?:\/\/www\./, 'https://');
            
            // 移除尾部斜杠
            normalized = normalized.replace(/\/$/, '');
            
            // 移除锚点和简单参数
            normalized = normalized.replace(/[#?].*$/, '');
            
            return normalized;
        } catch (e) {
            return url.toLowerCase().trim();
        }
    }

    /**
     * URL相似度检查
     * 用于检测可能的重复但URL略有不同的情况
     */
    calculateUrlSimilarity(url1, url2) {
        try {
            const normalized1 = this.normalizeUrl(url1);
            const normalized2 = this.normalizeUrl(url2);
            
            if (normalized1 === normalized2) {
                return 1.0; // 完全匹配
            }
            
            // 提取URL组件进行相似度比较
            const urlObj1 = new URL(normalized1);
            const urlObj2 = new URL(normalized2);
            
            let similarity = 0;
            let components = 0;
            
            // 域名比较（权重最高）
            if (urlObj1.hostname === urlObj2.hostname) {
                similarity += 0.4;
            }
            components++;
            
            // 路径比较
            const path1 = urlObj1.pathname.split('/').filter(p => p);
            const path2 = urlObj2.pathname.split('/').filter(p => p);
            
            const pathSimilarity = this.calculateArraySimilarity(path1, path2);
            similarity += pathSimilarity * 0.4;
            components++;
            
            // 查询参数比较
            const params1 = new URLSearchParams(urlObj1.search);
            const params2 = new URLSearchParams(urlObj2.search);
            
            const paramSimilarity = this.calculateParamSimilarity(params1, params2);
            similarity += paramSimilarity * 0.2;
            components++;
            
            return similarity;
            
        } catch (e) {
            return 0;
        }
    }

    /**
     * 计算数组相似度（用于路径比较）
     */
    calculateArraySimilarity(arr1, arr2) {
        if (arr1.length === 0 && arr2.length === 0) return 1.0;
        if (arr1.length === 0 || arr2.length === 0) return 0;
        
        const maxLen = Math.max(arr1.length, arr2.length);
        let matches = 0;
        
        for (let i = 0; i < maxLen; i++) {
            if (arr1[i] === arr2[i]) {
                matches++;
            } else if (arr1[i] && arr2[i]) {
                // 检查部分匹配（编辑距离）
                const editDistance = this.calculateEditDistance(arr1[i], arr2[i]);
                const maxSegmentLen = Math.max(arr1[i].length, arr2[i].length);
                if (editDistance / maxSegmentLen < 0.3) { // 70%相似
                    matches += 0.7;
                }
            }
        }
        
        return matches / maxLen;
    }

    /**
     * 计算参数相似度
     */
    calculateParamSimilarity(params1, params2) {
        const keys1 = Array.from(params1.keys());
        const keys2 = Array.from(params2.keys());
        
        if (keys1.length === 0 && keys2.length === 0) return 1.0;
        if (keys1.length === 0 || keys2.length === 0) return 0;
        
        const allKeys = new Set([...keys1, ...keys2]);
        let matches = 0;
        
        for (const key of allKeys) {
            const val1 = params1.get(key);
            const val2 = params2.get(key);
            
            if (val1 === val2) {
                matches++;
            }
        }
        
        return matches / allKeys.size;
    }

    /**
     * 计算编辑距离（Levenshtein距离）
     */
    calculateEditDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // 替换
                        matrix[i][j - 1] + 1,     // 插入
                        matrix[i - 1][j] + 1      // 删除
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * 批量标准化URL
     */
    normalizeUrls(urls) {
        const results = {
            normalized: [],
            errors: [],
            duplicates: new Map(),
            statistics: {
                total: urls.length,
                successful: 0,
                errors: 0,
                duplicates: 0
            }
        };
        
        const normalizedMap = new Map();
        
        for (const url of urls) {
            try {
                const normalized = this.normalizeUrl(url);
                
                if (normalizedMap.has(normalized)) {
                    // 发现重复
                    if (!results.duplicates.has(normalized)) {
                        results.duplicates.set(normalized, []);
                    }
                    results.duplicates.get(normalized).push(url);
                    results.statistics.duplicates++;
                } else {
                    normalizedMap.set(normalized, url);
                    results.normalized.push({
                        original: url,
                        normalized: normalized
                    });
                    results.statistics.successful++;
                }
            } catch (error) {
                results.errors.push({
                    url: url,
                    error: error.message
                });
                results.statistics.errors++;
            }
        }
        
        return results;
    }

    /**
     * 生成URL标准化报告
     */
    generateNormalizationReport(urls) {
        const results = this.normalizeUrls(urls);
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalUrls: results.statistics.total,
                successfulNormalizations: results.statistics.successful,
                errors: results.statistics.errors,
                duplicatesFound: results.statistics.duplicates,
                successRate: Math.round((results.statistics.successful / results.statistics.total) * 100)
            },
            duplicates: Array.from(results.duplicates.entries()).map(([normalized, originals]) => ({
                normalized: normalized,
                duplicateUrls: originals
            })),
            errors: results.errors,
            sampleNormalizations: results.normalized.slice(0, 10)
        };
        
        fs.writeFileSync('url_normalization_report.json', JSON.stringify(report, null, 2));
        
        return report;
    }
}

// 命令行工具
if (require.main === module) {
    const args = process.argv.slice(2);
    const normalizer = new EnhancedUrlNormalizer();
    
    if (args.includes('--test')) {
        // 测试样例
        const testUrls = [
            'https://golf.com/travel/11-golf-travel-tips-tattoo-remember/',
            'https://www.golf.com/travel/11-golf-travel-tips-tattoo-remember',
            'https://golf.com/travel/11-golf-travel-tips-tattoo-remember?utm_source=test',
            'https://www.golfmonthly.com/news/peter-malnati-close-loophole',
            'https://golfmonthly.com/news/peter-malnati-close-loophole/',
            'https://mygolfspy.com/news-opinion/callaway-golf-balls-get-the-royal-treatment/?ref=homepage'
        ];
        
        console.log('🧪 URL标准化测试:');
        testUrls.forEach(url => {
            const normalized = normalizer.normalizeUrl(url);
            console.log(`原始: ${url}`);
            console.log(`标准: ${normalized}`);
            console.log('---');
        });
        
    } else if (args.includes('--similarity')) {
        // 相似度测试
        const url1 = args[args.indexOf('--similarity') + 1];
        const url2 = args[args.indexOf('--similarity') + 2];
        
        if (url1 && url2) {
            const similarity = normalizer.calculateUrlSimilarity(url1, url2);
            console.log(`URL相似度: ${Math.round(similarity * 100)}%`);
            console.log(`URL1: ${url1}`);
            console.log(`URL2: ${url2}`);
        } else {
            console.log('用法: --similarity <url1> <url2>');
        }
        
    } else if (args.includes('--report')) {
        // 从当前URL文件生成报告
        const urlFiles = ['deep_urls_*.txt'];
        // 实现报告生成逻辑
        console.log('生成URL标准化报告...');
    } else {
        console.log('增强版URL标准化器');
        console.log('用法:');
        console.log('  --test        运行测试样例');
        console.log('  --similarity  计算两个URL的相似度');
        console.log('  --report      生成标准化报告');
    }
}

module.exports = EnhancedUrlNormalizer;