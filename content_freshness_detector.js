const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 真正的内容新鲜度检测器
 * 基于内容hash和发布时间，而非URL
 */
class ContentFreshnessDetector {
    constructor() {
        this.contentHashDB = path.join(__dirname, 'content_hash_database.json');
        this.loadContentHashDB();
    }

    /**
     * 加载内容hash数据库
     */
    loadContentHashDB() {
        try {
            if (fs.existsSync(this.contentHashDB)) {
                this.hashDB = JSON.parse(fs.readFileSync(this.contentHashDB, 'utf8'));
            } else {
                this.hashDB = {};
            }
        } catch (error) {
            console.log('⚠️ 无法加载内容hash数据库，创建新的');
            this.hashDB = {};
        }
    }

    /**
     * 保存内容hash数据库
     */
    saveContentHashDB() {
        try {
            fs.writeFileSync(this.contentHashDB, JSON.stringify(this.hashDB, null, 2));
        } catch (error) {
            console.error('❌ 保存内容hash数据库失败:', error.message);
        }
    }

    /**
     * 生成内容hash
     * @param {string} content - 文章内容
     * @param {string} title - 文章标题
     * @returns {string} - 内容hash
     */
    generateContentHash(content, title) {
        // 清理内容：移除空白字符、标点符号等
        const cleanContent = content
            .replace(/\\s+/g, ' ')  // 合并空白字符
            .replace(/[.,!?;:"'"（）【】]/g, '')  // 移除标点符号
            .toLowerCase()
            .trim();
        
        const cleanTitle = title
            .replace(/\\s+/g, ' ')
            .replace(/[.,!?;:"'"（）【】]/g, '')
            .toLowerCase()
            .trim();

        // 组合标题和内容生成hash
        const combinedContent = cleanTitle + '|||' + cleanContent;
        return crypto.createHash('sha256').update(combinedContent).digest('hex');
    }

    /**
     * 检查内容是否已存在（重复）
     * @param {string} content - 文章内容
     * @param {string} title - 文章标题
     * @param {string} url - 文章URL
     * @returns {boolean} - 是否重复
     */
    isContentDuplicate(content, title, url) {
        const contentHash = this.generateContentHash(content, title);
        
        if (this.hashDB[contentHash]) {
            const existing = this.hashDB[contentHash];
            
            // ✅ 检查原URL的真实完成状态
            const isActuallyCompleted = this.checkUrlRealStatus(existing.url);
            
            if (isActuallyCompleted) {
                console.log(`🔄 发现真实重复内容: "${title}"`);
                console.log(`   原文章: ${existing.url} (${existing.processedDate})`);
                console.log(`   当前URL: ${url}`);
                return true;
            } else {
                console.log(`🧹 清理无效哈希记录: "${title}"`);
                console.log(`   原URL状态未完成: ${existing.url}`);
                // 清理无效记录
                delete this.hashDB[contentHash];
                this.saveContentHashDB();
                return false;
            }
        }
        
        return false;
    }

    /**
     * 检查URL的真实完成状态
     * @param {string} url - 要检查的URL
     * @returns {boolean} - 是否真正完成
     */
    checkUrlRealStatus(url) {
        try {
            // 检查今天的状态文件
            const today = new Date().toISOString().split('T')[0];
            const statusFile = path.join(__dirname, `golf_content/${today}/article_urls.json`);
            
            if (fs.existsSync(statusFile)) {
                const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
                const urlRecord = Object.values(statusData).find(record => record.url === url);
                
                if (urlRecord) {
                    return urlRecord.status === 'completed';
                }
            }
            
            return false; // 保守处理：状态未知时不跳过
        } catch (error) {
            console.log(`⚠️ 检查URL状态失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 记录内容hash
     * @param {string} content - 文章内容
     * @param {string} title - 文章标题
     * @param {string} url - 文章URL
     * @param {string} publishDate - 发布日期
     */
    recordContentHash(content, title, url, publishDate) {
        const contentHash = this.generateContentHash(content, title);
        
        this.hashDB[contentHash] = {
            title,
            url,
            publishDate,
            processedDate: new Date().toISOString(),
            contentLength: content.length
        };
        
        this.saveContentHashDB();
        console.log(`✅ 记录新内容hash: "${title}"`);
    }

    /**
     * 检查文章发布时间是否为最近
     * @param {string} publishDate - 发布日期
     * @param {number} maxDaysOld - 最大天数（默认7天）
     * @returns {boolean} - 是否为最近发布
     */
    isRecentlyPublished(publishDate, maxDaysOld = 7) {
        try {
            const pubDate = new Date(publishDate);
            const now = new Date();
            const diffDays = (now - pubDate) / (1000 * 60 * 60 * 24);
            
            const isRecent = diffDays <= maxDaysOld;
            if (!isRecent) {
                console.log(`⏰ 文章发布时间过旧: ${publishDate} (${Math.floor(diffDays)}天前)`);
            }
            return isRecent;
        } catch (error) {
            console.log(`⚠️ 无法解析发布时间: ${publishDate}`);
            return true; // 如果无法解析，默认认为是新的
        }
    }

    /**
     * 综合检查：内容是否真正新鲜
     * @param {Object} article - 文章对象
     * @param {string} article.content - 内容
     * @param {string} article.title - 标题
     * @param {string} article.url - URL
     * @param {string} article.publishDate - 发布日期
     * @returns {Object} - 检查结果
     */
    checkContentFreshness(article) {
        const { content, title, url, publishDate } = article;
        
        // 1. 检查内容是否重复
        const isDuplicate = this.isContentDuplicate(content, title, url);
        if (isDuplicate) {
            return {
                isFresh: false,
                reason: 'content_duplicate',
                message: '内容重复，已处理过相同内容'
            };
        }

        // 2. 检查发布时间是否过旧
        if (publishDate) {
            const isRecent = this.isRecentlyPublished(publishDate);
            if (!isRecent) {
                return {
                    isFresh: false,
                    reason: 'publish_date_too_old',
                    message: '发布时间过旧，超过7天'
                };
            }
        }

        // 3. 通过所有检查，不记录hash（移到文章真正完成时记录）
        
        return {
            isFresh: true,
            reason: 'content_is_fresh',
            message: '内容新鲜，可以处理'
        };
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const totalRecords = Object.keys(this.hashDB).length;
        const recentRecords = Object.values(this.hashDB).filter(record => {
            const processedDate = new Date(record.processedDate);
            const daysDiff = (new Date() - processedDate) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
        }).length;

        return {
            totalRecords,
            recentRecords,
            dbSize: `${(JSON.stringify(this.hashDB).length / 1024).toFixed(2)} KB`
        };
    }
}

module.exports = ContentFreshnessDetector;