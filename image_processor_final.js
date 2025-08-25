#!/usr/bin/env node

/**
 * 图片处理模块 - 增强版本
 * 新功能：图片去重、路径修复、格式检测、完整性验证
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const GolfComImageHandler = require('./golf_com_image_handler');
const MyGolfSpyImageHandler = require('./mygolfspy_com_image_handler');
const GolfDigestImageProcessor = require('./golfdigest_image_processor');
const TodaysGolferImageHandler = require('./todays_golfer_image_handler');

class ImageProcessorEnhanced {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.imagesDir = path.join(baseDir, 'images');
        this.imageHashesFile = path.join(baseDir, 'image_hashes.json');
        
        // 确保图片目录存在
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
        }
        
        // 加载已有图片的哈希值
        this.loadImageHashes();
        
        // 初始化网站特定的图片处理器
        this.golfComHandler = new GolfComImageHandler();
        this.myGolfSpyHandler = new MyGolfSpyImageHandler();
        this.golfDigestHandler = new GolfDigestImageProcessor();
        this.todaysGolferHandler = new TodaysGolferImageHandler();
    }

    /**
     * 加载已有图片的哈希值用于去重 - 增强版，自动清理无效记录
     */
    loadImageHashes() {
        try {
            if (fs.existsSync(this.imageHashesFile)) {
                this.imageHashes = JSON.parse(fs.readFileSync(this.imageHashesFile, 'utf8'));
                
                // 清理不存在的文件记录
                let hasInvalid = false;
                Object.keys(this.imageHashes).forEach(filename => {
                    const fullPath = path.join(this.imagesDir, filename);
                    if (!fs.existsSync(fullPath)) {
                        console.log(`🗑️ 清理无效图片记录: ${filename}`);
                        delete this.imageHashes[filename];
                        hasInvalid = true;
                    }
                });
                
                // 如果有清理，保存更新后的记录
                if (hasInvalid) {
                    this.saveImageHashes();
                }
            } else {
                this.imageHashes = {};
            }
        } catch (e) {
            console.log('📋 创建新的图片哈希记录文件');
            this.imageHashes = {};
        }
    }

    /**
     * 保存图片哈希记录
     */
    saveImageHashes() {
        try {
            fs.writeFileSync(this.imageHashesFile, JSON.stringify(this.imageHashes, null, 2));
        } catch (e) {
            console.error('⚠️ 保存图片哈希记录失败:', e.message);
        }
    }

    /**
     * 计算图片内容的MD5哈希值
     */
    calculateImageHash(buffer) {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    /**
     * 检测图片真实格式
     */
    detectImageFormat(buffer) {
        const header = buffer.toString('hex', 0, 10).toUpperCase();
        const headerStr = buffer.toString('utf8', 0, 20);
        
        // 改进的JPEG检测 - 所有FFD8开头的都是JPEG
        if (header.startsWith('FFD8')) return 'jpg';
        if (header.startsWith('89504E47')) return 'png';
        if (header.startsWith('47494638')) return 'gif';
        if (header.startsWith('52494646') && buffer.toString('hex', 8, 12).toUpperCase() === '57454250') return 'webp';
        if (header.startsWith('424D')) return 'bmp';
        
        // 检测AVIF格式
        if (headerStr.includes('ftypavif') || headerStr.includes('ftypheic') || 
            headerStr.includes('ftypmif1') || headerStr.includes('ftypmiaf')) {
            // AVIF格式，返回avif
            return 'avif';
        }
        
        return 'jpg'; // 默认返回jpg
    }

    /**
     * 验证图片文件完整性
     */
    validateImage(filepath) {
        try {
            const stats = fs.statSync(filepath);
            if (stats.size < 1024) { // 小于1KB可能是损坏的
                return false;
            }
            
            const buffer = fs.readFileSync(filepath);
            const format = this.detectImageFormat(buffer);
            
            // 检查是否为HTML内容（错误页面）
            const bufferStr = buffer.toString('utf8', 0, 200).toLowerCase();
            if (bufferStr.includes('<!doctype') || bufferStr.includes('<html') || bufferStr.includes('<?xml')) {
                return false;
            }
            
            // 基本格式检查 - 改进的JPEG检测
            const headerHex = buffer.toString('hex', 0, 4).toUpperCase();
            if (format === 'jpg' && !headerHex.startsWith('FFD8')) {
                return false;
            }
            
            // AVIF格式也是有效的
            if (format === 'avif') {
                return true;
            }
            if (format === 'png' && !headerHex.startsWith('89504E47')) {
                return false;
            }
            if (format === 'webp' && !buffer.toString('utf8', 0, 4).includes('RIFF')) {
                return false;
            }
            
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 查找重复图片 - 增强版，确保文件实际存在
     */
    findDuplicateImage(hash) {
        // 存储需要清理的无效记录
        const invalidEntries = [];
        
        for (const [filename, storedHash] of Object.entries(this.imageHashes)) {
            if (storedHash === hash) {
                const fullPath = path.join(this.imagesDir, filename);
                if (fs.existsSync(fullPath)) {
                    // 文件存在，可以复用
                    return filename;
                } else {
                    // 文件不存在，记录下来准备清理
                    console.log(`    ⚠️ 哈希记录中的文件不存在: ${filename}`);
                    invalidEntries.push(filename);
                }
            }
        }
        
        // 清理无效记录
        if (invalidEntries.length > 0) {
            invalidEntries.forEach(filename => {
                delete this.imageHashes[filename];
            });
            // 立即保存清理后的记录
            this.saveImageHashes();
        }
        
        return null;
    }

    /**
     * 下载图片（带重试机制和去重）
     */
    async downloadImages(browser, images, articleNum, currentDate, articleUrl = '') {
        console.log(`🖼️ 开始处理 ${images.length} 张图片...`);
        
        // 检查是否需要使用专用图片处理器
        const isGolfCom = articleUrl.includes('golf.com');
        const isMyGolfSpy = articleUrl.includes('mygolfspy.com');
        const isGolfDigest = articleUrl.includes('golfdigest.com');
        const isTodaysGolfer = articleUrl.includes('todays-golfer.com');
        
        if (isGolfCom) {
            console.log('🏌️ 检测到Golf.com，使用专用图片处理器');
            return await this.downloadGolfComImages(browser, images, articleNum);
        }
        
        if (isMyGolfSpy) {
            console.log('🔍 检测到MyGolfSpy.com，使用专用图片处理器');
            return await this.downloadMyGolfSpyImages(browser, images, articleNum);
        }
        
        if (isGolfDigest) {
            console.log('📰 检测到Golf Digest，使用专用图片处理器');
            return await this.downloadGolfDigestImages(browser, images, articleNum, articleUrl);
        }
        
        if (isTodaysGolfer) {
            console.log('⛳ 检测到Today\'s Golfer，使用专用图片处理器');
            return await this.downloadTodaysGolferImages(browser, images, articleNum);
        }
        
        const results = await Promise.all(images.map(async (img, i) => {
            const imageIndex = i + 1;
            let downloaded = false;
            let finalFilename = null;
            
            console.log(`  📷 处理图片 ${imageIndex}/${images.length}: ${img.url}`);
            
            // 重试3次下载
            for (let retry = 0; retry < 3; retry++) {
                const page = await browser.newPage();
                try {
                    // 使用两种方法下载图片
                    let buffer;
                    
                    try {
                        // 方法1: 直接导航到图片（对大多数网站有效）
                        const response = await page.goto(img.url, { 
                            timeout: 15000,
                            waitUntil: 'networkidle0'
                        });
                        
                        if (response && response.ok()) {
                            buffer = await response.body();
                        }
                    } catch (e) {
                        // 忽略第一种方法的错误
                    }
                    
                    // 如果第一种方法失败，尝试第二种方法
                    if (!buffer) {
                        // 方法2: 使用fetch在页面上下文中下载（处理防盗链）
                        const imageData = await page.evaluate(async (url) => {
                            try {
                                const response = await fetch(url);
                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                const blob = await response.blob();
                                const arrayBuffer = await blob.arrayBuffer();
                                return Array.from(new Uint8Array(arrayBuffer));
                            } catch (e) {
                                return null;
                            }
                        }, img.url);
                        
                        if (!imageData) {
                            throw new Error('无法获取图片数据');
                        }
                        
                        buffer = Buffer.from(imageData);
                    }
                    
                    // 检测图片格式
                    const format = this.detectImageFormat(buffer);
                    
                    // 计算哈希值检查重复
                    const hash = this.calculateImageHash(buffer);
                    const duplicateFilename = this.findDuplicateImage(hash);
                    
                    if (duplicateFilename) {
                        // 再次验证文件确实存在
                        const duplicatePath = path.join(this.imagesDir, duplicateFilename);
                        if (fs.existsSync(duplicatePath)) {
                            console.log(`    ⏭️ 发现重复图片，复用: ${duplicateFilename}`);
                            finalFilename = duplicateFilename;
                            downloaded = true;
                            break;
                        } else {
                            // 文件不存在，删除记录并继续下载
                            console.log(`    ⚠️ 重复图片文件不存在，需要重新下载`);
                            delete this.imageHashes[duplicateFilename];
                        }
                    }
                    
                    // 生成新文件名
                    const filename = `article_${articleNum}_img_${imageIndex}.${format}`;
                    const filepath = path.join(this.imagesDir, filename);
                    
                    // 如果文件已存在，生成新的编号
                    let counter = 1;
                    let actualFilename = filename;
                    let actualFilepath = filepath;
                    while (fs.existsSync(actualFilepath)) {
                        actualFilename = `article_${articleNum}_img_${imageIndex}_${counter}.${format}`;
                        actualFilepath = path.join(this.imagesDir, actualFilename);
                        counter++;
                    }
                    
                    // 保存图片
                    fs.writeFileSync(actualFilepath, buffer);
                    
                    // 验证图片完整性
                    if (!this.validateImage(actualFilepath)) {
                        fs.unlinkSync(actualFilepath);
                        throw new Error('图片文件损坏');
                    }
                    
                    // 记录哈希值
                    this.imageHashes[actualFilename] = hash;
                    
                    finalFilename = actualFilename;
                    console.log(`    ✅ 下载成功: ${actualFilename} (${(buffer.length / 1024).toFixed(1)}KB)`);
                    downloaded = true;
                    break;
                    
                } catch (e) {
                    if (retry < 2) {
                        console.log(`    ⚠️ 下载失败，重试 ${retry + 2}/3: ${e.message}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        console.error(`    ❌ 下载失败 (已重试3次): ${e.message}`);
                    }
                } finally {
                    await page.close();
                }
            }
            
            // 设置返回值
            img.filename = finalFilename;
            img.index = imageIndex;
            img.downloaded = downloaded;
            
            // 最终验证：确保文件真的存在
            if (downloaded && finalFilename) {
                const verifyPath = path.join(this.imagesDir, finalFilename);
                if (!fs.existsSync(verifyPath)) {
                    console.log(`    ❌ 最终验证失败：文件不存在 ${finalFilename}`);
                    img.downloaded = false;
                    img.filename = null;
                }
            }
            
            return img;
        }));
        
        // 保存图片哈希记录
        this.saveImageHashes();
        
        return results;
    }

    /**
     * 去除Markdown中连续重复的图片
     */
    removeDuplicateImages(content) {
        // 匹配Markdown图片语法: ![alt](path)
        const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)$/;
        const lines = content.split('\n');
        const result = [];
        let lastImageAlt = '';
        let lastImageIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const imageMatch = line.match(imageRegex);
            
            if (imageMatch) {
                const imageAlt = imageMatch[1];
                const imagePath = imageMatch[2];
                
                // 检查是否是连续的图片（中间最多允许一个空行）
                const isConsecutive = lastImageIndex >= 0 && (i - lastImageIndex) <= 2;
                
                // 检查描述文字是否相同（忽略大小写）
                const isSameAlt = imageAlt.toLowerCase() === lastImageAlt.toLowerCase();
                
                if (isConsecutive && isSameAlt) {
                    console.log(`    🗑️ 移除连续重复的图片: ${imagePath} (相同描述: "${imageAlt}")`);
                    continue; // 跳过这行
                }
                
                lastImageAlt = imageAlt;
                lastImageIndex = i;
                result.push(lines[i]); // 保留原始行（包括缩进）
            } else {
                // 如果不是图片，检查是否是空行
                if (line !== '') {
                    // 不是空行，重置图片追踪
                    lastImageIndex = -1;
                }
                result.push(lines[i]);
            }
        }
        
        return result.join('\n');
    }
    
    /**
     * 替换文章中的图片占位符 - 修复路径问题并去除连续重复
     */
    replaceImagePlaceholders(content, images) {
        let result = content;
        
        // 先处理连续重复的图片引用
        result = this.removeDuplicateImages(result);
        
        images.forEach(img => {
            if (img.filename && img.downloaded) {
                // 验证图片文件确实存在
                const fullPath = path.join(this.imagesDir, img.filename);
                if (!fs.existsSync(fullPath)) {
                    console.log(`    ⚠️ 警告：图片文件不存在，跳过替换: ${img.filename}`);
                    return;
                }
                
                // 英文格式占位符
                const englishRegex = new RegExp(`\\[IMAGE_${img.index}:[^\\]]+\\]`, 'gi');
                // 中文格式占位符
                const chineseRegex = new RegExp(`\\[图片${img.index}：[^\\]]+\\]`, 'gi');
                
                // 修复路径 - 使用相对于当前日期文件夹的路径
                const imagePath = `../images/${img.filename}`;
                const replacement = `![${img.alt || `图片${img.index}`}](${imagePath})`;
                
                // 先尝试替换英文格式
                const beforeReplace = result;
                result = result.replace(englishRegex, replacement);
                
                // 如果没有替换成功，尝试中文格式
                if (beforeReplace === result) {
                    result = result.replace(chineseRegex, replacement);
                }
                
                console.log(`    🔗 已替换图片占位符: [图片${img.index}] -> ${img.filename}`);
            } else {
                console.log(`    ⚠️ 图片${img.index}下载失败，保留占位符`);
            }
        });
        
        return result;
    }

    /**
     * 为HTML生成正确的图片路径
     */
    replaceImagePlaceholdersForHTML(content, images, currentDate) {
        let result = content;
        
        images.forEach(img => {
            if (img.filename && img.downloaded) {
                // 英文格式占位符
                const englishRegex = new RegExp(`\\[IMAGE_${img.index}:[^\\]]+\\]`, 'gi');
                // 中文格式占位符  
                const chineseRegex = new RegExp(`\\[图片${img.index}：[^\\]]+\\]`, 'gi');
                
                // HTML中使用绝对路径（相对于web服务器根目录）
                const imagePath = `/golf_content/${currentDate}/images/${img.filename}`;
                const replacement = `<img src="${imagePath}" alt="${img.alt || `图片${img.index}`}" style="max-width: 100%; height: auto; display: block; margin: 1rem auto;">`;
                
                // 先尝试替换英文格式
                const beforeReplace = result;
                result = result.replace(englishRegex, replacement);
                
                // 如果没有替换成功，尝试中文格式
                if (beforeReplace === result) {
                    result = result.replace(chineseRegex, replacement);
                }
            }
        });
        
        return result;
    }

    /**
     * 生成Base64内嵌图片的HTML
     */
    replaceImagePlaceholdersForBase64(content, images) {
        let result = content;
        
        images.forEach(img => {
            if (img.filename && img.downloaded) {
                try {
                    const imagePath = path.join(this.imagesDir, img.filename);
                    if (fs.existsSync(imagePath)) {
                        const buffer = fs.readFileSync(imagePath);
                        const format = this.detectImageFormat(buffer);
                        const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
                        const base64 = buffer.toString('base64');
                        
                        // 英文格式占位符
                        const englishRegex = new RegExp(`\\[IMAGE_${img.index}:[^\\]]+\\]`, 'gi');
                        // 中文格式占位符
                        const chineseRegex = new RegExp(`\\[图片${img.index}：[^\\]]+\\]`, 'gi');
                        
                        const replacement = `<img src="data:${mimeType};base64,${base64}" alt="${img.alt || `图片${img.index}`}" style="max-width: 100%; height: auto; display: block; margin: 1rem auto;">`;
                        
                        // 先尝试替换英文格式
                        const beforeReplace = result;
                        result = result.replace(englishRegex, replacement);
                        
                        // 如果没有替换成功，尝试中文格式
                        if (beforeReplace === result) {
                            result = result.replace(chineseRegex, replacement);
                        }
                        
                        console.log(`    📎 已转换为Base64: 图片${img.index} (${(base64.length / 1024).toFixed(1)}KB)`);
                    }
                } catch (e) {
                    console.error(`    ❌ Base64转换失败: 图片${img.index} - ${e.message}`);
                }
            }
        });
        
        return result;
    }

    /**
     * 提取文章中的图片占位符信息
     */
    extractPlaceholders(content) {
        const placeholders = [];
        
        // 匹配英文格式
        const englishRegex = /\[IMAGE_(\d+):([^\]]+)\]/gi;
        let match;
        while ((match = englishRegex.exec(content)) !== null) {
            placeholders.push({
                full: match[0],
                index: parseInt(match[1]),
                description: match[2],
                type: 'english'
            });
        }
        
        // 匹配中文格式
        const chineseRegex = /\[图片(\d+)：([^\]]+)\]/gi;
        while ((match = chineseRegex.exec(content)) !== null) {
            placeholders.push({
                full: match[0],
                index: parseInt(match[1]),
                description: match[2],
                type: 'chinese'
            });
        }
        
        return placeholders;
    }

    /**
     * 清理无效的图片哈希记录
     */
    cleanupImageHashes() {
        let cleaned = 0;
        for (const [filename, hash] of Object.entries(this.imageHashes)) {
            const fullPath = path.join(this.imagesDir, filename);
            if (!fs.existsSync(fullPath)) {
                delete this.imageHashes[filename];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.saveImageHashes();
            console.log(`🧹 清理了 ${cleaned} 个无效的图片哈希记录`);
        }
    }

    /**
     * 获取图片统计信息
     */
    getImageStats() {
        const totalImages = Object.keys(this.imageHashes).length;
        let totalSize = 0;
        
        for (const filename of Object.keys(this.imageHashes)) {
            const fullPath = path.join(this.imagesDir, filename);
            if (fs.existsSync(fullPath)) {
                totalSize += fs.statSync(fullPath).size;
            }
        }
        
        return {
            totalImages,
            totalSize,
            totalSizeFormatted: (totalSize / 1024 / 1024).toFixed(2) + 'MB'
        };
    }

    /**
     * Golf.com专用图片下载方法
     */
    async downloadGolfComImages(browser, images, articleNum) {
        console.log(`🏌️ 使用Golf.com专用处理器下载 ${images.length} 张图片`);
        
        const page = await browser.newPage();
        const articleDir = this.baseDir;
        
        try {
            // 使用Golf.com专用处理器，传递文章编号
            const downloadedImages = await this.golfComHandler.downloadArticleImages(page, images, articleDir, articleNum);
            
            // 转换结果格式以匹配主处理器的期望
            return images.map((img, index) => {
                const downloaded = downloadedImages.find(d => d.originalUrl === img.url);
                
                if (downloaded) {
                    // 记录到哈希表中
                    const hash = this.calculateImageHash(fs.readFileSync(downloaded.path || downloaded.localPath));
                    this.imageHashes[downloaded.filename] = hash;
                    
                    return {
                        ...img,
                        filename: downloaded.filename,
                        index: index + 1,
                        downloaded: true
                    };
                } else {
                    return {
                        ...img,
                        filename: null,
                        index: index + 1,
                        downloaded: false
                    };
                }
            });
        } finally {
            await page.close();
            this.saveImageHashes();
        }
    }

    /**
     * MyGolfSpy.com专用图片下载方法
     */
    async downloadMyGolfSpyImages(browser, images, articleNum) {
        console.log(`🔍 使用MyGolfSpy.com专用处理器下载 ${images.length} 张图片`);
        
        // 创建带有cookie支持的上下文
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        
        // 加载保存的cookies
        await this.myGolfSpyHandler.loadCookies(context);
        
        const page = await context.newPage();
        const articleDir = this.baseDir;
        
        try {
            // 使用MyGolfSpy.com专用处理器，传递文章编号
            const downloadedImages = await this.myGolfSpyHandler.downloadArticleImages(page, images, articleDir, articleNum);
            
            // 保存cookies（如果成功访问了页面）
            if (downloadedImages.length > 0) {
                await this.myGolfSpyHandler.saveCookies(context);
            }
            
            // 转换结果格式以匹配主处理器的期望
            return images.map((img, index) => {
                const downloaded = downloadedImages.find(d => d.originalUrl === img.url);
                
                if (downloaded) {
                    // 记录到哈希表中
                    const hash = this.calculateImageHash(fs.readFileSync(downloaded.path || downloaded.localPath));
                    this.imageHashes[downloaded.filename] = hash;
                    
                    return {
                        ...img,
                        filename: downloaded.filename,
                        index: index + 1,
                        downloaded: true
                    };
                } else {
                    return {
                        ...img,
                        filename: null,
                        index: index + 1,
                        downloaded: false
                    };
                }
            });
        } finally {
            await page.close();
            await context.close();
            this.saveImageHashes();
        }
    }

    /**
     * Golf Digest专用图片下载方法
     */
    async downloadGolfDigestImages(browser, images, articleNum, articleUrl) {
        console.log(`📰 使用Golf Digest专用处理器下载 ${images.length} 张图片`);
        
        const downloadedImages = await this.golfDigestHandler.downloadImages(
            images, 
            this.imagesDir, 
            articleNum,
            articleUrl
        );
        
        // 转换结果格式并记录哈希
        const results = images.map((img, index) => {
            const downloaded = downloadedImages.find(d => d.url === img.url);
            
            if (downloaded && downloaded.success) {
                // 尝试计算哈希值
                try {
                    if (fs.existsSync(downloaded.localPath)) {
                        const hash = this.calculateImageHash(fs.readFileSync(downloaded.localPath));
                        this.imageHashes[downloaded.filename] = hash;
                    }
                } catch (e) {
                    console.log(`⚠️ 无法计算图片哈希: ${downloaded.filename}`);
                }
                
                return {
                    ...img,
                    filename: downloaded.filename,
                    index: index + 1,
                    downloaded: true
                };
            } else {
                // 如果专用处理器失败，尝试使用浏览器方式
                if (!downloaded || !downloaded.success) {
                    console.log(`⚠️ Golf Digest专用处理器失败，将使用浏览器下载: ${img.url}`);
                }
                
                return {
                    ...img,
                    filename: null,
                    index: index + 1,
                    downloaded: false,
                    needBrowserDownload: true
                };
            }
        });
        
        // 对于失败的图片，尝试使用浏览器下载
        const failedImages = results.filter(r => r.needBrowserDownload);
        if (failedImages.length > 0) {
            console.log(`📥 使用浏览器下载 ${failedImages.length} 张失败的图片...`);
            
            for (const img of failedImages) {
                const page = await browser.newPage();
                try {
                    await page.goto(articleUrl, { waitUntil: 'domcontentloaded' });
                    
                    const response = await page.goto(img.url, { 
                        timeout: 30000,
                        waitUntil: 'networkidle0'
                    });
                    
                    if (response && response.ok()) {
                        const buffer = await response.body();
                        const format = this.detectImageFormat(buffer);
                        const filename = `golfdigest_image_${articleNum}_${img.index}.${format}`;
                        const filepath = path.join(this.imagesDir, filename);
                        
                        fs.writeFileSync(filepath, buffer);
                        console.log(`✅ 浏览器下载成功: ${filename}`);
                        
                        // 更新结果
                        img.filename = filename;
                        img.downloaded = true;
                        
                        // 记录哈希
                        const hash = this.calculateImageHash(buffer);
                        this.imageHashes[filename] = hash;
                    }
                } catch (e) {
                    console.log(`❌ 浏览器下载失败: ${e.message}`);
                } finally {
                    await page.close();
                }
            }
        }
        
        this.saveImageHashes();
        return results;
    }

    /**
     * Today's Golfer专用图片下载方法
     */
    async downloadTodaysGolferImages(browser, images, articleNum) {
        console.log(`⛳ 使用Today's Golfer专用处理器下载 ${images.length} 张图片`);
        
        // 预处理图片列表，去除重复
        const processedImages = this.todaysGolferHandler.preprocessImages(images);
        
        // 下载处理后的图片
        const results = await Promise.all(processedImages.map(async (img, index) => {
            const page = await browser.newPage();
            
            try {
                const downloadResult = await this.todaysGolferHandler.downloadImage(
                    page,
                    img,
                    articleNum,
                    this.imagesDir
                );
                
                if (downloadResult.downloaded) {
                    // 记录哈希值
                    const filepath = path.join(this.imagesDir, downloadResult.filename);
                    if (fs.existsSync(filepath)) {
                        const hash = this.calculateImageHash(fs.readFileSync(filepath));
                        this.imageHashes[downloadResult.filename] = hash;
                    }
                }
                
                return downloadResult;
                
            } catch (error) {
                console.error(`❌ 处理图片 ${img.index} 失败: ${error.message}`);
                return {
                    ...img,
                    filename: null,
                    downloaded: false
                };
            } finally {
                await page.close();
            }
        }));
        
        this.saveImageHashes();
        return results;
    }

    /**
     * 完成处理后的清理工作
     */
    finalize() {
        this.cleanupImageHashes();
        this.saveImageHashes();
        
        const stats = this.getImageStats();
        console.log(`📊 图片库统计: ${stats.totalImages} 张图片，总大小 ${stats.totalSizeFormatted}`);
    }
}

module.exports = ImageProcessorEnhanced;