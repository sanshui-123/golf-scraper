/**
 * Golf Digest专用图片处理器
 * 处理Golf Digest网站的特殊图片下载需求
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const appendFile = promisify(fs.appendFile);

class GolfDigestImageProcessor {
    constructor() {
        // User-Agent轮换池
        this.userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
        ];
        
        this.baseHeaders = {
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        };
        
        // 错误统计
        this.errorStats = {
            total: 0,
            network: 0,
            timeout: 0,
            notFound: 0,
            forbidden: 0,
            serverError: 0,
            other: 0
        };
        
        // 重试延迟配置（指数退避）
        this.retryDelays = [1000, 3000, 9000]; // 1秒、3秒、9秒
        this.maxRetries = 3;
    }

    /**
     * 获取随机User-Agent
     */
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * 处理Golf Digest图片URL
     */
    processImageUrl(url) {
        if (!url) return null;
        
        // 处理相对URL
        if (url.startsWith('//')) {
            url = 'https:' + url;
        } else if (url.startsWith('/')) {
            url = 'https://www.golfdigest.com' + url;
        }
        
        // 处理Condé Nast CDN图片
        if (url.includes('cni-digital') || url.includes('conde') || url.includes('cni.com')) {
            // 尝试获取高质量版本
            url = url.replace(/w_\d+/, 'w_1600');
            url = url.replace(/h_\d+/, 'h_1200');
            url = url.replace(/c_limit/, 'c_fill');
            url = url.replace(/c_scale/, 'c_fill');
            url = url.replace(/q_auto:low/, 'q_auto:good');
            url = url.replace(/q_auto:eco/, 'q_auto:good');
            url = url.replace(/f_auto/, 'f_jpg'); // 强制JPG格式，避免WebP问题
        }
        
        // 移除查询参数中的尺寸限制
        if (url.includes('?')) {
            const [baseUrl, queryString] = url.split('?');
            const params = new URLSearchParams(queryString);
            
            // 移除可能限制尺寸的参数
            params.delete('width');
            params.delete('height');
            params.delete('w');
            params.delete('h');
            params.delete('resize');
            params.delete('fit');
            
            const newQuery = params.toString();
            url = newQuery ? `${baseUrl}?${newQuery}` : baseUrl;
        }
        
        return url;
    }

    /**
     * 记录下载失败日志
     */
    async logDownloadFailure(url, errorType, errorMessage, retryCount) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            url: url,
            errorType: errorType,
            errorMessage: errorMessage,
            retryCount: retryCount,
            userAgent: this.getRandomUserAgent()
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        const logFile = path.join(__dirname, 'download_failures.log');
        
        try {
            await appendFile(logFile, logLine);
        } catch (err) {
            console.error('[Golf Digest] 写入失败日志时出错:', err.message);
        }
    }

    /**
     * 分类错误类型
     */
    classifyError(error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            return 'network';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.code === 'ECONNABORTED') {
            return 'timeout';
        } else if (error.response) {
            const status = error.response.status;
            if (status === 404) return 'notFound';
            if (status === 403 || status === 401) return 'forbidden';
            if (status >= 500) return 'serverError';
        }
        return 'other';
    }

    /**
     * 下载单张图片（带智能重试）
     */
    async downloadImageWithRetry(imageUrl, savePath, articleUrl = '', retryCount = 0) {
        try {
            // 处理图片URL
            const processedUrl = this.processImageUrl(imageUrl);
            if (!processedUrl) {
                console.log('[Golf Digest] 无效的图片URL');
                return false;
            }
            
            console.log(`[Golf Digest] 下载图片: ${processedUrl}`);
            
            // 设置请求头（使用随机User-Agent）
            const requestHeaders = {
                ...this.baseHeaders,
                'User-Agent': this.getRandomUserAgent(),
                'Referer': articleUrl || 'https://www.golfdigest.com/'
            };
            
            // 下载图片
            const response = await axios({
                method: 'GET',
                url: processedUrl,
                responseType: 'stream',
                headers: requestHeaders,
                timeout: 30000,
                maxRedirects: 10,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // 接受所有2xx和3xx响应
                },
                // 处理重定向
                beforeRedirect: (options, { headers }) => {
                    // 保持必要的headers
                    if (headers['set-cookie']) {
                        options.headers.cookie = headers['set-cookie'];
                    }
                }
            });
            
            // 检查响应状态
            if (response.status !== 200) {
                console.log(`[Golf Digest] 图片下载失败，状态码: ${response.status}`);
                return false;
            }
            
            // 获取文件大小
            const contentLength = response.headers['content-length'];
            if (contentLength) {
                const sizeInKB = Math.round(parseInt(contentLength) / 1024);
                console.log(`[Golf Digest] 图片大小: ${sizeInKB}KB`);
            }
            
            // 保存图片
            const writer = fs.createWriteStream(savePath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`[Golf Digest] ✅ 图片已保存: ${path.basename(savePath)}`);
                    resolve(true);
                });
                writer.on('error', (err) => {
                    console.error(`[Golf Digest] 保存失败: ${err.message}`);
                    reject(false);
                });
            });
            
        } catch (error) {
            const errorType = this.classifyError(error);
            this.errorStats[errorType]++;
            this.errorStats.total++;
            
            console.error(`[Golf Digest] 下载失败 (尝试 ${retryCount + 1}/${this.maxRetries + 1}): ${error.message}`);
            
            // 记录错误日志
            await this.logDownloadFailure(imageUrl, errorType, error.message, retryCount);
            
            // 如果还有重试机会
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelays[retryCount];
                console.log(`[Golf Digest] 等待 ${delay/1000}秒 后重试...`);
                await this.delay(delay);
                
                // 递归重试
                return await this.downloadImageWithRetry(imageUrl, savePath, articleUrl, retryCount + 1);
            }
            
            // 如果是403错误且重试失败，返回false让主程序使用浏览器下载
            if (error.response && error.response.status === 403) {
                console.log('[Golf Digest] 403错误重试失败，返回false让主程序使用浏览器下载');
                return false;
            }
            
            // 所有重试失败
            console.error(`[Golf Digest] 所有重试均失败，错误类型: ${errorType}`);
            return false;
        }
    }

    /**
     * 批量下载图片
     */
    async downloadImages(images, outputDir, articleId, articleUrl = '') {
        const results = [];
        
        // 限制并发数量，避免过多请求
        const BATCH_SIZE = 5;
        const MAX_IMAGES = 20; // 最多处理20张图片，避免文章过于臃肿
        
        // 如果图片超过20张，只取前20张
        const imagesToProcess = images.slice(0, MAX_IMAGES);
        if (images.length > MAX_IMAGES) {
            console.log(`[Golf Digest] 图片过多(${images.length}张)，只处理前${MAX_IMAGES}张`);
        }
        
        // 分批处理
        for (let batchStart = 0; batchStart < imagesToProcess.length; batchStart += BATCH_SIZE) {
            const batch = imagesToProcess.slice(batchStart, batchStart + BATCH_SIZE);
            const batchPromises = [];
            
            for (let i = 0; i < batch.length; i++) {
                const image = batch[i];
                const imageUrl = image.url || image;
                const imageIndex = batchStart + i;
                
                // 生成文件名
                const extension = this.getImageExtension(imageUrl);
                const filename = `golfdigest_image_${articleId}_${imageIndex + 1}${extension}`;
                const savePath = path.join(outputDir, filename);
                
                // 检查文件是否已存在
                if (fs.existsSync(savePath)) {
                    console.log(`[Golf Digest] 图片已存在，跳过: ${filename}`);
                    results.push({
                        url: imageUrl,
                        localPath: savePath,
                        filename: filename,
                        success: true
                    });
                    continue;
                }
                
                // 添加到批处理队列
                batchPromises.push(
                    this.downloadImageWithRetry(imageUrl, savePath, articleUrl)
                        .then(success => ({
                            url: imageUrl,
                            localPath: savePath,
                            filename: filename,
                            success: success
                        }))
                        .catch(err => {
                            console.error(`[Golf Digest] 批处理下载失败: ${err.message}`);
                            return {
                                url: imageUrl,
                                localPath: savePath,
                                filename: filename,
                                success: false
                            };
                        })
                );
            }
            
            // 等待当前批次完成
            if (batchPromises.length > 0) {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // 批次之间延迟
                if (batchStart + BATCH_SIZE < imagesToProcess.length) {
                    await this.delay(1000);
                }
            }
        }
        
        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const successRate = images.length > 0 ? (successCount / images.length * 100).toFixed(1) : 0;
        
        console.log(`[Golf Digest] 图片下载完成: ${successCount}/${images.length} 成功 (${successRate}%)`);
        
        // 输出错误统计
        if (this.errorStats.total > 0) {
            console.log('[Golf Digest] 错误统计:');
            console.log(`  - 网络错误: ${this.errorStats.network}`);
            console.log(`  - 超时错误: ${this.errorStats.timeout}`);
            console.log(`  - 404错误: ${this.errorStats.notFound}`);
            console.log(`  - 403/401错误: ${this.errorStats.forbidden}`);
            console.log(`  - 服务器错误: ${this.errorStats.serverError}`);
            console.log(`  - 其他错误: ${this.errorStats.other}`);
            console.log(`  - 总错误数: ${this.errorStats.total}`);
        }
        
        // 重置错误统计
        this.errorStats = {
            total: 0,
            network: 0,
            timeout: 0,
            notFound: 0,
            forbidden: 0,
            serverError: 0,
            other: 0
        };
        
        return results;
    }

    /**
     * 获取图片扩展名
     */
    getImageExtension(url) {
        const urlPath = url.split('?')[0];
        const ext = path.extname(urlPath).toLowerCase();
        
        // 支持的图片格式
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
        
        if (validExtensions.includes(ext)) {
            return ext;
        }
        
        // 从URL推测格式
        if (url.includes('.jpg') || url.includes('.jpeg')) return '.jpg';
        if (url.includes('.png')) return '.png';
        if (url.includes('.gif')) return '.gif';
        if (url.includes('.webp')) return '.webp';
        
        // 默认jpg
        return '.jpg';
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 获取下载统计信息
     */
    getDownloadStats() {
        return {
            errorStats: { ...this.errorStats },
            retryConfig: {
                maxRetries: this.maxRetries,
                delays: this.retryDelays
            }
        };
    }
}

module.exports = GolfDigestImageProcessor;