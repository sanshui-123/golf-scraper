#!/usr/bin/env node

/**
 * 稳定版高尔夫文章Web服务器
 * 增加端口检测、错误处理、文章删除功能和URL重复检查功能
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const UnifiedHistoryDatabase = require('./unified_history_database');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
let PORT = process.env.PORT || 8080;
const FORCE_PORT = true; // 强制使用指定端口

// 状态缓存系统
const statusCache = {
    data: null,
    timestamp: 0,
    ttl: 2000,  // 2秒缓存
    processing: new Map(), // 处理进度缓存
    history: new Map() // 历史速度数据
};

// 处理速度记录器
const processingSpeed = {
    websites: {},
    lastUpdate: Date.now()
};

// 解析 JSON 请求体
app.use(express.json());

// HTML模板生成器 - 减少重复的HTML字符串拼接
const htmlTemplate = {
    // 通用页面模板
    page: (title, content, extraStyles = '', extraScripts = '') => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${htmlTemplate.baseStyles()}
        ${extraStyles}
    </style>
</head>
<body>
    ${content}
    ${extraScripts}
</body>
</html>`,
    
    // 基础样式（所有页面共享）
    baseStyles: () => `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: rgba(255,255,255,0.95);
            padding: 1.5rem;
            border-radius: 15px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        }
        .notification.success {
            background: #28a745;
        }
        .notification.error {
            background: #dc3545;
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
    `,
    
    // 文章项模板
    articleItem: (article, date) => `
        <div class="article-item ${article.isDuplicate ? 'duplicate-article' : ''}" data-filename="${article.filename}">
            <a href="${article.articleUrl}" class="article-title" onclick="viewArticle(event, '${article.articleUrl}', '${article.chineseTitle.replace(/'/g, "\\'")}'); return false;">
                ${article.chineseTitle}
                ${article.isDuplicate ? '<span class="duplicate-badge">🔁 重复</span>' : ''}
            </a>
            ${article.isDuplicate && article.duplicateInfo ? 
                `<div class="duplicate-warning">
                    ⚠️ 此文章已在 <strong>${article.duplicateInfo.date}</strong> 处理过
                    <span style="font-size: 0.85rem; color: #6c757d;">（${article.duplicateInfo.filename}）</span>
                </div>` : 
                ''
            }
            <div class="article-meta">
                <div class="meta-left">
                    <span class="publish-time" style="font-weight: 600; color: #007bff;">📅 ${article.displayTime}</span>
                    <span class="source-site">🌐 ${article.sourceSite}</span>
                    ${article.sourceUrl ? 
                        `<a href="${article.sourceUrl}" class="source-btn" target="_blank">🔗 查看原文</a>` : 
                        '<span style="color: #6c757d;">暂无原文链接</span>'
                    }
                    ${htmlTemplate.aiDetectionBadge(article.aiDetection)}
                </div>
                <button class="delete-btn" onclick="confirmDelete('${article.filename}', '${article.chineseTitle.replace(/'/g, "\\'")}')">
                    🗑️ 删除
                </button>
            </div>
        </div>
    `,
    
    // AI检测标记模板
    aiDetectionBadge: (aiDetection) => {
        if (!aiDetection) {
            return '<span style="color: #6c757d; font-size: 0.85rem; margin-left: 0.5rem;">⏳ AI检测中</span>';
        }
        const probability = parseFloat(aiDetection.probability);
        const bgColor = probability >= 80 ? '#dc3545' : probability >= 50 ? '#ffc107' : '#28a745';
        return `<span class="ai-detection" style="
            background: ${bgColor};
            color: white;
            padding: 0.3rem 0.6rem;
            border-radius: 12px;
            font-size: 0.85rem;
            margin-left: 0.5rem;
            font-weight: 500;
        " title="检测时间: ${aiDetection.time || '未知'}">
            🤖 AI: ${aiDetection.probability}
        </span>`;
    }
};

// 文件操作助手函数 - 减少重复代码
const fileHelpers = {
    // 安全检查文件是否存在
    async fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    },
    
    // 安全读取文件内容
    async readFileSafe(filePath, defaultValue = '') {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (e) {
            if (e.code !== 'ENOENT') {
                console.error(`读取文件失败 ${filePath}:`, e.message);
            }
            return defaultValue;
        }
    },
    
    // 安全写入文件
    async writeFileSafe(filePath, content) {
        try {
            // 确保目录存在
            const dir = path.dirname(filePath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            // 原子写入（先写临时文件，再重命名）
            const tempFile = `${filePath}.tmp`;
            await fs.promises.writeFile(tempFile, content, 'utf8');
            await fs.promises.rename(tempFile, filePath);
            return true;
        } catch (e) {
            console.error(`写入文件失败 ${filePath}:`, e.message);
            return false;
        }
    },
    
    // 安全删除文件或目录
    async deleteSafe(filePath) {
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                await fs.promises.rm(filePath, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(filePath);
            }
            return true;
        } catch (e) {
            if (e.code !== 'ENOENT') {
                console.error(`删除失败 ${filePath}:`, e.message);
            }
            return false;
        }
    },
    
    // 获取目录下的文件列表
    async listFiles(dirPath, filter = null) {
        try {
            const files = await fs.promises.readdir(dirPath);
            if (filter) {
                return files.filter(filter);
            }
            return files;
        } catch (e) {
            if (e.code !== 'ENOENT') {
                console.error(`读取目录失败 ${dirPath}:`, e.message);
            }
            return [];
        }
    }
};

// 检查端口是否可用 - 优化版本，添加超时处理
function checkPort(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        let resolved = false;
        
        // 添加超时处理
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                server.close(() => {});
                resolve(false);
            }
        }, 1000);
        
        server.listen(port, '127.0.0.1', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                server.close(() => {
                    resolve(true);
                });
            }
        });
        
        server.on('error', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(false);
            }
        });
    });
}

// 找到可用端口
async function findAvailablePort(startPort) {
    for (let port = startPort; port <= startPort + 10; port++) {
        if (await checkPort(port)) {
            return port;
        }
    }
    throw new Error('没有找到可用端口');
}

// 静态文件服务
app.use('/golf_content', express.static(path.join(__dirname, 'golf_content')));
app.use(express.static(__dirname)); // 添加根目录静态文件服务

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        port: PORT,
        uptime: process.uptime()
    });
});


// 提取AI检测结果 - 使用助手函数
async function extractAIDetection(mdFilePath) {
    const content = await fileHelpers.readFileSafe(mdFilePath);
    if (!content) return null;
    
    // 优先检查注释中的AI检测结果
    const commentMatch = content.match(/<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([\d\s:-]+)\s*-->/);
    if (commentMatch) {
        return {
            probability: commentMatch[1] + '%',
            time: commentMatch[2].trim()
        };
    }
    
    // 备用：检查YAML元数据中的AI检测结果
    const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (metadataMatch) {
        const metadata = metadataMatch[1];
        const aiMatch = metadata.match(/ai_detection:\s*"?(\d+(?:\.\d+)?%?)"?/);
        const timeMatch = metadata.match(/detection_time:\s*"?([^"\n]+)"?/);
        
        if (aiMatch) {
            return {
                probability: aiMatch[1],
                time: timeMatch ? timeMatch[1] : null
            };
        }
    }
    
    return null;
}

// 改进的中文标题提取函数 - 使用助手函数
async function extractChineseTitle(htmlFilePath) {
    const content = await fileHelpers.readFileSafe(htmlFilePath);
    if (!content) {
        const fileName = path.basename(htmlFilePath, '.html');
        return fileName.includes('article_') ? 
            `高尔夫文章 ${fileName.replace('article_', '').replace('wechat_', '')}` : 
            fileName.replace(/_/g, ' ');
    }
    
    // 策略1: 查找<h1>标签中的中文内容（优先）
        const h1Matches = content.match(/<h1[^>]*>(.*?)<\/h1>/g);
        if (h1Matches) {
            for (const match of h1Matches) {
                const textContent = match.replace(/<[^>]*>/g, '').trim();
                // 检查是否包含中文字符
                if (/[\u4e00-\u9fa5]/.test(textContent) && textContent.length > 5) {
                    return textContent;
                }
            }
        }
        
        // 策略2: 查找第一个包含中文的<h2>标签
        const h2Matches = content.match(/<h2[^>]*>(.*?)<\/h2>/g);
        if (h2Matches) {
            for (const match of h2Matches) {
                const textContent = match.replace(/<[^>]*>/g, '').trim();
                if (/[\u4e00-\u9fa5]/.test(textContent) && textContent.length > 5) {
                    return textContent;
                }
            }
        }
        
        // 策略3: 查找<title>标签中的中文内容
        const titleMatch = content.match(/<title>(.*?)<\/title>/);
        if (titleMatch && titleMatch[1]) {
            const titleText = titleMatch[1].trim();
            if (/[\u4e00-\u9fa5]/.test(titleText) && titleText.length > 5) {
                return titleText;
            }
        }
        
        // 策略4: 查找第一个包含中文的段落（可能是标题段落）
        const pMatches = content.match(/<p[^>]*>(.*?)<\/p>/g);
        if (pMatches) {
            for (const match of pMatches.slice(0, 5)) { // 只检查前5个段落
                const textContent = match.replace(/<[^>]*>/g, '').trim();
                // 检查是否像标题（长度适中，包含中文，不包含过多标点）
                if (/[\u4e00-\u9fa5]/.test(textContent) && 
                    textContent.length > 10 && 
                    textContent.length < 100 &&
                    !textContent.includes('http') &&
                    !textContent.includes('@')) {
                    return textContent;
                }
            }
        }
        
        // 策略5: 使用文件名作为后备（转换为可读格式）
        const fileName = path.basename(htmlFilePath, '.html');
        if (fileName.includes('article_')) {
            return `高尔夫文章 ${fileName.replace('article_', '').replace('wechat_', '')}`;
        }
        
        return fileName.replace(/_/g, ' ');
}

// 改进的原文链接提取函数 - 使用助手函数
async function extractSourceUrl(htmlFilePath) {
    const content = await fileHelpers.readFileSafe(htmlFilePath);
    if (!content) return null;
        
        // 更多的原文链接查找模式
        const patterns = [
            // HTML结构模式（最常见的格式）- 修改为处理URL前可能有空格的情况
            /<a[^>]+href="\s*(https?:\/\/[^"]+)"[^>]*>.*?查看原文/,
            /<a[^>]+href="\s*(https?:\/\/[^"]+)"[^>]*>.*?原文/,
            /<a[^>]+href="\s*(https?:\/\/[^"]+)"[^>]*>.*?source/i,
            /<a[^>]+href="\s*(https?:\/\/[^"]+)"[^>]*>.*?查看/,
            
            // 中文模式（反向查找）
            /原文链接[^>]*?href="\s*([^"]+)"/,
            /查看原文[^>]*?href="\s*([^"]+)"/,
            /原始链接[^>]*?href="\s*([^"]+)"/,
            /source[^>]*?href="\s*([^"]+)"/i,
            
            // 通用链接模式（golf网站）
            /href="\s*(https?:\/\/[^"]*golf[^"]*)"[^>]*>/i,
            /href="\s*(https?:\/\/www\.golf[^"]*)"[^>]*>/i,
            
            // source-info 类中的链接
            /source-info[^>]*>.*?href="\s*([^"]+)"/,
            
            // 更宽泛的模式
            /"\s*(https?:\/\/(?:www\.)?(?:golf\.com|golfmonthly\.com|mygolfspy\.com|skysports\.com\/golf)[^"]*)"/ 
        ];
        
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                // 去除URL前后的空格
                const url = match[1].trim();
                if (url.startsWith('http')) {
                    return url;
                }
            }
        }
        
        return null;
}

// URL检查功能 - 检查是否已存在该URL的文章
function checkUrlExists(targetUrl) {
    const results = {
        exists: false,
        foundIn: null,
        details: null
    };
    
    try {
        const baseDir = 'golf_content';
        
        if (!fs.existsSync(baseDir)) {
            return results;
        }
        
        // 获取所有日期目录
        const dateDirs = fs.readdirSync(baseDir)
            .filter(dir => {
                const fullPath = path.join(baseDir, dir);
                return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
            })
            .sort().reverse();
        
        // 遍历每个日期目录
        for (const dateDir of dateDirs) {
            // 🔧 新增：首先检查article_urls.json
            const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
            if (fs.existsSync(urlsJsonPath)) {
                try {
                    const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                    // 检查是否有匹配的URL
                    for (const [articleNum, recordedUrl] of Object.entries(urlMapping)) {
                        if (isSameUrl(recordedUrl, targetUrl)) {
                            // 找到匹配的URL，获取对应的HTML文件信息
                            const htmlFile = `wechat_article_${articleNum}.html`;
                            const htmlPath = path.join(baseDir, dateDir, 'wechat_html', htmlFile);
                            
                            if (fs.existsSync(htmlPath)) {
                                results.exists = true;
                                results.foundIn = {
                                    date: dateDir,
                                    filename: htmlFile,
                                    extractedUrl: recordedUrl,
                                    title: extractChineseTitle(htmlPath)
                                };
                                results.details = `文章已存在于 ${dateDir}/${htmlFile} (通过article_urls.json匹配)`;
                                console.log(`✅ 通过article_urls.json找到匹配: ${targetUrl} -> ${htmlFile}`);
                                return results;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`读取 ${urlsJsonPath} 失败:`, e.message);
                }
            }
            
            // 原有逻辑：检查HTML文件中的原文链接
            const htmlDir = path.join(baseDir, dateDir, 'wechat_html');
            
            if (!fs.existsSync(htmlDir)) continue;
            
            const htmlFiles = fs.readdirSync(htmlDir)
                .filter(file => file.endsWith('.html') && !file.includes('backup'));
            
            // 检查每个HTML文件
            for (const file of htmlFiles) {
                const filePath = path.join(htmlDir, file);
                const extractedUrl = extractSourceUrl(filePath);
                
                if (extractedUrl && isSameUrl(extractedUrl, targetUrl)) {
                    results.exists = true;
                    results.foundIn = {
                        date: dateDir,
                        filename: file,
                        extractedUrl: extractedUrl,
                        title: extractChineseTitle(filePath)
                    };
                    results.details = `文章已存在于 ${dateDir}/${file} (通过HTML原文链接匹配)`;
                    return results;
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('URL检查失败:', error);
        results.details = `检查过程出错: ${error.message}`;
        return results;
    }
}

// URL比较函数 - 标准化URL后比较
function isSameUrl(url1, url2) {
    try {
        // 标准化URL
        const normalizeUrl = (url) => {
            // 确保url是字符串
            if (!url || typeof url !== 'string') {
                return '';
            }
            return url
                .toLowerCase()
                .replace(/^https?:\/\//, '')  // 移除协议
                .replace(/^www\./, '')       // 移除www
                .replace(/\/$/, '')          // 移除末尾斜杠
                .replace(/\?.*$/, '')        // 移除查询参数
                .replace(/#.*$/, '');        // 移除锚点
        };
        
        const normalized1 = normalizeUrl(url1);
        const normalized2 = normalizeUrl(url2);
        
        return normalized1 === normalized2;
    } catch (error) {
        console.error('URL比较失败:', error);
        return false;
    }
}

// 批量URL检查
function checkMultipleUrls(urls) {
    const results = [];
    
    for (const url of urls) {
        const checkResult = checkUrlExists(url);
        results.push({
            url: url,
            exists: checkResult.exists,
            foundIn: checkResult.foundIn,
            details: checkResult.details
        });
    }
    
    return results;
}

// 获取所有日期列表
function getAllDates() {
    const dates = [];
    const baseDir = 'golf_content';
    
    try {
        if (!fs.existsSync(baseDir)) {
            console.log('golf_content目录不存在');
            return dates;
        }
        
        const dateDirs = fs.readdirSync(baseDir)
            .filter(dir => {
                const fullPath = path.join(baseDir, dir);
                return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
            })
            .sort().reverse(); // 最新的在前面
        
        dateDirs.forEach(dateDir => {
            const htmlDir = path.join(baseDir, dateDir, 'wechat_html');
            if (fs.existsSync(htmlDir)) {
                const htmlFiles = fs.readdirSync(htmlDir)
                    .filter(file => file.endsWith('.html'));
                
                if (htmlFiles.length > 0) {
                    dates.push({
                        date: dateDir,
                        count: htmlFiles.length,
                        displayDate: new Date(dateDir + 'T00:00:00').toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                        })
                    });
                }
            }
        });
        
        return dates;
    } catch (e) {
        console.error('获取日期列表失败:', e.message);
        return [];
    }
}

// 从URL提取网站域名
function extractWebsiteDomain(url) {
    if (!url || !url.startsWith('http')) {
        return '未知来源';
    }
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // 移除 www. 前缀
        const cleanHostname = hostname.replace(/^www\./, '');
        
        // 针对常见的高尔夫网站返回友好名称
        const siteNames = {
            'golf.com': 'Golf.com',
            'golfmonthly.com': 'Golf Monthly',
            'mygolfspy.com': 'MyGolfSpy',
            'golfdigest.com': 'Golf Digest',
            'golfweek.com': 'Golfweek',
            'skysports.com': 'Sky Sports Golf',
            'golfmagic.com': 'Golf Magic',
            'pga.com': 'PGA.com',
            'golf.org': 'Golf.org',
            'golfchannel.com': 'Golf Channel',
            'espn.com': 'ESPN Golf',
            'si.com': 'Sports Illustrated',
            'bleacherreport.com': 'Bleacher Report',
            'cnn.com': 'CNN Sports',
            'bbc.com': 'BBC Sport',
            'reuters.com': 'Reuters',
            'ap.org': 'Associated Press'
        };
        
        return siteNames[cleanHostname] || cleanHostname;
    } catch (e) {
        console.error('提取网站域名失败:', e.message);
        return '未知来源';
    }
}

// 检查URL是否在指定日期存在
function checkUrlInDate(targetUrl, dateDir) {
    const result = {
        exists: false,
        filename: null
    };
    
    try {
        // 检查article_urls.json
        const urlsJsonPath = path.join('golf_content', dateDir, 'article_urls.json');
        if (fs.existsSync(urlsJsonPath)) {
            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
            for (const [articleNum, record] of Object.entries(urlMapping)) {
                if (record.url && isSameUrl(record.url, targetUrl)) {
                    result.exists = true;
                    result.filename = `wechat_article_${articleNum}.html`;
                    return result;
                }
            }
        }
        
        // 检查HTML文件
        const htmlDir = path.join('golf_content', dateDir, 'wechat_html');
        if (fs.existsSync(htmlDir)) {
            const htmlFiles = fs.readdirSync(htmlDir)
                .filter(file => file.endsWith('.html'));
            
            for (const file of htmlFiles) {
                const filePath = path.join(htmlDir, file);
                const extractedUrl = extractSourceUrl(filePath);
                
                if (extractedUrl && isSameUrl(extractedUrl, targetUrl)) {
                    result.exists = true;
                    result.filename = file;
                    return result;
                }
            }
        }
    } catch (error) {
        console.error(`检查日期 ${dateDir} 的URL失败:`, error);
    }
    
    return result;
}

// 获取指定日期的所有文章 - 异步版本
async function getArticlesByDate(date) {
    const articles = [];
    const htmlDir = path.join('golf_content', date, 'wechat_html');
    const mdDir = path.join('golf_content', date, 'wechat_ready');
    const historyDB = new UnifiedHistoryDatabase();
    
    try {
        // 检查目录是否存在
        try {
            await fs.promises.access(htmlDir);
        } catch (e) {
            console.log(`目录不存在: ${htmlDir}`);
            return articles;
        }
        
        const htmlFiles = (await fs.promises.readdir(htmlDir))
            .filter(file => file.endsWith('.html'))
            .sort();
        
        // 使用 Promise.all 并行处理所有文件
        const articlePromises = htmlFiles.map(async (file) => {
            const filePath = path.join(htmlDir, file);
            try {
                const stats = await fs.promises.stat(filePath);
                
                // 并行获取所有需要的信息
                const [chineseTitle, sourceUrl] = await Promise.all([
                    extractChineseTitle(filePath),
                    extractSourceUrl(filePath)
                ]);
                
                // 提取AI检测结果
                const mdFileName = file.replace('.html', '.md');
                const mdFilePath = path.join(mdDir, mdFileName);
                const aiDetection = await extractAIDetection(mdFilePath);
                
                // 检查是否重复
                let isDuplicate = false;
                let duplicateInfo = null;
                
                if (sourceUrl) {
                    // 检查URL是否在其他日期已处理
                    const allDates = getAllDates();
                    for (const dateInfo of allDates) {
                        if (dateInfo.date !== date) { // 排除当前日期
                            const checkResult = checkUrlInDate(sourceUrl, dateInfo.date);
                            if (checkResult.exists) {
                                isDuplicate = true;
                                duplicateInfo = {
                                    date: dateInfo.date,
                                    filename: checkResult.filename
                                };
                                break;
                            }
                        }
                    }
                }
                const sourceSite = extractWebsiteDomain(sourceUrl);
                
                return {
                    filename: file,
                    chineseTitle,
                    sourceUrl,
                    sourceSite,
                    createdTime: stats.mtime,
                    articleUrl: `/golf_content/${date}/wechat_html/${file}`,
                    displayTime: new Date(stats.mtime).toLocaleString('zh-CN'),
                    isDuplicate: isDuplicate,
                    duplicateInfo: duplicateInfo,
                    aiDetection: aiDetection
                };
            } catch (e) {
                console.error(`处理文件失败: ${file}`, e.message);
                return null;
            }
        });
        
        // 等待所有文章处理完成
        const results = await Promise.all(articlePromises);
        
        // 过滤掉处理失败的文章
        return results.filter(article => article !== null);
    } catch (e) {
        console.error('获取文章列表失败:', e.message);
        return [];
    }
}

// 删除文章的函数
function deleteArticleFiles(date, filename) {
    const results = {
        deletedFiles: [],
        errors: []
    };
    
    try {
        // 安全检查：验证日期格式
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            throw new Error('无效的日期格式');
        }
        
        // 安全检查：验证文件名（防止路径遍历攻击）
        if (!filename.match(/^[a-zA-Z0-9_\-\.]+\.html$/)) {
            throw new Error('无效的文件名格式');
        }
        
        const baseDir = path.join('golf_content', date);
        const baseName = filename.replace('.html', '');
        
        // 需要删除的文件路径列表
        const filesToDelete = [
            // HTML文件
            path.join(baseDir, 'wechat_html', filename),
            // Markdown文件
            path.join(baseDir, 'wechat_markdown', baseName + '.md'),
            // 可能的图片文件夹
            path.join(baseDir, 'wechat_images', baseName)
        ];
        
        // 删除文件
        for (const filePath of filesToDelete) {
            try {
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        // 删除整个目录
                        fs.rmSync(filePath, { recursive: true, force: true });
                        results.deletedFiles.push(`目录: ${filePath}`);
                    } else {
                        // 删除单个文件
                        fs.unlinkSync(filePath);
                        results.deletedFiles.push(`文件: ${filePath}`);
                    }
                }
            } catch (error) {
                results.errors.push(`删除失败 ${filePath}: ${error.message}`);
            }
        }
        
        // 🆕 新增：清理 article_urls.json 中的记录
        const urlMapFile = path.join('golf_content', date, 'article_urls.json');
        if (fs.existsSync(urlMapFile)) {
            try {
                const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                const articleNum = filename.replace('wechat_article_', '').replace('.html', '');
                
                if (urlMapping[articleNum]) {
                    delete urlMapping[articleNum];
                    fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2), 'utf8');
                    results.deletedFiles.push(`URL映射: article_urls.json 中的编号 ${articleNum}`);
                    console.log(`✅ 已清理 article_urls.json 中的编号 ${articleNum}`);
                }
            } catch (e) {
                results.errors.push(`清理URL映射失败: ${e.message}`);
            }
        }
        
        return results;
        
    } catch (error) {
        results.errors.push(`删除操作失败: ${error.message}`);
        return results;
    }
}

// API: 检查单个URL是否已存在
app.get('/api/check-url', (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: '缺少URL参数'
            });
        }
        
        console.log(`🔍 检查URL: ${url}`);
        
        const result = checkUrlExists(url);
        
        res.json({
            success: true,
            url: url,
            exists: result.exists,
            foundIn: result.foundIn,
            details: result.details
        });
        
    } catch (error) {
        console.error('URL检查API错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

// API: 批量检查多个URL
app.post('/api/check-urls', (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({
                success: false,
                message: '请提供URL数组'
            });
        }
        
        console.log(`🔍 批量检查 ${urls.length} 个URL`);
        
        const results = checkMultipleUrls(urls);
        
        // 统计
        const existingCount = results.filter(r => r.exists).length;
        const newCount = results.length - existingCount;
        
        res.json({
            success: true,
            total: results.length,
            existing: existingCount,
            new: newCount,
            results: results
        });
        
    } catch (error) {
        console.error('批量URL检查API错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

// API: 删除文章
app.delete('/api/articles/:date/:filename', (req, res) => {
    try {
        const { date, filename } = req.params;
        
        console.log(`🗑️ 收到删除请求: ${date}/${filename}`);
        
        // 检查文件是否存在
        const htmlPath = path.join('golf_content', date, 'wechat_html', filename);
        if (!fs.existsSync(htmlPath)) {
            return res.status(404).json({
                success: false,
                message: '文章文件不存在'
            });
        }
        
        // 执行删除操作
        const deleteResults = deleteArticleFiles(date, filename);
        
        if (deleteResults.errors.length > 0) {
            console.error('删除过程中出现错误:', deleteResults.errors);
            return res.status(500).json({
                success: false,
                message: '删除过程中出现错误',
                errors: deleteResults.errors,
                deletedFiles: deleteResults.deletedFiles
            });
        }
        
        console.log(`✅ 删除成功: ${deleteResults.deletedFiles.join(', ')}`);
        
        res.json({
            success: true,
            message: '文章删除成功',
            deletedFiles: deleteResults.deletedFiles
        });
        
    } catch (error) {
        console.error('删除API错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

// 首页 - 显示日期列表
app.get('/', (req, res) => {
    try {
        const dates = getAllDates();
        
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>高尔夫文章管理系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 3rem;
        }
        .header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .stats {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            text-align: center;
            color: white;
        }
        .dates-grid {
            display: grid;
            gap: 1.5rem;
        }
        .date-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
        }
        .date-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .date-main {
            font-size: 1.8rem;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .date-display {
            font-size: 1.1rem;
            color: #667eea;
            margin-bottom: 1rem;
        }
        .article-count {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
        }
        .no-dates {
            text-align: center;
            color: white;
            font-size: 1.2rem;
            margin-top: 3rem;
        }
        .server-info {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255,255,255,0.9);
            padding: 10px;
            border-radius: 5px;
            font-size: 0.8rem;
            color: #666;
        }
        .monitor-btn {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.8rem 1.5rem;
            background: #48bb78;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .monitor-btn:hover {
            background: #38a169;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏌️ 高尔夫文章</h1>
            <p>Golf Article Management System</p>
            <a href="/monitor" class="monitor-btn">📊 系统监控</a>
        </div>
        
        ${dates.length > 0 ? `
        <div class="stats">
            <div>
                共有 <strong>${dates.length}</strong> 个处理日期，
                总计 <strong>${dates.reduce((sum, d) => sum + d.count, 0)}</strong> 篇文章
            </div>
        </div>
        ` : ''}
        
        <div class="dates-grid">
            ${dates.length === 0 ? 
                '<div class="no-dates">📝 暂无文章，请先处理一些文章</div>' : 
                dates.map(date => `
                    <a href="/articles/${date.date}" class="date-card">
                        <div class="date-main">${date.date}</div>
                        <div class="date-display">${date.displayDate}</div>
                        <span class="article-count">📚 ${date.count} 篇文章</span>
                    </a>
                `).join('')
            }
        </div>
    </div>
    
    <div class="server-info">
        服务器运行在端口 ${PORT}
    </div>
</body>
</html>`;
        
        res.send(html);
    } catch (e) {
        console.error('首页渲染失败:', e.message);
        res.status(500).send('服务器错误');
    }
});

// 文章列表页 - 添加删除功能 - 异步版本
app.get('/articles/:date', async (req, res) => {
    try {
        const date = req.params.date;
        const articles = await getArticlesByDate(date);
        
        // 按创建时间降序排序（最新的在前）
        articles.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        // 使用模板系统生成页面内容
        const pageContent = `
            <div class="header">
                <div class="container">
                    <a href="/" class="back-btn">← 返回日期列表</a>
                    <h1>${date}</h1>
                    <p>共 ${articles.length} 篇文章</p>
                </div>
            </div>
            
            <div class="container">
                <div style="text-align: center; margin-bottom: 1.5rem; color: #666;">
                    <span style="font-size: 0.9rem;">📊 文章按创建时间排序（最新在前）</span>
                </div>
                <div class="articles-list">
                    ${articles.length === 0 ? 
                        '<div style="text-align: center; color: #6c757d; margin-top: 3rem;">📝 该日期暂无文章</div>' : 
                        articles.map(article => htmlTemplate.articleItem(article, date)).join('')
                    }
                </div>
            </div>
            
            <!-- 确认删除对话框 -->
            <div id="deleteModal" class="modal">
                <div class="modal-content">
                    <h3>⚠️ 确认删除</h3>
                    <p id="deleteMessage">确定要删除这篇文章吗？</p>
                    <div class="modal-buttons">
                        <button class="modal-btn cancel" onclick="cancelDelete()">取消</button>
                        <button class="modal-btn confirm" onclick="executeDelete()">确认删除</button>
                    </div>
                </div>
            </div>
        `;
        
        // 文章页面特定样式
        const articlePageStyles = `
        body { 
            background: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 0;
            text-align: center;
        }
        .back-btn {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 0.7rem 1.5rem;
            border-radius: 25px;
            text-decoration: none;
            margin-bottom: 1rem;
            transition: all 0.3s ease;
        }
        .back-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        .articles-list {
            display: grid;
            gap: 1.5rem;
            margin-top: 2rem;
        }
        .article-item {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
        }
        .article-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }
        .article-item.deleting {
            opacity: 0.5;
            transform: scale(0.95);
        }
        .article-title {
            font-size: 1.3rem;
            font-weight: bold;
            color: #2c3e50;
            text-decoration: none;
            display: block;
            margin-bottom: 1rem;
            line-height: 1.4;
        }
        .article-title:hover {
            color: #667eea;
        }
        .article-meta {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
            justify-content: space-between;
        }
        .meta-left {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }
        .source-btn {
            background: #28a745;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            text-decoration: none;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }
        .source-btn:hover {
            background: #218838;
        }
        .source-site {
            background: #17a2b8;
            color: white;
            padding: 0.4rem 0.8rem;
            border-radius: 15px;
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .publish-time {
            color: #6c757d;
            font-size: 0.9rem;
        }
        .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        .delete-btn:hover:not(:disabled) {
            background: #c82333;
            transform: scale(1.05);
        }
        .delete-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        
        /* 重复文章样式 */
        .duplicate-article {
            background: #fff8dc;
            border: 2px solid #ffc107;
        }
        .duplicate-badge {
            background: #ffc107;
            color: #333;
            font-size: 0.8rem;
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            margin-left: 0.5rem;
            font-weight: normal;
        }
        .duplicate-warning {
            background: #fff3cd;
            color: #856404;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            margin: 0.5rem 0;
            font-size: 0.9rem;
            border-left: 4px solid #ffc107;
        }
        
        /* 确认对话框样式 */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            animation: fadeIn 0.3s ease;
        }
        .modal-content {
            background-color: white;
            margin: 15% auto;
            padding: 2rem;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            animation: slideIn 0.3s ease;
        }
        .modal h3 {
            color: #dc3545;
            margin-bottom: 1rem;
        }
        .modal p {
            margin-bottom: 1.5rem;
            color: #666;
        }
        .modal-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
        }
        .modal-btn {
            padding: 0.7rem 1.5rem;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }
        .modal-btn.confirm {
            background: #dc3545;
            color: white;
        }
        .modal-btn.confirm:hover {
            background: #c82333;
        }
        .modal-btn.cancel {
            background: #6c757d;
            color: white;
        }
        .modal-btn.cancel:hover {
            background: #5a6268;
        }
        
        /* 通知样式 */
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        }
        .notification.success {
            background: #28a745;
        }
        .notification.error {
            background: #dc3545;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
        
        /* 仅在本地可用模态框样式 */
        .local-only-modal {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 2000;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }
        .local-only-content {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        }
        .local-only-content h2 {
            color: #6c757d;
            margin-bottom: 1rem;
        }
        .local-only-content p {
            color: #868e96;
            margin-bottom: 1.5rem;
        }
        .local-only-content .article-info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            text-align: left;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            color: #495057;
        }
        .local-only-content button {
            background: #007bff;
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .local-only-content button:hover {
            background: #0056b3;
            transform: translateY(-1px);
        }
        `;
        
        // 文章页面的JavaScript
        const articlePageScript = `
    <script>
        let deleteFilename = '';
        
        // 查看文章（处理内容不可用的情况）
        function viewArticle(event, articleUrl, title) {
            event.preventDefault();
            
            // 检查文件是否存在
            fetch(articleUrl, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        // 文件存在，在新窗口打开
                        window.open(articleUrl, '_blank');
                    } else {
                        // 文件不存在，显示友好提示
                        showLocalOnlyMessage(title, articleUrl);
                    }
                })
                .catch(error => {
                    // 网络错误或文件不存在
                    showLocalOnlyMessage(title, articleUrl);
                });
        }
        
        // 显示"仅在本地可用"的提示
        function showLocalOnlyMessage(title, articleUrl) {
            const modal = document.createElement('div');
            modal.className = 'local-only-modal';
            modal.innerHTML = \`
                <div class="local-only-content">
                    <h2>📄 文章内容仅在本地可用</h2>
                    <p>此文章的完整内容仅在本地系统中可用。</p>
                    <div class="article-info">
                        <strong>文章信息：</strong><br>
                        标题: \${title}<br>
                        路径: \${articleUrl}
                    </div>
                    <button onclick="this.closest('.local-only-modal').remove()">关闭</button>
                </div>
            \`;
            document.body.appendChild(modal);
            
            // 点击模态框外部关闭
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
        
        // 显示确认删除对话框
        function confirmDelete(filename, title) {
            deleteFilename = filename;
            document.getElementById('deleteMessage').textContent = 
                \`确定要删除文章《\${title}》吗？此操作不可撤销！\`;
            document.getElementById('deleteModal').style.display = 'block';
        }
        
        // 取消删除
        function cancelDelete() {
            document.getElementById('deleteModal').style.display = 'none';
            deleteFilename = '';
        }
        
        // 执行删除
        async function executeDelete() {
            if (!deleteFilename) return;
            
            // 关闭对话框
            document.getElementById('deleteModal').style.display = 'none';
            
            // 找到对应的文章项并添加删除动画
            const articleItem = document.querySelector(\`[data-filename="\${deleteFilename}"]\`);
            if (articleItem) {
                articleItem.classList.add('deleting');
            }
            
            // 禁用删除按钮
            const deleteBtn = articleItem?.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.textContent = '删除中...';
            }
            
            try {
                const response = await fetch(\`/api/articles/${date}/\${deleteFilename}\`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // 删除成功
                    showNotification('文章删除成功！', 'success');
                    
                    // 动画移除元素
                    if (articleItem) {
                        setTimeout(() => {
                            articleItem.style.height = articleItem.offsetHeight + 'px';
                            articleItem.style.transition = 'all 0.3s ease';
                            setTimeout(() => {
                                articleItem.style.height = '0';
                                articleItem.style.opacity = '0';
                                articleItem.style.marginBottom = '0';
                                articleItem.style.padding = '0';
                            }, 50);
                            setTimeout(() => {
                                articleItem.remove();
                                
                                // 检查是否还有文章
                                const remaining = document.querySelectorAll('.article-item').length;
                                if (remaining === 0) {
                                    location.reload(); // 刷新页面显示"暂无文章"
                                }
                            }, 350);
                        }, 500);
                    }
                } else {
                    // 删除失败
                    showNotification(\`删除失败: \${result.message}\`, 'error');
                    
                    // 恢复按钮状态
                    if (articleItem) {
                        articleItem.classList.remove('deleting');
                    }
                    if (deleteBtn) {
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = '🗑️ 删除';
                    }
                }
            } catch (error) {
                console.error('删除请求失败:', error);
                showNotification('删除请求失败，请检查网络连接', 'error');
                
                // 恢复按钮状态
                if (articleItem) {
                    articleItem.classList.remove('deleting');
                }
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '🗑️ 删除';
                }
            }
            
            deleteFilename = '';
        }
        
        // 显示通知
        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        
        // 点击模态框外部关闭
        window.onclick = function(event) {
            const modal = document.getElementById('deleteModal');
            if (event.target === modal) {
                cancelDelete();
            }
        }
    </script>
        `;
        
        // 使用模板系统生成完整HTML
        const html = htmlTemplate.page(
            `${date} - 文章列表`,
            pageContent,
            articlePageStyles,
            articlePageScript
        );
        
        res.send(html);
    } catch (e) {
        console.error('文章列表页渲染失败:', e.message);
        res.status(500).send('服务器错误');
    }
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).send('服务器内部错误');
});

// 启动服务器 - 增强版本，添加更好的错误处理和调试信息
async function startServer() {
    try {
        console.log(`🔍 正在检查端口 ${PORT} 的可用性...`);
        
        // 检查并找到可用端口
        const originalPort = PORT;
        
        if (FORCE_PORT) {
            // 强制使用指定端口
            console.log(`⚡ 强制使用端口 ${PORT}`);
            const isAvailable = await checkPort(PORT);
            if (!isAvailable) {
                console.log(`⚠️  警告：端口 ${PORT} 可能被占用，但仍将尝试绑定`);
            }
        } else {
            // 自动查找可用端口
            PORT = await findAvailablePort(PORT);
            if (PORT !== originalPort) {
                console.log(`⚠️  端口 ${originalPort} 不可用，已切换到端口 ${PORT}`);
            }
        }
        
        // 创建服务器实例并添加错误处理
        const server = app.listen(PORT, '127.0.0.1', () => {
            console.log(`🚀 高尔夫文章Web服务器已启动`);
            console.log(`📖 访问地址: http://localhost:${PORT}`);
            console.log(`📋 首页显示日期列表，点击日期查看文章`);
            console.log(`🗑️ 已添加文章删除功能`);
            console.log(`🔍 已添加URL重复检查功能`);
            console.log(`📡 API端点: /api/check-url?url=xxx 和 /api/check-urls`);
            
            try {
                const dates = getAllDates();
                console.log(`📊 当前共有 ${dates.length} 个日期，${dates.reduce((sum, d) => sum + d.count, 0)} 篇文章`);
            } catch (e) {
                console.log(`📊 统计文章数量时出错: ${e.message}`);
            }
            
            console.log(`✅ 服务器成功绑定到 localhost:${PORT}`);
        });
        
        // 添加服务器错误处理
        server.on('error', (error) => {
            console.error('❌ 服务器启动错误:', error.message);
            if (error.code === 'EADDRINUSE') {
                if (FORCE_PORT) {
                    console.error(`❌ 端口 ${PORT} 被占用，无法启动服务器`);
                    console.log('💡 解决方案：');
                    console.log(`   1. 运行 lsof -ti:${PORT} 查看占用端口的进程`);
                    console.log(`   2. 运行 kill -9 <进程ID> 终止占用的进程`);
                    console.log(`   3. 或者设置环境变量使用其他端口：PORT=3000 node web_server.js`);
                    process.exit(1);
                } else {
                    console.log(`端口 ${PORT} 已被占用，正在尝试其他端口...`);
                    startServer(); // 递归尝试其他端口
                }
            } else {
                process.exit(1);
            }
        });
        
        // 添加服务器关闭处理
        server.on('close', () => {
            console.log('📴 服务器已关闭');
        });
        
    } catch (error) {
        console.error('❌ 启动服务器失败:', error.message);
        console.log('💡 建议检查:');
        console.log('   1. 端口是否被其他程序占用');
        console.log('   2. 文件权限是否正确'); 
        console.log('   3. 手动指定端口：PORT=3000 node web_server.js');
        process.exit(1);
    }
}

// 停止所有处理进程API - 智能清理系统
app.post('/api/stop-all-processes', async (req, res) => {
    try {
        // 1. 获取并分析所有进程
        let stdout = '';
        try {
            const result = await execAsync(`
                ps aux | grep -E "node.*(batch|intelligent|scrape|auto_scrape|discover|process)" | 
                grep -v grep | grep -v web_server || true
            `);
            stdout = result.stdout || '';
        } catch (err) {
            // grep没有找到匹配项时会返回错误，这是正常的
            stdout = '';
        }
        
        const processes = [];
        const lines = stdout.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length < 11) continue;
            
            const pid = parts[1];
            const cpu = parseFloat(parts[2]);
            const mem = parseFloat(parts[3]);
            const time = parts[9];
            const command = parts.slice(10).join(' ');
            
            // 解析运行时间
            const timeParts = time.split(':');
            let hours = 0, minutes = 0;
            if (timeParts.length === 3) {
                hours = parseInt(timeParts[0]) || 0;
                minutes = parseInt(timeParts[1]) || 0;
            } else if (timeParts.length === 2) {
                minutes = parseInt(timeParts[0]) || 0;
            }
            
            const totalMinutes = hours * 60 + minutes;
            
            processes.push({
                pid,
                cpu,
                mem,
                time,
                totalMinutes,
                command,
                isLongRunning: totalMinutes > 720, // 超过12小时
                isHighCPU: cpu > 90,
                isStuck: cpu < 0.1 && totalMinutes > 60 // CPU很低但运行超过1小时
            });
        }
        
        // 2. 智能停止进程
        const results = {
            stopped: [],
            failed: [],
            analysis: {
                longRunning: 0,
                highCPU: 0,
                stuck: 0,
                normal: 0
            }
        };
        
        for (const proc of processes) {
            try {
                await execAsync(`kill ${proc.pid}`);
                results.stopped.push(proc);
                
                // 统计分析
                if (proc.isLongRunning) results.analysis.longRunning++;
                else if (proc.isHighCPU) results.analysis.highCPU++;
                else if (proc.isStuck) results.analysis.stuck++;
                else results.analysis.normal++;
                
            } catch (err) {
                results.failed.push({ ...proc, error: err.message });
            }
        }
        
        // 3. 清理临时文件
        await execAsync('rm -f temp_batch_*.txt temp_urls_*.txt').catch(() => {});
        
        // 4. 创建今天的目录结构
        const today = new Date().toISOString().split('T')[0];
        await execAsync(`mkdir -p golf_content/${today}/{original,wechat_ready,images,failed_articles}`);
        
        // 5. 记录操作日志
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: 'stop_all_processes',
            results: results
        };
        
        console.log('停止进程操作:', JSON.stringify(logEntry, null, 2));
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            stoppedCount: results.stopped.length,
            failedCount: results.failed.length,
            analysis: results.analysis,
            processes: results.stopped,
            todayDir: `golf_content/${today}`,
            message: `成功停止 ${results.stopped.length} 个进程，清理完成`
        });
        
    } catch (error) {
        console.error('停止进程失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 重启处理器API - 重新抓取URL并处理（异步执行）
app.post('/api/restart-processor', async (req, res) => {
    const { spawn } = require('child_process');
    
    // 立即返回响应，避免页面阻塞
    res.json({ 
        success: true, 
        message: '处理器重启已开始，正在后台执行...' 
    });
    
    // 异步执行重启流程
    (async () => {
        try {
            // 1. 先停止现有的处理进程
            console.log('停止现有处理进程...');
            const killCmd = spawn('bash', ['-c', 
                "ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup|auto_scrape)' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true"
            ]);
            
            await new Promise((resolve) => {
                killCmd.on('close', resolve);
            });
            
            // 等待3秒确保进程完全停止
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 2. 重新生成URL（后台执行）
            console.log('重新抓取6个网站的URL...');
            const generateUrls = spawn('node', ['auto_scrape_three_sites.js', '--all-sites'], {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            generateUrls.stdout.on('data', (data) => {
                console.log('URL生成:', data.toString());
            });
            
            generateUrls.stderr.on('data', (data) => {
                console.error('URL生成错误:', data.toString());
            });
            
            generateUrls.on('close', (code) => {
                if (code === 0) {
                    console.log('URL生成完成');
                    
                    // 3. URL生成完成后，启动智能并发控制器
                    setTimeout(() => {
                        console.log('启动智能控制器处理新URL...');
                        const controller = spawn('node', ['intelligent_concurrent_controller.js'], {
                            detached: true,
                            stdio: ['ignore', 'pipe', 'pipe']
                        });
                        
                        // 将输出重定向到日志文件
                        const fs = require('fs');
                        const logStream = fs.createWriteStream('intelligent_controller.log', { flags: 'a' });
                        controller.stdout.pipe(logStream);
                        controller.stderr.pipe(logStream);
                        
                        controller.unref();
                        console.log('智能控制器已启动');
                    }, 2000);
                } else {
                    console.error('URL生成失败，退出码:', code);
                }
            });
            
            generateUrls.unref();
            
        } catch (error) {
            console.error('重启处理器失败:', error);
        }
    })();
});

// 检测新URL并处理
app.post('/api/check-and-process-urls', async (req, res) => {
    const { spawn } = require('child_process');
    
    try {
        // 先生成新的URL
        console.log('开始生成新URL...');
        const generateUrls = spawn('node', ['auto_scrape_three_sites.js', '--all-sites']);
        
        let output = '';
        generateUrls.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        generateUrls.stderr.on('data', (data) => {
            console.error('URL生成错误:', data.toString());
        });
        
        await new Promise((resolve, reject) => {
            generateUrls.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('URL生成失败'));
                }
            });
        });
        
        // 统计新URL数量
        const urlFiles = [
            'deep_urls_golf_com.txt',
            'deep_urls_golfmonthly_com.txt',
            'deep_urls_mygolfspy_com.txt',
            'deep_urls_www_golfwrx_com.txt',
            'deep_urls_www_golfdigest_com.txt',
            'deep_urls_todays_golfer_com.txt',
            'deep_urls_golfweek_usatoday_com.txt',
            'deep_urls_nationalclubgolfer_com.txt',
            'deep_urls_www_pgatour_com.txt',
            'deep_urls_skysports_com.txt',
            'deep_urls_golfmagic_com.txt',
            'deep_urls_yardbarker_com.txt',
            'deep_urls_golf_net_cn.txt',
            'deep_urls_si_com.txt',
            'deep_urls_yahoo_golf.txt',
            'deep_urls_espn_golf.txt',
            'deep_urls_lpga_com.txt',
            'deep_urls_cbssports_golf.txt'
        ];
        
        let totalUrls = 0;
        const urlStats = {};
        
        for (const file of urlFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const urls = content.split('\n').filter(line => line.startsWith('https://'));
                urlStats[file] = urls.length;
                totalUrls += urls.length;
            }
        }
        
        if (totalUrls > 0) {
            // 启动处理器
            console.log(`检测到 ${totalUrls} 个新URL，开始处理...`);
            const processor = spawn('nohup', ['node', 'intelligent_concurrent_controller.js'], {
                detached: true,
                stdio: 'ignore'
            });
            processor.unref();
            
            res.json({ 
                success: true, 
                message: `检测到 ${totalUrls} 个新URL，已开始处理`,
                urlStats: urlStats,
                totalUrls: totalUrls
            });
        } else {
            res.json({ 
                success: true, 
                message: '没有检测到新的URL',
                urlStats: urlStats,
                totalUrls: 0
            });
        }
        
    } catch (error) {
        console.error('检测和处理URL失败:', error);
        res.status(500).json({ success: false, message: '操作失败: ' + error.message });
    }
});

// 系统状态收集函数 - 优化版：实时准确统计
async function collectSystemStatus(skipCache = false) {
    const status = {
        timestamp: new Date().toISOString(),
        running: true,
        processCount: 0,
        todayArticles: 0,
        lastProcessTime: null,
        processingStatus: [],
        siteStats: {},
        services: {
            webServer: true,  // web服务器肯定在运行
            controller: false,
            batchProcessor: false
        },
        latestLogs: '',
        urlStats: {},
        urlGenerationRunning: false,
        accuracyInfo: {
            cacheSkipped: skipCache,
            realTimeCount: true,
            lastUpdate: new Date().toISOString()
        }
    };

    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0];
    const todayPath = path.join(__dirname, 'golf_content', today, 'wechat_ready');
    
    // 初始化处理统计
    status.processingStats = {
        urlTotal: 0,           // URL抓取总数
        articlesToday: 0,      // 今日成功改写文章
        processed: 0,          // 已处理URL数（成功+失败）
        success: 0,            // 成功处理数
        failed: 0,             // 失败数
        skipped: 0,            // 重复跳过数
        pending: 0,            // 真正待处理数
        successRate: 0,        // 成功率
        skipRate: 0,           // 跳过率
        failureRate: 0,        // 失败率
        lastUpdate: new Date().toISOString()
    };

    // 1. 获取运行的进程
    try {
        const { stdout } = await execAsync('ps aux | grep -E "node.*(web_server|intelligent|batch|resilient|auto_scrape|discover)" | grep -v grep');
        const processes = stdout.trim().split('\n').filter(line => line);
        status.processCount = processes.length;

        // 检查各服务状态
        processes.forEach(line => {
            if (line.includes('intelligent_concurrent_controller.js')) status.services.controller = true;
            if (line.includes('batch_process_articles.js')) status.services.batchProcessor = true;
            if (line.includes('auto_scrape_three_sites.js') || 
                line.includes('discover_') ||
                line.includes('url_generator')) {
                status.urlGenerationRunning = true;
            }
        });
    } catch (e) {
        // 没有进程运行
    }

    // 2. 获取今日文章数和网站统计
    try {
        const files = await fs.promises.readdir(todayPath);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        status.todayArticles = mdFiles.length;

        // 统计各网站文章数
        const sites = {
            'Golf.com': 0,
            'Golf Monthly': 0,
            'MyGolfSpy': 0,
            'GolfWRX': 0,
            'Golf Digest': 0,
            "Today's Golfer": 0,
            'Golfweek': 0,
            'National Club Golfer': 0,
            'PGA Tour': 0,
            'Sky Sports Golf': 0,
            'Golf Magic': 0,
            'Yardbarker': 0,
            '中国高尔夫网': 0,
            'SI Golf': 0,
            'Yahoo Golf': 0,
            'ESPN Golf': 0,
            'LPGA': 0,
            'CBS Sports Golf': 0
        };

        // AI检测统计
        let aiStats = {
            total: 0,
            detected: 0,
            avgProbability: 0,
            highRisk: 0,  // >= 80%
            mediumRisk: 0, // 50-79%
            lowRisk: 0     // < 50%
        };
        let totalProbability = 0;

        for (const file of mdFiles) {
            try {
                const content = await fs.promises.readFile(path.join(todayPath, file), 'utf8');
                const urlMatch = content.match(/\[查看原文\]\((.*?)\)|原文链接：\[.*?\]\((.*?)\)/);
                if (urlMatch) {
                    const url = urlMatch[1] || urlMatch[2];
                    if (url.includes('golf.com')) sites['Golf.com']++;
                    else if (url.includes('golfmonthly.com')) sites['Golf Monthly']++;
                    else if (url.includes('mygolfspy.com')) sites['MyGolfSpy']++;
                    else if (url.includes('golfwrx.com')) sites['GolfWRX']++;
                    else if (url.includes('golfdigest.com')) sites['Golf Digest']++;
                    else if (url.includes('todays-golfer.com')) sites["Today's Golfer"]++;
                    else if (url.includes('golfweek')) sites['Golfweek']++;
                    else if (url.includes('nationalclubgolfer.com')) sites['National Club Golfer']++;
                    else if (url.includes('pgatour.com')) sites['PGA Tour']++;
                    else if (url.includes('skysports.com')) sites['Sky Sports Golf']++;
                    else if (url.includes('golfmagic.com')) sites['Golf Magic']++;
                    else if (url.includes('yardbarker.com')) sites['Yardbarker']++;
                    else if (url.includes('golf.net.cn')) sites['中国高尔夫网']++;
                    else if (url.includes('si.com') && url.includes('golf')) sites['SI Golf']++;
                    else if (url.includes('sports.yahoo.com') && url.includes('golf')) sites['Yahoo Golf']++;
                    else if (url.includes('espn.com') && url.includes('golf')) sites['ESPN Golf']++;
                    else if (url.includes('lpga.com')) sites['LPGA']++;
                    else if (url.includes('cbssports.com') && url.includes('golf')) sites['CBS Sports Golf']++;
                }
                
                // 提取AI检测信息
                const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
                if (metadataMatch) {
                    const metadata = metadataMatch[1];
                    const aiMatch = metadata.match(/ai_detection:\s*"?(\d+(?:\.\d+)?%?)"?/);
                    
                    if (aiMatch) {
                        const probability = parseFloat(aiMatch[1]);
                        aiStats.total++;
                        aiStats.detected++;
                        totalProbability += probability;
                        
                        if (probability >= 80) {
                            aiStats.highRisk++;
                        } else if (probability >= 50) {
                            aiStats.mediumRisk++;
                        } else {
                            aiStats.lowRisk++;
                        }
                    } else {
                        aiStats.total++;
                    }
                } else {
                    aiStats.total++;
                }
            } catch (e) {}
        }
        
        // 计算平均AI概率
        if (aiStats.detected > 0) {
            aiStats.avgProbability = (totalProbability / aiStats.detected).toFixed(1);
        }
        
        status.siteStats = sites;
        status.aiStats = aiStats;

        // 获取代理统计信息
        try {
            const proxyStatusPath = path.join(__dirname, 'proxy_status.json');
            if (fs.existsSync(proxyStatusPath)) {
                const proxyData = JSON.parse(fs.readFileSync(proxyStatusPath, 'utf8'));
                const now = new Date();
                const todayKey = now.toISOString().split('T')[0];
                
                let totalProxies = 0;
                let healthyProxies = 0;
                let totalQuotaToday = 0;
                let usedQuotaToday = 0;
                let proxyDetails = [];
                
                for (const [proxyUrl, info] of Object.entries(proxyData.proxies || {})) {
                    totalProxies++;
                    if (info.isHealthy) healthyProxies++;
                    
                    const dailyLimit = info.limits?.daily || 200;
                    const todayUsage = info.dailyUsage?.[todayKey] || 0;
                    
                    totalQuotaToday += dailyLimit;
                    usedQuotaToday += todayUsage;
                    
                    proxyDetails.push({
                        name: proxyUrl.split('@').pop().split(':')[0],
                        dailyLimit: dailyLimit,
                        usedToday: todayUsage,
                        isHealthy: info.isHealthy,
                        successRate: info.stats ? 
                            ((info.stats.success / (info.stats.total || 1)) * 100).toFixed(1) : '0'
                    });
                }
                
                status.proxyStats = {
                    totalProxies,
                    healthyProxies,
                    totalQuotaToday,
                    usedQuotaToday,
                    remainingQuotaToday: totalQuotaToday - usedQuotaToday,
                    proxyDetails: proxyDetails.sort((a, b) => b.successRate - a.successRate)
                };
            } else {
                status.proxyStats = {
                    totalProxies: 0,
                    healthyProxies: 0,
                    message: "代理状态文件不存在"
                };
            }
        } catch (e) {
            console.error('读取代理状态失败:', e);
            status.proxyStats = {
                totalProxies: 0,
                healthyProxies: 0,
                error: e.message
            };
        }

        // 获取最新文章时间
        if (mdFiles.length > 0) {
            let latestTime = 0;
            for (const file of mdFiles) {
                const stats = await fs.promises.stat(path.join(todayPath, file));
                if (stats.mtimeMs > latestTime) {
                    latestTime = stats.mtimeMs;
                }
            }
            if (latestTime > 0) {
                const modTime = new Date(latestTime);
                const now = new Date();
                const diffMinutes = Math.floor((now - modTime) / 1000 / 60);
                
                if (diffMinutes < 1) {
                    status.lastProcessTime = '刚刚';
                } else if (diffMinutes < 60) {
                    status.lastProcessTime = `${diffMinutes}分钟前`;
                } else {
                    const diffHours = Math.floor(diffMinutes / 60);
                    status.lastProcessTime = `${diffHours}小时前`;
                }
            }
        }
    } catch (e) {
        // 目录不存在
    }

    // 3. 获取URL统计和处理队列状态 - 增强版
    const urlFiles = [
        { file: 'deep_urls_golf_com.txt', name: 'Golf.com' },
        { file: 'deep_urls_golfmonthly_com.txt', name: 'Golf Monthly' },
        { file: 'deep_urls_mygolfspy_com.txt', name: 'MyGolfSpy' },
        { file: 'deep_urls_www_golfwrx_com.txt', name: 'GolfWRX' },
        { file: 'deep_urls_www_golfdigest_com.txt', name: 'Golf Digest' },
        { file: 'deep_urls_todays_golfer_com.txt', name: "Today's Golfer" },
        { file: 'deep_urls_golfweek_usatoday_com.txt', name: 'Golfweek' },
        { file: 'deep_urls_nationalclubgolfer_com.txt', name: 'National Club Golfer' },
        { file: 'deep_urls_www_pgatour_com.txt', name: 'PGA Tour' },
        { file: 'deep_urls_skysports_com.txt', name: 'Sky Sports Golf' },
        { file: 'deep_urls_golfmagic_com.txt', name: 'Golf Magic' },
        { file: 'deep_urls_yardbarker_com.txt', name: 'Yardbarker' },
        { file: 'deep_urls_golf_net_cn.txt', name: '中国高尔夫网' },
        { file: 'deep_urls_si_com.txt', name: 'SI Golf' },
        { file: 'deep_urls_yahoo_golf.txt', name: 'Yahoo Golf' },
        { file: 'deep_urls_espn_golf.txt', name: 'ESPN Golf' },
        { file: 'deep_urls_lpga_com.txt', name: 'LPGA' },
        { file: 'deep_urls_cbssports_golf.txt', name: 'CBS Sports Golf' }
    ];

    // 初始化增强的网站状态数据
    status.websiteStatus = {};
    const historyDB = new UnifiedHistoryDatabase();
    let totalPendingUrls = 0;
    let totalProcessedUrls = 0;
    let totalUrlsCount = 0;
    const urlDebugInfo = [];

    for (const { file, name } of urlFiles) {
        const websiteData = {
            name: name,
            urlFile: file,
            totalUrls: 0,
            pendingUrls: 0,
            processedUrls: 0,
            articlesToday: status.siteStats[name] || 0,
            status: 'unknown',
            statusText: '未知',
            statusColor: '#95a5a6'
        };

        try {
            const content = await fs.promises.readFile(path.join(__dirname, file), 'utf8');
            const urls = content.trim().split('\n').filter(line => line.startsWith('http'));
            websiteData.totalUrls = urls.length;
            
            // 初始化详细统计
            websiteData.detailStats = {
                processed: 0,    // 已处理总数
                success: 0,      // 成功数
                skipped: 0,      // 重复跳过数
                failed: 0,       // 失败数
                pending: websiteData.pendingUrls || 0
            };
            
            if (urls.length === 0) {
                websiteData.status = 'no-urls';
                websiteData.statusText = '暂无URL';
                websiteData.statusIcon = '📭';
                websiteData.statusColor = '#7f8c8d';
            } else {
                // 批量检查URL是否已处理
                const checkResult = historyDB.batchCheckUrls(urls);
                
                // 优先从状态文件读取处理状态
                try {
                    const statusData = JSON.parse(await fs.promises.readFile('processing_status.json', 'utf8'));
                    
                    if (statusData.urlStatus && statusData.urlStatus[file]) {
                        const urlStatuses = statusData.urlStatus[file];
                        websiteData.processedUrls = Object.keys(urlStatuses).filter(url => 
                            urlStatuses[url].status === 'processed'
                        ).length;
                    } else {
                        // 回退到原来的方式
                        websiteData.processedUrls = checkResult.statistics.duplicate;
                    }
                } catch (e) {
                    // 如果读取失败，使用原来的方式
                    websiteData.processedUrls = checkResult.statistics.duplicate;
                }
                websiteData.pendingUrls = checkResult.statistics.new;
                totalPendingUrls += websiteData.pendingUrls;
                
                // 更新详细统计
                websiteData.detailStats.pending = websiteData.pendingUrls;
                websiteData.detailStats.processed = websiteData.processedUrls;
                
                // 从全局统计推算网站级别的详细数据
                if (status.processingStats && websiteData.processedUrls > 0) {
                    // 按比例分配成功、跳过和失败数
                    const processedRatio = websiteData.processedUrls / (status.processingStats.processed || 1);
                    websiteData.detailStats.success = Math.round((status.processingStats.success || 0) * processedRatio * 0.3);
                    websiteData.detailStats.skipped = websiteData.processedUrls - websiteData.detailStats.success;
                    websiteData.detailStats.failed = 0;
                }
                
                // 判断网站状态
                if (websiteData.totalUrls > 0 && websiteData.pendingUrls === 0) {
                    // 所有URL都已处理
                    if (websiteData.detailStats.failed > 0) {
                        websiteData.status = 'completed-with-errors';
                        websiteData.statusText = '部分失败';
                        websiteData.statusIcon = '⚠️';
                        websiteData.statusColor = '#f39c12';
                    } else {
                        websiteData.status = 'completed';
                        websiteData.statusText = '已完成';
                        websiteData.statusIcon = '✅';
                        websiteData.statusColor = '#2ecc71';
                    }
                } else if (websiteData.pendingUrls > 0) {
                    // 检查是否正在处理中
                    let isProcessing = false;
                    if (status.processingInfo && status.processingInfo.processing) {
                        Object.keys(status.processingInfo.processing).forEach(fileKey => {
                            if (fileKey === file && status.processingInfo.processing[fileKey].status === 'processing') {
                                isProcessing = true;
                            }
                        });
                    }
                    
                    if (isProcessing) {
                        websiteData.status = 'processing';
                        websiteData.statusText = '正在处理';
                        websiteData.statusIcon = '🏠';
                        websiteData.statusColor = '#3498db';
                    } else {
                        websiteData.status = 'pending';
                        websiteData.statusText = '待处理';
                        websiteData.statusIcon = '📋';
                        websiteData.statusColor = '#f39c12';
                    }
                }
            }
            
            status.urlStats[name] = websiteData.totalUrls;
        } catch (e) {
            websiteData.status = 'no-file';
            websiteData.statusText = '未生成URL';
            websiteData.statusColor = '#e74c3c';
            status.urlStats[name] = 0;
        }
        
        status.websiteStatus[name] = websiteData;
        
        // 累计统计
        totalUrlsCount += websiteData.totalUrls;
        totalProcessedUrls += websiteData.processedUrls || 0;
        
        // 调试日志 - 增强版
        if (websiteData.totalUrls > 0 || skipCache) {
            const debugMsg = `[监控统计] ${name}: 总计=${websiteData.totalUrls}, 已处理=${websiteData.processedUrls}, 待处理=${websiteData.pendingUrls}, 状态=${websiteData.status}`;
            console.log(debugMsg);
            urlDebugInfo.push(debugMsg);
        }
    }
    
    // 实时统计汇总信息
    if (skipCache || totalPendingUrls > 0) {
        console.log(`\n📊 [实时统计汇总]`);
        console.log(`总URL数: ${totalUrlsCount}`);
        console.log(`已处理: ${totalProcessedUrls}`);
        console.log(`待处理: ${totalPendingUrls}`);
        console.log(`处理率: ${totalUrlsCount > 0 ? ((totalProcessedUrls / totalUrlsCount) * 100).toFixed(1) : 0}%`);
        console.log(`数据源: ${skipCache ? '实时计算' : '缓存数据'}\n`);
    }

    // 计算智能预估时间
    const calculateSmartETA = (websiteName, pendingCount) => {
        const speedKey = `speed_${websiteName}`;
        const history = statusCache.history.get(speedKey) || { total: 0, count: 0 };
        
        // 默认时间（秒/篇）
        const defaultTimes = {
            'Golf.com': 35,
            'Golf Monthly': 30,
            'MyGolfSpy': 40,
            'GolfWRX': 45,
            'Golf Digest': 50,
            'LPGA': 35,
            'ESPN Golf': 40,
            'Yahoo Golf': 45,
            '中国高尔夫网': 25,
            'Today\'s Golfer': 40,
            'Golfweek': 35,
            'National Club Golfer': 35,
            'PGA Tour': 40,
            'Sky Sports Golf': 35,
            'Golf Magic': 35,
            'Yardbarker': 30,
            'SI Golf': 40
        };
        
        const baseTime = defaultTimes[websiteName] || 45;
        const avgTime = history.count > 0 ? history.total / history.count : baseTime;
        
        // 考虑并发因素
        const concurrency = status.processingInfo?.currentConcurrency || 1;
        const effectiveTime = avgTime / Math.sqrt(concurrency);
        
        return {
            seconds: Math.ceil(pendingCount * effectiveTime),
            perArticle: Math.ceil(effectiveTime)
        };
    };

    // 时间格式化函数
    function formatTimeRemaining(seconds) {
        if (seconds < 60) return `${seconds}秒`;
        if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.ceil((seconds % 3600) / 60);
        return `${hours}小时${minutes}分钟`;
    }

    // 替换原来的简单计算
    status.estimatedTime = {
        totalPending: totalPendingUrls,
        estimatedMinutes: 0,
        estimatedTimeText: '',
        breakdown: {}
    };

    let totalEstimatedSeconds = 0;
    for (const [name, data] of Object.entries(status.websiteStatus)) {
        if (data.pendingUrls > 0) {
            const eta = calculateSmartETA(name, data.pendingUrls);
            status.estimatedTime.breakdown[name] = eta;
            totalEstimatedSeconds += eta.seconds;
        }
    }

    status.estimatedTime.estimatedMinutes = Math.ceil(totalEstimatedSeconds / 60);
    status.estimatedTime.estimatedTimeText = totalPendingUrls > 0 
        ? formatTimeRemaining(totalEstimatedSeconds)
        : '全部完成';
    
    // 添加准确性统计信息
    status.accuracyInfo.totalUrls = totalUrlsCount;
    status.accuracyInfo.processedUrls = totalProcessedUrls;
    status.accuracyInfo.pendingUrls = totalPendingUrls;
    status.accuracyInfo.processingRate = totalUrlsCount > 0 ? ((totalProcessedUrls / totalUrlsCount) * 100).toFixed(1) + '%' : '0%';
    status.accuracyInfo.debugInfo = urlDebugInfo;
    
    // 更新处理统计汇总
    status.processingStats.urlTotal = totalUrlsCount;
    status.processingStats.articlesToday = status.todayArticles;
    status.processingStats.pending = Math.max(0, totalUrlsCount - totalProcessedUrls - status.processingStats.skipped);
    
    // 计算成功率、跳过率、失败率
    if (totalUrlsCount > 0) {
        status.processingStats.successRate = (status.processingStats.success / totalUrlsCount * 100).toFixed(1);
        status.processingStats.skipRate = (status.processingStats.skipped / totalUrlsCount * 100).toFixed(1); 
        status.processingStats.failureRate = (status.processingStats.failed / totalUrlsCount * 100).toFixed(1);
    }
    
    // 读取失败文章列表获取更准确的失败统计
    try {
        const failedFilePath = path.join(__dirname, 'failed_articles.json');
        if (await fileHelpers.fileExists(failedFilePath)) {
            const failedData = JSON.parse(await fileHelpers.readFileSafe(failedFilePath, '{}'));
            let pendingRetryCount = 0;
            Object.values(failedData).forEach(item => {
                if (item.status === 'pending_retry') pendingRetryCount++;
            });
            if (pendingRetryCount > 0) {
                status.processingStats.failed = pendingRetryCount;
            }
        }
    } catch (e) {}

    // 4. 获取处理进度 - 增强版从状态文件读取
    try {
        // 尝试读取处理状态文件
        const statusFilePath = path.join(__dirname, 'processing_status.json');
        if (await fileHelpers.fileExists(statusFilePath)) {
            const processingStatusData = JSON.parse(await fileHelpers.readFileSafe(statusFilePath, '{}'));
            
            // 更新正在处理的网站状态
            if (processingStatusData.processing) {
                Object.entries(processingStatusData.processing).forEach(([file, procStatus]) => {
                    const websiteName = urlFiles.find(u => u.file === file)?.name || file;
                    if (status.websiteStatus[websiteName] && procStatus.status === 'processing') {
                        status.websiteStatus[websiteName].status = 'processing';
                        status.websiteStatus[websiteName].statusText = `处理中 (${procStatus.processedUrls}/${procStatus.totalUrls})`;
                        status.websiteStatus[websiteName].statusIcon = '🏠';
                        status.websiteStatus[websiteName].statusColor = '#3498db';
                    }
                });
            }
            
            // 添加处理进度信息
            if (processingStatusData.running && processingStatusData.stats) {
                status.processingInfo = {
                    running: true,
                    currentConcurrency: processingStatusData.currentConcurrency || 0,
                    maxConcurrency: processingStatusData.maxConcurrency || 2,
                    stats: processingStatusData.stats,
                    dedupStats: processingStatusData.dedupStats,
                    processing: processingStatusData.processing || {}
                };
                
                // 更新处理统计
                if (processingStatusData.stats) {
                    status.processingStats.processed = processingStatusData.stats.processed || 0;
                    status.processingStats.success = processingStatusData.stats.success || 0;
                    status.processingStats.failed = processingStatusData.stats.failed || 0;
                }
                
                if (processingStatusData.dedupStats) {
                    status.processingStats.skipped = processingStatusData.dedupStats.skipped || 0;
                }
            }
        }
    } catch (e) {
        // 如果读取状态文件失败，回退到原始方法
        if (status.services.controller || status.services.batchProcessor) {
            try {
                // 获取智能控制器日志以确定正在处理的网站
                const { stdout: logContent } = await execAsync('tail -100 intelligent_controller.log 2>/dev/null | grep -E "启动处理|完成处理" | tail -20');
                const lines = logContent.trim().split('\n').filter(line => line);
                
                let processingFiles = [];
                for (const line of lines) {
                    if (line.includes('启动处理:')) {
                        const match = line.match(/启动处理: (deep_urls_.*?\.txt)/);
                        if (match) processingFiles.push(match[1]);
                    } else if (line.includes('完成处理:')) {
                        const match = line.match(/完成处理: (deep_urls_.*?\.txt)/);
                        if (match) processingFiles = processingFiles.filter(f => f !== match[1]);
                    }
                }
                
                // 显示正在处理的网站进度
                for (const file of processingFiles) {
                    const siteName = urlFiles.find(u => u.file === file)?.name || file;
                    const totalUrls = status.urlStats[siteName] || 0;
                    
                    status.processingStatus.push({
                        name: siteName,
                        total: totalUrls,
                        processed: 0,
                        current: '正在处理...'
                    });
                }
            } catch (e) {}
        }
    }

    // 5. 获取最新日志 - 结构化日志收集
    try {
        const logs = {
            controller: [],
            urlGen: [],
            errors: [],
            success: [],
            rewrite: [],      // 新增：改写日志
            aiDetection: []   // 新增：AI检测日志
        };
        
        // 辅助函数：提取时间戳
        function extractTime(logLine) {
            const match = logLine.match(/\[(\d{2}:\d{2}:\d{2})\]/);
            return match ? match[1] : '';
        }
        
        // 提取进度百分比
        function extractProgress(logLine) {
            const match = logLine.match(/进度:\s*(\d+\.?\d*)%/);
            return match ? parseFloat(match[1]) : null;
        }
        
        // 提取AI率
        function extractAIRate(logLine) {
            const match = logLine.match(/AI率:\s*(\d+)%/);
            return match ? parseInt(match[1]) : null;
        }
        
        // 智能控制器日志 - 结构化解析
        try {
            const { stdout: rawLogs } = await execAsync('tail -100 intelligent_controller.log 2>/dev/null');
            const lines = rawLogs.split('\n').filter(l => l.trim());
            
            for (const line of lines.slice(-50)) {
                // 改写日志识别
                if (line.match(/开始改写|改写中|改写完成|改写参数/)) {
                    logs.rewrite.push({ 
                        time: extractTime(line), 
                        msg: line, 
                        type: 'rewrite',
                        progress: extractProgress(line)  // 提取进度百分比
                    });
                }
                // AI检测日志识别
                else if (line.match(/AI检测|AI率|自动重写/)) {
                    logs.aiDetection.push({ 
                        time: extractTime(line), 
                        msg: line, 
                        type: 'ai',
                        aiRate: extractAIRate(line)  // 提取AI率
                    });
                }
                // 错误日志
                else if (line.match(/错误|失败|Error|Failed/i)) {
                    logs.errors.push({ time: extractTime(line), msg: line, type: 'error' });
                }
                // 成功日志
                else if (line.match(/成功|完成|Success|Completed/i)) {
                    logs.success.push({ time: extractTime(line), msg: line, type: 'success' });
                }
                // 进度日志
                else if (line.match(/处理中|开始|进度/)) {
                    logs.controller.push({ time: extractTime(line), msg: line, type: 'progress' });
                }
            }
        } catch (e) {}
        
        // URL生成日志
        if (status.urlGenerationRunning) {
            try {
                const { stdout: urlLogs } = await execAsync('tail -50 web_server.log 2>/dev/null | grep -E "(URL生成:|处理第|正在抓取|生成完成)"');
                const lines = urlLogs.split('\n').filter(l => l.trim());
                for (const line of lines.slice(-20)) {
                    logs.urlGen.push({ time: extractTime(line), msg: line, type: 'urlgen' });
                }
            } catch (e) {}
        }
        
        // 格式化输出
        status.structuredLogs = logs;
        
        // 传统日志（向后兼容）
        const formattedLogs = [];
        if (logs.errors.length > 0) {
            formattedLogs.push('=== 错误日志 ===');
            logs.errors.slice(-5).forEach(log => formattedLogs.push(`❌ ${log.msg}`));
        }
        if (logs.success.length > 0) {
            formattedLogs.push('\n=== 成功日志 ===');
            logs.success.slice(-5).forEach(log => formattedLogs.push(`✅ ${log.msg}`));
        }
        if (logs.controller.length > 0) {
            formattedLogs.push('\n=== 处理进度 ===');
            logs.controller.slice(-10).forEach(log => formattedLogs.push(`⏳ ${log.msg}`));
        }
        if (logs.urlGen.length > 0) {
            formattedLogs.push('\n=== URL生成 ===');
            logs.urlGen.slice(-5).forEach(log => formattedLogs.push(`🔗 ${log.msg}`));
        }
        if (logs.rewrite.length > 0) {
            formattedLogs.push('\n=== 改写进度 ===');
            logs.rewrite.slice(-5).forEach(log => formattedLogs.push(`✍️ ${log.msg}`));
        }
        if (logs.aiDetection.length > 0) {
            formattedLogs.push('\n=== AI检测 ===');
            logs.aiDetection.slice(-3).forEach(log => formattedLogs.push(`🤖 ${log.msg}`));
        }
        
        status.latestLogs = formattedLogs.join('\n') || '暂无日志';
    } catch (e) {
        status.latestLogs = '日志读取失败';
    }
    
    // 6. 获取改写统计
    status.rewriteStats = await getRewriteStats();

    return status;
}

// 解析改写统计信息
async function getRewriteStats() {
    try {
        const { stdout } = await execAsync('tail -100 intelligent_controller.log rewrite_progress.log 2>/dev/null | grep -E "(改写完成|AI检测结果)"');
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let stats = {
            rewrittenCount: 0,
            aiPassedCount: 0,
            totalAIRate: 0,
            aiTestCount: 0,
            rewritingCount: 0
        };
        
        // 计算当前正在改写的数量
        const { stdout: activeRewriting } = await execAsync('tail -50 intelligent_controller.log 2>/dev/null | grep "开始改写" | wc -l');
        const { stdout: completedRewriting } = await execAsync('tail -50 intelligent_controller.log 2>/dev/null | grep "改写完成" | wc -l');
        stats.rewritingCount = Math.max(0, parseInt(activeRewriting.trim()) - parseInt(completedRewriting.trim()));
        
        lines.forEach(line => {
            if (line.includes('改写完成')) stats.rewrittenCount++;
            if (line.includes('AI检测结果')) {
                const rateMatch = line.match(/AI率:\s*(\d+)%/);
                if (rateMatch) {
                    const rate = parseInt(rateMatch[1]);
                    stats.totalAIRate += rate;
                    stats.aiTestCount++;
                    if (rate <= 40) stats.aiPassedCount++;
                }
            }
        });
        
        stats.avgAIRate = stats.aiTestCount > 0 ? 
            Math.round(stats.totalAIRate / stats.aiTestCount) : 0;
        
        return stats;
    } catch (e) {
        return {
            rewrittenCount: 0,
            aiPassedCount: 0,
            avgAIRate: 0,
            rewritingCount: 0
        };
    }
}

// 系统状态API - 带缓存优化（支持强制刷新）
app.get('/api/system-status', async (req, res) => {
    try {
        const now = Date.now();
        const forceRefresh = req.query.refresh === 'true';
        
        // 检查缓存（除非强制刷新）
        if (!forceRefresh && statusCache.data && (now - statusCache.timestamp) < statusCache.ttl) {
            // 返回缓存数据，但更新一些实时字段
            const cachedData = { ...statusCache.data };
            cachedData.timestamp = new Date().toISOString();
            cachedData.cached = true;
            cachedData.cacheAge = now - statusCache.timestamp;
            
            return res.json(cachedData);
        }
        
        // 收集新数据（强制刷新时跳过缓存）
        const status = await collectSystemStatus(forceRefresh);
        
        // 更新缓存
        statusCache.data = status;
        statusCache.timestamp = now;
        
        res.json(status);
    } catch (error) {
        console.error('获取系统状态失败:', error);
        
        // 降级：返回缓存数据（如果有）
        if (statusCache.data) {
            const degraded = { ...statusCache.data, degraded: true, error: error.message };
            return res.json(degraded);
        }
        
        res.status(500).json({ error: '获取系统状态失败' });
    }
});

// 新的监控页面路由
app.get('/monitor', (req, res) => {
    const monitorHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>高尔夫文章处理系统监控</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .control-panel {
            background: #16213e;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
        }
        .restart-btn {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 1.2rem;
            border-radius: 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }
        .restart-btn:hover {
            background: #c0392b;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }
        .restart-btn:disabled {
            background: #7f8c8d;
            cursor: not-allowed;
            box-shadow: none;
        }
        .continue-btn {
            background: #27ae60;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 1.2rem;
            border-radius: 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
            margin: 0 10px;
        }
        .continue-btn:hover {
            background: #2ecc71;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
        }
        .continue-btn:disabled {
            background: #7f8c8d;
            cursor: not-allowed;
            box-shadow: none;
        }
        .retry-failed-btn {
            background: #e67e22;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 1.2rem;
            border-radius: 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(230, 126, 34, 0.3);
            margin: 0 10px;
        }
        .retry-failed-btn:hover {
            background: #d35400;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(230, 126, 34, 0.4);
        }
        .retry-failed-btn:disabled {
            background: #7f8c8d;
            cursor: not-allowed;
            box-shadow: none;
        }
        .control-btn {
            border: none;
            padding: 15px 40px;
            font-size: 1.2rem;
            border-radius: 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0 10px;
            color: white;
            font-weight: 600;
        }
        .control-btn.stop-all {
            background: linear-gradient(145deg, #e74c3c, #c0392b);
            position: relative;
            overflow: hidden;
        }
        .control-btn.stop-all:hover {
            background: linear-gradient(145deg, #c0392b, #a93226);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        }
        .control-btn.stop-all:active {
            transform: translateY(0);
            box-shadow: 0 2px 6px rgba(231, 76, 60, 0.3);
        }
        .control-btn.stop-all::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }
        .control-btn.stop-all:active::before {
            width: 300px;
            height: 300px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .status-card {
            background: #0f3460;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .status-card h3 {
            margin-bottom: 15px;
            color: #3498db;
            font-size: 1.2rem;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 10px;
        }
        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #2c3e50;
        }
        .status-item:last-child {
            border-bottom: none;
        }
        .status-label {
            color: #95a5a6;
        }
        .status-value {
            font-weight: bold;
            color: #ecf0f1;
        }
        .running {
            color: #2ecc71;
        }
        .stopped {
            color: #e74c3c;
        }
        .warning {
            color: #f39c12;
        }
        .url-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .url-item {
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
        }
        .url-item::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
            transform: rotate(45deg);
            transition: all 0.5s;
        }
        .url-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .url-item:hover::before {
            animation: shine 0.5s ease-in-out;
        }
        @keyframes shine {
            0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        .url-site-name {
            font-size: 1.1rem;
            color: #bdc3c7;
            margin-bottom: 10px;
            font-weight: 500;
        }
        .url-count {
            font-size: 3rem;
            font-weight: bold;
            color: #00d4ff;
            text-shadow: 0 0 20px rgba(0,212,255,0.5);
            line-height: 1;
        }
        .url-stats-highlight {
            background: #16213e;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }
        .url-stats-highlight h3 {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: #3498db;
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 15px;
        }
        .progress-bar {
            width: 100%;
            height: 25px;
            background: #2c3e50;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.9rem;
        }
        .log-container {
            background: #1a1a1a;
            color: #ccc;
            padding: 20px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        /* 日志样式 */
        .log-container .log-error {
            color: #e74c3c !important;
        }
        .log-container .log-success {
            color: #2ecc71 !important;
        }
        .log-container .log-progress {
            color: #3498db !important;
        }
        .log-container .log-url {
            color: #9b59b6 !important;
        }
        
        /* 改写日志样式 */
        .log-container .log-rewrite {
            color: #f39c12 !important;
        }
        
        /* AI检测日志样式 */
        .log-container .log-ai {
            color: #16a085 !important;
        }
        
        /* 改写统计样式 */
        .rewrite-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
        }
        
        .stat-label {
            color: #95a5a6;
            font-size: 0.9rem;
        }
        
        .stat-value {
            font-weight: bold;
            font-size: 1.2rem;
            color: #3498db;
        }
        
        .refresh-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2c3e50;
            padding: 15px 20px;
            border-radius: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            min-width: 200px;
            text-align: center;
        }
        .refresh-indicator .perf-info {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #34495e;
            font-size: 0.85rem;
            color: #95a5a6;
        }
        .refresh-indicator .perf-info span {
            color: #3498db;
            font-weight: 600;
        }
        .loading {
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .processing-card {
            background: #0f3460;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #3498db;
        }
        .site-name {
            font-weight: bold;
            color: #3498db;
            margin-bottom: 8px;
        }
        .current-url {
            font-size: 0.85rem;
            color: #95a5a6;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .stage-indicator {
            font-size: 0.85rem;
            color: #3498db;
            font-weight: 600;
        }
        .time-estimate {
            font-size: 0.85rem;
            color: #95a5a6;
        }
        .progress-bar {
            height: 20px;
            background: #2c3e50;
            border-radius: 10px;
            overflow: hidden;
            margin: 8px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: bold;
            transition: width 0.3s ease;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background-color: #0f3460;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            max-width: 500px;
            text-align: center;
        }
        .modal h3 {
            color: #e74c3c;
            margin-bottom: 20px;
        }
        .modal-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
        }
        .modal-btn {
            padding: 10px 30px;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
        }
        .modal-btn.confirm {
            background: #e74c3c;
            color: white;
        }
        .modal-btn.cancel {
            background: #7f8c8d;
            color: white;
        }
        .restart-status {
            display: none;
            margin-top: 20px;
            padding: 15px;
            background: #2c3e50;
            border-radius: 8px;
        }
        .restart-status.active {
            display: block;
        }
        .status-message {
            margin-bottom: 10px;
            padding: 8px;
            border-radius: 5px;
            background: #34495e;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏌️ 高尔夫文章处理系统监控</h1>
            <p>实时监控系统运行状态</p>
        </div>

        <div class="refresh-indicator">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 1rem; font-weight: 600;">
                    🔄 下次刷新: <span id="countdown" style="color: #3498db;">10</span>秒
                </div>
                <button onclick="forceRefresh()" style="padding: 5px 15px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s;" onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                    🔄 强制刷新
                </button>
            </div>
            <div class="perf-info">
                ⚡ 响应: <span id="fetch-time">-</span> | 
                💾 缓存: <span id="cache-status">-</span> |
                📊 数据源: <span id="data-source">-</span>
            </div>
        </div>

        <div class="control-panel">
            <button class="control-btn stop-all" onclick="stopAllProcesses()">
                🛑 停止所有进程
            </button>
            <button id="restart-btn" class="restart-btn" onclick="confirmRestart()">
                🔄 一键重启系统
            </button>
            <button id="continue-btn" class="continue-btn" onclick="continueProcessing()">
                ▶️ 继续处理URL
            </button>
            <button id="retry-failed-btn" class="action-btn retry-failed-btn" onclick="processFailedUrls()">
                🔄 处理失败的文章
            </button>
            <div id="restart-status" class="restart-status">
                <div id="status-messages"></div>
            </div>
            <div class="status-info" style="margin-top: 10px; font-size: 0.85rem; color: #95a5a6; text-align: center;">
                <p style="margin: 5px 0;">🔄 一键重启：停止进程 → 重新抓取URL → 开始处理（适用于每天首次运行）</p>
                <p style="margin: 5px 0;">▶️ 继续处理：直接处理现有URL，不重新抓取（适用于中断后继续）</p>
                <p style="margin: 5px 0;">🔄 处理失败的文章：只处理之前失败的文章（不包括其他URL）</p>
            </div>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>📊 系统概览</h3>
                <div class="status-item">
                    <span class="status-label">系统状态:</span>
                    <span id="system-status" class="status-value loading">检查中...</span>
                </div>
                <div class="status-item">
                    <span class="status-label">运行进程:</span>
                    <span id="process-count" class="status-value">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">今日文章:</span>
                    <span id="today-articles" class="status-value">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">最新处理:</span>
                    <span id="last-process" class="status-value">-</span>
                </div>
            </div>

            <div class="status-card">
                <h3>⚙️ 服务状态</h3>
                <div class="status-item">
                    <span class="status-label">Web服务器:</span>
                    <span id="web-server-status" class="status-value">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">智能控制器:</span>
                    <span id="controller-status" class="status-value">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">批处理器:</span>
                    <span id="batch-status" class="status-value">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">URL生成:</span>
                    <span id="url-generation-status" class="status-value">-</span>
                </div>
            </div>

            <div class="status-card">
                <h3>🤖 AI检测统计</h3>
                <div id="ai-stats">
                    <p class="loading">加载中...</p>
                </div>
            </div>
        </div>

        <div class="status-card">
            <h3>🔄 处理进度</h3>
            <div id="processing-progress">
                <p style="text-align: center; color: #95a5a6;">当前没有处理任务</p>
            </div>
        </div>

        <div class="status-card">
            <h3>✍️ 改写统计</h3>
            <div class="rewrite-stats">
                <div class="stat-item">
                    <span class="stat-label">正在改写</span>
                    <span class="stat-value" id="rewriting-count">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">改写完成</span>
                    <span class="stat-value" id="rewritten-count">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">AI检测通过</span>
                    <span class="stat-value" id="ai-passed-count">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">平均AI率</span>
                    <span class="stat-value" id="avg-ai-rate">-</span>
                </div>
            </div>
        </div>

        <div class="status-card">
            <h3>📝 最新日志</h3>
            <div class="log-container" id="latest-logs">
                <span class="loading">等待日志数据...</span>
            </div>
        </div>
    </div>

    <!-- 确认重启对话框 -->
    <div id="confirmModal" class="modal">
        <div class="modal-content">
            <h3>⚠️ 确认重启系统</h3>
            <p>确定要重启整个高尔夫文章处理系统吗？</p>
            <p style="margin-top: 10px; color: #95a5a6; font-size: 0.9rem;">
                这将执行以下操作：<br>
                1. 停止所有处理进程<br>
                2. 重新抓取18个网站的最新URL<br>
                3. 启动智能并发控制器处理新文章
            </p>
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeModal()">取消</button>
                <button class="modal-btn confirm" onclick="executeRestart()">确认重启</button>
            </div>
        </div>
    </div>

    <script>
        // 动态刷新间隔
        let refreshInterval = 10; // 默认10秒
        let isProcessing = false;
        let countdown = refreshInterval;
        const countdownElement = document.getElementById('countdown');
        let updateInterval;
        let countdownTimer;

        // 强制刷新函数
        async function forceRefresh() {
            countdownElement.textContent = '刷新中...';
            await updateStatus(true);
            startCountdown(); // 重新开始倒计时
        }
        
        // 启动倒计时
        function startCountdown() {
            if (countdownTimer) clearInterval(countdownTimer);
            countdown = refreshInterval;
            countdownElement.textContent = countdown;
            
            countdownTimer = setInterval(() => {
                countdown--;
                countdownElement.textContent = countdown;
                if (countdown <= 0) {
                    updateStatus();
                }
            }, 1000);
        }

        // 获取系统状态（支持强制刷新）
        async function updateStatus(forceRefresh = false) {
            try {
                const startTime = Date.now();
                const url = forceRefresh ? '/api/system-status?refresh=true' : '/api/system-status';
                const response = await fetch(url);
                const data = await response.json();
                const fetchTime = Date.now() - startTime;
                
                // 显示获取时间和缓存状态（如果有性能指标显示区域）
                const fetchTimeEl = document.getElementById('fetch-time');
                const cacheStatusEl = document.getElementById('cache-status');
                const dataSourceEl = document.getElementById('data-source');
                
                if (fetchTimeEl) {
                    fetchTimeEl.textContent = \`\${fetchTime}ms\`;
                } else {
                    console.warn('fetch-time元素未找到');
                }
                if (cacheStatusEl) {
                    cacheStatusEl.textContent = data.cached ? \`命中(\${data.cacheAge}ms)\` : '未命中';
                } else {
                    console.warn('cache-status元素未找到');
                }
                if (dataSourceEl) {
                    dataSourceEl.textContent = data.cached ? '缓存数据' : '实时数据';
                    dataSourceEl.style.color = data.cached ? '#f39c12' : '#2ecc71';
                }
                
                // 调试信息
                console.log('API响应数据:', {
                    cached: data.cached,
                    cacheAge: data.cacheAge,
                    fetchTime: fetchTime,
                    estimatedTime: data.estimatedTime,
                    structuredLogs: data.structuredLogs ? '有结构化日志' : '无结构化日志'
                });
                
                // 动态调整刷新间隔
                const hasActiveTasks = data.processCount > 1 || 
                    (data.estimatedTime && data.estimatedTime.totalPending > 0);
                
                if (hasActiveTasks && !isProcessing) {
                    refreshInterval = 3; // 有任务时3秒刷新
                    isProcessing = true;
                } else if (!hasActiveTasks && isProcessing) {
                    refreshInterval = 10; // 空闲时10秒刷新
                    isProcessing = false;
                }
                
                // 重启倒计时
                startCountdown();

                // 更新系统概览
                document.getElementById('system-status').textContent = data.running ? '正常运行' : '已停止';
                document.getElementById('system-status').className = data.running ? 'status-value running' : 'status-value stopped';
                document.getElementById('process-count').textContent = data.processCount + '个';
                document.getElementById('today-articles').textContent = data.todayArticles + '篇';
                document.getElementById('last-process').textContent = data.lastProcessTime || '-';

                // 更新服务状态
                document.getElementById('web-server-status').textContent = data.services.webServer ? '运行中' : '已停止';
                document.getElementById('web-server-status').className = data.services.webServer ? 'status-value running' : 'status-value stopped';
                document.getElementById('controller-status').textContent = data.services.controller ? '运行中' : '已停止';
                document.getElementById('controller-status').className = data.services.controller ? 'status-value running' : 'status-value stopped';
                document.getElementById('batch-status').textContent = data.services.batchProcessor ? '运行中' : '已停止';
                
                // 更新改写统计
                if (data.rewriteStats) {
                    document.getElementById('rewriting-count').textContent = data.rewriteStats.rewritingCount;
                    document.getElementById('rewritten-count').textContent = data.rewriteStats.rewrittenCount;
                    document.getElementById('ai-passed-count').textContent = data.rewriteStats.aiPassedCount;
                    document.getElementById('avg-ai-rate').textContent = data.rewriteStats.avgAIRate > 0 ? 
                        data.rewriteStats.avgAIRate + '%' : '-';
                }
                document.getElementById('batch-status').className = data.services.batchProcessor ? 'status-value running' : 'status-value stopped';
                document.getElementById('url-generation-status').textContent = data.urlGenerationRunning ? '生成中' : '空闲';
                document.getElementById('url-generation-status').className = data.urlGenerationRunning ? 'status-value warning' : 'status-value';

                // 网站文章统计已移除，直接跳过
                // const siteStatsDiv = document.getElementById('site-stats');
                
                // 网站状态显示已移除
                /*
                if (data.websiteStatus) {
                    const statusGroups = {
                        'no-file': [],
                        'no-urls': [],
                        'pending': [],
                        'processing': [],
                        'completed': []
                    };
                    // 网站状态显示代码已全部移除
                    */

                // 更新AI检测统计
                const aiStatsDiv = document.getElementById('ai-stats');
                aiStatsDiv.innerHTML = '';
                if (data.aiStats) {
                    const stats = data.aiStats;
                    const detectionRate = stats.total > 0 ? ((stats.detected / stats.total) * 100).toFixed(1) : 0;
                    
                    aiStatsDiv.innerHTML = \`
                        <div class="status-item">
                            <span class="status-label">检测完成率:</span>
                            <span class="status-value">\${detectionRate}% (\${stats.detected}/\${stats.total})</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">平均AI概率:</span>
                            <span class="status-value">\${stats.avgProbability || 0}%</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">高风险(≥80%):</span>
                            <span class="status-value" style="color: #e74c3c;">\${stats.highRisk}篇</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">中风险(50-79%):</span>
                            <span class="status-value" style="color: #f39c12;">\${stats.mediumRisk}篇</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">低风险(&lt;50%):</span>
                            <span class="status-value" style="color: #2ecc71;">\${stats.lowRisk}篇</span>
                        </div>
                    \`;
                } else {
                    aiStatsDiv.innerHTML = '<p style="text-align: center; color: #95a5a6;">暂无AI检测数据</p>';
                }

                // 更新处理进度 - 完整优化版
                const progressDiv = document.getElementById('processing-progress');
                progressDiv.innerHTML = '';
                
                // 首先显示处理统计面板
                if (data.processingStats) {
                    const stats = data.processingStats;
                    const statsPanel = document.createElement('div');
                    statsPanel.className = 'processing-stats-panel';
                    statsPanel.style.cssText = 'background: #16213e; padding: 20px; border-radius: 10px; margin-bottom: 20px;';
                    statsPanel.innerHTML = '<h3 style="color: #3498db; margin-bottom: 15px; font-size: 1.3rem;">📊 处理统计</h3>' +
                        '<div style="font-family: monospace; line-height: 1.8;">' +
                            '<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2c3e50;">' +
                                '<span style="color: #95a5a6;">今日成功改写:</span>' +
                                '<span style="color: #2ecc71; font-weight: bold; font-size: 1.2rem;">' + stats.articlesToday + '篇 ✅</span>' +
                            '</div>' +
                            '<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2c3e50;">' +
                                '<span style="color: #95a5a6;">URL抓取总数:</span>' +
                                '<span style="color: #ecf0f1; font-weight: bold;">' + stats.urlTotal + '个</span>' +
                            '</div>' +
                            '<div style="margin: 15px 0; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">' +
                                '<h4 style="color: #3498db; margin-bottom: 10px;">处理详情:</h4>' +
                                '<div style="margin-left: 20px;">' +
                                    '<div style="display: flex; justify-content: space-between; padding: 5px 0;">' +
                                        '<span style="color: #95a5a6;">✅ 成功处理:</span>' +
                                        '<span style="color: #2ecc71;">' + stats.success + '篇 (' + (stats.successRate || '0.0') + '%)</span>' +
                                    '</div>' +
                                    '<div style="display: flex; justify-content: space-between; padding: 5px 0;">' +
                                        '<span style="color: #95a5a6;">🔁 重复跳过:</span>' +
                                        '<span style="color: #f39c12;">' + stats.skipped + '篇 (' + (stats.skipRate || '0.0') + '%)</span>' +
                                    '</div>' +
                                    '<div style="display: flex; justify-content: space-between; padding: 5px 0;">' +
                                        '<span style="color: #95a5a6;">❌ 处理失败:</span>' +
                                        '<span style="color: #e74c3c;">' + stats.failed + '篇 (' + (stats.failureRate || '0.0') + '%)</span>' +
                                    '</div>' +
                                    '<div style="display: flex; justify-content: space-between; padding: 5px 0;">' +
                                        '<span style="color: #95a5a6;">⏳ 待处理:</span>' +
                                        '<span style="color: #3498db;">' + stats.pending + '篇 (' + (((stats.pending/stats.urlTotal)*100).toFixed(1) || '0.0') + '%)</span>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid #2c3e50; margin-top: 10px;">' +
                                '<span style="color: #95a5a6;">📈 处理效率:</span>' +
                                '<span style="color: #ecf0f1; font-weight: bold;">成功率 ' + (stats.success > 0 ? ((stats.success / (stats.success + stats.failed)) * 100).toFixed(1) : '0.0') + '%</span>' +
                            '</div>' +
                        '</div>';
                    progressDiv.appendChild(statsPanel);
                }
                
                // 收集所有网站状态数据
                const websiteProgress = {};
                let completedCount = 0;
                let processingCount = 0;
                let pendingCount = 0;
                let totalCount = 0;
                
                // 1. 从 websiteStatus 收集基础状态
                if (data.websiteStatus) {
                    Object.values(data.websiteStatus).forEach(site => {
                        websiteProgress[site.name] = {
                            name: site.name,
                            status: site.status,
                            statusText: site.statusText,
                            statusIcon: site.statusIcon,
                            statusColor: site.statusColor,
                            articlesToday: site.articlesToday || 0,
                            totalUrls: site.totalUrls || 0,
                            pendingUrls: site.pendingUrls || 0,
                            processedUrls: site.processedUrls || 0,
                            detailStats: site.detailStats,
                            successCount: 0,
                            failedCount: 0
                        };
                        
                        // 统计总数 - 修复统计逻辑
                        totalCount += site.totalUrls || 0;
                        
                        // 累加已处理、待处理的URL数量
                        if (site.processedUrls) {
                            completedCount += site.processedUrls;
                        }
                        if (site.pendingUrls) {
                            pendingCount += site.pendingUrls;
                        }
                        
                        // 处理中的数量需要特殊处理
                        if (site.status === 'processing' && site.pendingUrls > 0) {
                            // 假设每个网站最多并发处理2个URL
                            processingCount += Math.min(site.pendingUrls, 2);
                            // 从待处理中扣除正在处理的数量
                            pendingCount -= Math.min(site.pendingUrls, 2);
                        }
                    });
                }
                
                // 2. 从 processingInfo.processing 更新实时进度
                if (data.processingInfo && data.processingInfo.processing) {
                    Object.entries(data.processingInfo.processing).forEach(([file, info]) => {
                        if (info && info.websiteName && info.currentUrl && info.stage) {
                            const siteName = info.websiteName;
                            if (!websiteProgress[siteName]) {
                                websiteProgress[siteName] = {
                                    name: siteName,
                                    status: 'processing',
                                    totalUrls: info.totalUrls || 0
                                };
                            }
                            
                            // 更新进度信息
                            websiteProgress[siteName] = {
                                ...websiteProgress[siteName],
                                status: 'processing',
                                currentUrl: info.currentUrl,
                                currentIndex: info.currentIndex,
                                stage: info.stage,
                                stageText: info.stageText || info.stage,
                                processedArticles: info.processedArticles || 0,
                                successCount: info.successCount || 0,
                                failedCount: info.failedCount || 0,
                                elapsedTime: info.elapsedTime,
                                estimatedRemaining: info.estimatedRemaining
                            };
                        }
                    });
                }
                
                // 3. 使用正确的已处理数量（已在上面计算）
                const processedCount = completedCount;
                
                // 确保pendingCount不为负数
                pendingCount = Math.max(0, pendingCount);
                
                // 4. 显示顶部汇总状态
                const summaryDiv = document.createElement('div');
                summaryDiv.style.cssText = 'background: #2c3e50; padding: 20px; border-radius: 10px; margin-bottom: 20px;';
                summaryDiv.innerHTML = \`
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 1.2rem; color: #3498db; font-weight: 600;">📊 处理队列状态</span>
                        <div style="display: flex; gap: 25px; font-size: 1rem;">
                            <span style="color: #2ecc71;">✅ 已完成: <strong>\${processedCount}</strong> 篇</span>
                            <span style="color: #3498db;">⏳ 处理中: <strong>\${processingCount}</strong> 篇</span>
                            <span style="color: #f39c12;">📋 待处理: <strong>\${pendingCount}</strong> 篇</span>
                            <span style="color: #ecf0f1;">📊 总计: <strong>\${totalCount}</strong> 篇</span>
                        </div>
                    </div>
                    \${totalCount > 0 ? \`
                        <div style="background: #34495e; height: 25px; border-radius: 12px; overflow: hidden; position: relative;">
                            <div style="background: #2ecc71; width: \${(processedCount/totalCount*100)}%; height: 100%; transition: width 0.5s ease;">
                            </div>
                            <div style="background: #3498db; width: \${(processingCount/totalCount*100)}%; height: 100%; position: absolute; left: \${(processedCount/totalCount*100)}%; transition: all 0.5s ease;">
                            </div>
                            <div style="position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                                \${((processedCount/totalCount)*100).toFixed(1)}% 完成
                            </div>
                        </div>
                        \${pendingCount > 0 || processingCount > 0 ? \`
                            <div style="text-align: center; margin-top: 10px; color: #95a5a6;">
                                预计剩余时间: \${data.estimatedTime ? data.estimatedTime.estimatedTimeText : Math.ceil((pendingCount + processingCount) * 45 / 60) + '分钟'}
                            </div>
                        \` : \`
                            <div style="text-align: center; margin-top: 10px; color: #2ecc71; font-size: 1.1rem;">
                                ✅ 全部处理完成！
                            </div>
                        \`}
                    \` : ''}
                \`;
                progressDiv.appendChild(summaryDiv);
                
                // 添加实时处理速度显示
                if (data.websiteStatus && data.estimatedTime && data.estimatedTime.breakdown) {
                    console.log('处理速度计算数据:', {
                        websiteStatus: data.websiteStatus,
                        breakdown: data.estimatedTime.breakdown
                    });
                    
                    const speedInfo = document.createElement('div');
                    speedInfo.style.cssText = 'text-align: center; margin-bottom: 15px; color: #95a5a6;';
                    
                    let totalSpeed = 0;
                    let activeCount = 0;
                    
                    Object.values(data.websiteStatus).forEach(site => {
                        if (site.status === 'processing' && data.estimatedTime.breakdown[site.name]) {
                            const speed = 60 / (data.estimatedTime.breakdown[site.name].perArticle || 45);
                            totalSpeed += speed;
                            activeCount++;
                            console.log(\`\${site.name} 处理速度: \${speed.toFixed(2)} 篇/分钟\`);
                        }
                    });
                    
                    console.log(\`总速度: \${totalSpeed.toFixed(1)} 篇/分钟, 活动网站数: \${activeCount}\`);
                    
                    if (activeCount > 0) {
                        speedInfo.innerHTML = \`
                            <span style="color: #3498db; font-weight: 600; font-size: 1.1rem;">
                                ⚡ 处理速度: <span style="color: #2ecc71;">\${totalSpeed.toFixed(1)}</span> 篇/分钟
                            </span>
                        \`;
                        summaryDiv.appendChild(speedInfo);
                    } else {
                        console.log('没有正在处理的网站，不显示处理速度');
                    }
                } else {
                    console.log('缺少处理速度计算所需的数据:', {
                        hasWebsiteStatus: !!data.websiteStatus,
                        hasEstimatedTime: !!data.estimatedTime,
                        hasBreakdown: !!(data.estimatedTime && data.estimatedTime.breakdown)
                    });
                }
                
                // 5. 将网站按状态分组
                const statusGroups = {
                    'processing': [],
                    'pending': [],
                    'completed': [],
                    'no-file': [],
                    'no-urls': []
                };
                
                Object.values(websiteProgress).forEach(site => {
                    const group = statusGroups[site.status] || statusGroups['pending'];
                    group.push(site);
                });
                
                // 6. 创建网格容器
                const gridContainer = document.createElement('div');
                gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;';
                
                // 7. 显示各状态组（优先级：处理中 > 待处理 > 已完成）
                const displayOrder = ['processing', 'pending', 'completed', 'no-file', 'no-urls'];
                const statusTitles = {
                    'processing': '⏳ 正在处理',
                    'pending': '📋 待处理',
                    'completed': '✅ 已完成',
                    'no-file': '❌ 未生成URL',
                    'no-urls': '⚠️ URL为空'
                };
                
                displayOrder.forEach(status => {
                    const sites = statusGroups[status];
                    if (sites.length > 0) {
                        sites.forEach(site => {
                            const card = document.createElement('div');
                            const isProcessing = site.status === 'processing';
                            const isCompleted = site.status === 'completed';
                            
                            card.style.cssText = \`
                                background: \${isCompleted ? '#1a3a52' : '#0f3460'};
                                padding: 15px;
                                border-radius: 8px;
                                border-left: 4px solid \${site.statusColor || '#3498db'};
                                opacity: \${isCompleted ? '0.8' : '1'};
                                transition: all 0.3s ease;
                            \`;
                            
                            card.innerHTML = \`
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <div style="font-weight: 600; color: #ecf0f1;">\${site.name}</div>
                                    <div style="font-size: 0.9rem; padding: 4px 12px; background: \${site.statusColor}20; color: \${site.statusColor || '#3498db'}; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                                        <span>\${site.statusIcon || ''}</span>
                                        <span>\${site.statusText || statusTitles[site.status] || site.status}</span>
                                    </div>
                                </div>
                                \${isProcessing && site.currentUrl ? \`
                                    <div style="margin-bottom: 8px;">
                                        <div style="background: #2c3e50; height: 18px; border-radius: 9px; overflow: hidden;">
                                            <div style="background: linear-gradient(90deg, #3498db, #2ecc71); width: \${((site.processedArticles || 0) / (site.totalUrls || 1) * 100)}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 600;">
                                                \${site.processedArticles || 0}/\${site.totalUrls || 0}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                                        <span>\${site.stageText === '抓取中' ? '🔍' : site.stageText === '改写中' ? '✍️' : '💾'} \${site.stageText || '处理中'}</span>
                                        \${site.estimatedRemaining ? \`<span style="color: #95a5a6;">剩余: \${Math.ceil(site.estimatedRemaining / 60000)}分钟</span>\` : ''}
                                    </div>
                                \` : \`
                                    <div style="font-size: 0.9rem; line-height: 1.6;">
                                        \${site.totalUrls ? \`
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <span>📊 总计:</span>
                                                <span style="font-weight: 600;">\${site.totalUrls} 篇</span>
                                            </div>
                                        \` : ''}
                                        \${(site.detailStats || site.processedUrls > 0) ? \`
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <span>✅ 已处理:</span>
                                                <span style="font-weight: 600; color: #2ecc71;">\${site.detailStats?.processed || site.processedUrls || 0} 篇 (\${site.totalUrls > 0 ? (((site.detailStats?.processed || site.processedUrls || 0) / site.totalUrls) * 100).toFixed(1) : '0'}%)</span>
                                            </div>
                                            \${site.detailStats ? \`
                                                <div style="margin-left: 20px; font-size: 0.85rem; color: #95a5a6; padding-left: 10px; border-left: 2px solid #34495e;">
                                                    <div>├─ 成功: \${site.detailStats.success} 篇</div>
                                                    <div>├─ 重复: \${site.detailStats.skipped} 篇</div>
                                                    <div>└─ 失败: \${site.detailStats.failed} 篇</div>
                                                </div>
                                            \` : ''}
                                        \` : ''}
                                        \${site.pendingUrls > 0 ? \`
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <span>⏳ 待处理:</span>
                                                <span style="font-weight: 600; color: #f39c12;">\${site.pendingUrls} 篇 (\${site.totalUrls > 0 ? ((site.pendingUrls / site.totalUrls) * 100).toFixed(1) : '0'}%)</span>
                                            </div>
                                        \` : ''}
                                        \${site.articlesToday ? \`
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; padding-top: 5px; border-top: 1px solid #34495e;">
                                                <span>📅 今日成功:</span>
                                                <span style="font-weight: 600; color: #3498db;">\${site.articlesToday} 篇</span>
                                            </div>
                                        \` : ''}
                                    </div>
                                \`}
                                \${(site.successCount > 0 || site.failedCount > 0) ? \`
                                    <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 0.85rem;">
                                        <span style="color: #2ecc71;">✅ 成功: \${site.successCount}</span>
                                        <span style="color: #e74c3c;">❌ 失败: \${site.failedCount}</span>
                                    </div>
                                \` : ''}
                                \${isProcessing && site.currentUrl ? \`
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #34495e;">
                                        <div style="font-size: 0.75rem; color: #95a5a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                            [\${site.currentIndex || '?'}/\${site.totalUrls || '?'}] \${site.currentUrl}
                                        </div>
                                    </div>
                                \` : ''}
                            \`;
                            
                            gridContainer.appendChild(card);
                        });
                    }
                });
                
                progressDiv.appendChild(gridContainer);
                
                // 如果没有任何任务
                if (Object.keys(websiteProgress).length === 0) {
                    progressDiv.innerHTML = '<p style="text-align: center; color: #95a5a6; margin-top: 50px;">当前没有处理任务</p>';
                }

                // 结构化日志显示
                if (data.structuredLogs) {
                    const logContainer = document.getElementById('latest-logs');
                    logContainer.innerHTML = '';
                    
                    // 错误优先显示
                    if (data.structuredLogs.errors && data.structuredLogs.errors.length > 0) {
                        const errorSection = document.createElement('div');
                        errorSection.className = 'log-error';
                        errorSection.style.marginBottom = '15px';
                        errorSection.innerHTML = '<strong>❌ 错误日志</strong>';
                        data.structuredLogs.errors.slice(-3).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            line.textContent = \`[\${log.time || ''}] \${log.msg}\`;
                            errorSection.appendChild(line);
                        });
                        logContainer.appendChild(errorSection);
                    }
                    
                    // 成功日志
                    if (data.structuredLogs.success && data.structuredLogs.success.length > 0) {
                        const successSection = document.createElement('div');
                        successSection.className = 'log-success';
                        successSection.style.marginBottom = '15px';
                        successSection.innerHTML = '<strong>✅ 成功日志</strong>';
                        data.structuredLogs.success.slice(-3).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            line.textContent = \`[\${log.time || ''}] \${log.msg}\`;
                            successSection.appendChild(line);
                        });
                        logContainer.appendChild(successSection);
                    }
                    
                    // 进度日志
                    if (data.structuredLogs.controller && data.structuredLogs.controller.length > 0) {
                        const progressSection = document.createElement('div');
                        progressSection.className = 'log-progress';
                        progressSection.style.marginBottom = '15px';
                        progressSection.innerHTML = '<strong>⏳ 处理进度</strong>';
                        data.structuredLogs.controller.slice(-5).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            line.textContent = \`[\${log.time || ''}] \${log.msg}\`;
                            progressSection.appendChild(line);
                        });
                        logContainer.appendChild(progressSection);
                    }
                    
                    // URL生成日志
                    if (data.structuredLogs.urlGen && data.structuredLogs.urlGen.length > 0) {
                        const urlSection = document.createElement('div');
                        urlSection.className = 'log-url';
                        urlSection.style.marginBottom = '15px';
                        urlSection.innerHTML = '<strong>🔗 URL生成</strong>';
                        data.structuredLogs.urlGen.slice(-3).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            line.textContent = \`[\${log.time || ''}] \${log.msg}\`;
                            urlSection.appendChild(line);
                        });
                        logContainer.appendChild(urlSection);
                    }
                    
                    // 改写日志显示
                    if (data.structuredLogs.rewrite && data.structuredLogs.rewrite.length > 0) {
                        const rewriteSection = document.createElement('div');
                        rewriteSection.className = 'log-rewrite';
                        rewriteSection.style.marginBottom = '15px';
                        rewriteSection.innerHTML = '<strong>✍️ 改写进度</strong>';
                        
                        // 显示最新的5条改写日志
                        data.structuredLogs.rewrite.slice(-5).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            // 高亮显示进度百分比
                            let formattedMsg = log.msg;
                            if (log.progress) {
                                formattedMsg = formattedMsg.replace(/(\d+\.?\d*%)/, '<span style="color: #3498db; font-weight: bold;">$1</span>');
                            }
                            line.innerHTML = \`[\${log.time || ''}] \${formattedMsg}\`;
                            rewriteSection.appendChild(line);
                        });
                        logContainer.appendChild(rewriteSection);
                    }
                    
                    // AI检测日志显示
                    if (data.structuredLogs.aiDetection && data.structuredLogs.aiDetection.length > 0) {
                        const aiSection = document.createElement('div');
                        aiSection.className = 'log-ai';
                        aiSection.style.marginBottom = '15px';
                        aiSection.innerHTML = '<strong>🤖 AI检测结果</strong>';
                        
                        data.structuredLogs.aiDetection.slice(-3).forEach(log => {
                            const line = document.createElement('div');
                            line.style.cssText = 'margin-left: 20px; margin-top: 5px;';
                            // 根据AI率显示不同颜色
                            const color = log.aiRate && log.aiRate > 40 ? '#e74c3c' : '#2ecc71';
                            line.innerHTML = \`[\${log.time || ''}] <span style="color: \${color};">\${log.msg}</span>\`;
                            aiSection.appendChild(line);
                        });
                        logContainer.appendChild(aiSection);
                    }
                    
                    // 自动滚动到底部
                    logContainer.scrollTop = logContainer.scrollHeight;
                    
                    // 如果没有任何日志
                    if (!data.structuredLogs.errors?.length && 
                        !data.structuredLogs.success?.length && 
                        !data.structuredLogs.controller?.length && 
                        !data.structuredLogs.urlGen?.length &&
                        !data.structuredLogs.rewrite?.length &&
                        !data.structuredLogs.aiDetection?.length) {
                        logContainer.innerHTML = '<span style="color: #95a5a6;">暂无日志</span>';
                    }
                } else {
                    // 降级到原始日志显示
                    document.getElementById('latest-logs').textContent = data.latestLogs || '暂无日志';
                }

            } catch (error) {
                console.error('获取状态失败:', error);
                document.getElementById('system-status').textContent = '连接失败';
                document.getElementById('system-status').className = 'status-value stopped';
            }
        }

        // 确认重启
        function confirmRestart() {
            document.getElementById('confirmModal').style.display = 'flex';
        }

        // 关闭模态框
        function closeModal() {
            document.getElementById('confirmModal').style.display = 'none';
        }

        // 执行重启
        async function executeRestart() {
            closeModal();
            const btn = document.getElementById('restart-btn');
            const statusDiv = document.getElementById('restart-status');
            const messagesDiv = document.getElementById('status-messages');
            
            btn.disabled = true;
            btn.textContent = '重启中...';
            statusDiv.classList.add('active');
            messagesDiv.innerHTML = '';

            // 添加状态消息
            function addStatusMessage(message, type = 'info') {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'status-message';
                msgDiv.textContent = message;
                msgDiv.style.color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#3498db');
                messagesDiv.appendChild(msgDiv);
            }

            try {
                addStatusMessage('🔄 开始重启系统...');
                
                const response = await fetch('/api/restart-system', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addStatusMessage('✅ ' + data.message);
                    
                    // 监控重启进度
                    let checkCount = 0;
                    const checkInterval = setInterval(async () => {
                        checkCount++;
                        
                        if (checkCount === 2) addStatusMessage('⏹️ 正在停止现有进程...');
                        if (checkCount === 4) addStatusMessage('🔍 正在生成新URL...');
                        if (checkCount === 10) addStatusMessage('🚀 正在启动处理器...');
                        
                        // 更新系统状态
                        await updateStatus();
                        
                        // 30秒后认为重启完成
                        if (checkCount >= 30) {
                            clearInterval(checkInterval);
                            addStatusMessage('✅ 系统重启完成！', 'success');
                            setTimeout(() => {
                                statusDiv.classList.remove('active');
                                btn.disabled = false;
                                btn.textContent = '🔄 一键重启系统';
                            }, 3000);
                        }
                    }, 1000);
                    
                } else {
                    addStatusMessage('❌ 重启失败: ' + data.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '🔄 一键重启系统';
                }
            } catch (error) {
                addStatusMessage('❌ 请求失败: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = '🔄 一键重启系统';
            }
        }

        // 继续处理现有URL
        async function continueProcessing() {
            // 先询问是否要重新生成URL
            const regenerateUrls = confirm('是否需要重新生成最新URL？\n\n选择"确定"：重新抓取最新文章URL后处理（推荐）\n选择"取消"：直接处理现有URL文件');
            
            const btn = document.getElementById('continue-btn');
            const statusDiv = document.getElementById('restart-status');
            const messagesDiv = document.getElementById('status-messages');
            
            btn.disabled = true;
            btn.textContent = '处理中...';
            statusDiv.classList.add('active');
            messagesDiv.innerHTML = '';
            
            // 状态消息函数（复用现有的）
            function addStatusMessage(message, type = 'info') {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'status-message';
                msgDiv.textContent = message;
                msgDiv.style.color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#3498db');
                messagesDiv.appendChild(msgDiv);
            }
            
            try {
                if (regenerateUrls) {
                    addStatusMessage('🔄 正在重新生成最新URL...');
                } else {
                    addStatusMessage('▶️ 开始处理现有URL...');
                }
                
                const response = await fetch('/api/continue-processing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ regenerateUrls })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.regenerated) {
                        addStatusMessage('✅ URL重新生成完成', 'success');
                    }
                    addStatusMessage('📊 发现 ' + data.totalUrls + ' 个待处理URL');
                    addStatusMessage('🚀 正在启动智能处理器...');
                    
                    // 实时监控进度
                    let checkCount = 0;
                    const checkInterval = setInterval(async () => {
                        checkCount++;
                        await updateStatus();
                        
                        // 15秒后认为启动完成
                        if (checkCount >= 15) {
                            clearInterval(checkInterval);
                            addStatusMessage('✅ 处理器已启动！', 'success');
                            setTimeout(() => {
                                statusDiv.classList.remove('active');
                                btn.disabled = false;
                                btn.textContent = '▶️ 继续处理URL';
                            }, 2000);
                        }
                    }, 1000);
                } else {
                    addStatusMessage('❌ 启动失败: ' + data.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '▶️ 继续处理URL';
                }
            } catch (error) {
                addStatusMessage('❌ 请求失败: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = '▶️ 继续处理URL';
            }
        }

        // 处理失败的文章
        async function processFailedUrls() {
            if (!confirm('确定要处理所有失败的文章吗？')) return;
            
            const btn = document.getElementById('retry-failed-btn');
            const statusDiv = document.getElementById('restart-status');
            const messagesDiv = document.getElementById('status-messages');
            
            btn.disabled = true;
            btn.textContent = '处理中...';
            statusDiv.classList.add('active');
            messagesDiv.innerHTML = '';
            
            try {
                const response = await fetch('/api/process-failed-urls', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'status-message success';
                    msgDiv.textContent = '✅ ' + data.message;
                    messagesDiv.appendChild(msgDiv);
                    
                    setTimeout(() => {
                        statusDiv.classList.remove('active');
                        btn.disabled = false;
                        btn.textContent = '🔄 处理失败的文章';
                    }, 3000);
                } else {
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'status-message error';
                    msgDiv.textContent = '❌ ' + data.error;
                    messagesDiv.appendChild(msgDiv);
                    btn.disabled = false;
                    btn.textContent = '🔄 处理失败的文章';
                }
            } catch (error) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'status-message error';
                msgDiv.textContent = '❌ 请求失败: ' + error.message;
                messagesDiv.appendChild(msgDiv);
                btn.disabled = false;
                btn.textContent = '🔄 处理失败的文章';
            }
        }

        // 停止所有进程 - 智能清理
        async function stopAllProcesses() {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = \`
                <div class="modal-content">
                    <h3>⚠️ 停止所有处理进程</h3>
                    <div class="process-info">
                        <p><strong>此操作将：</strong></p>
                        <ul style="text-align: left; margin: 10px 0;">
                            <li>🛑 停止所有批处理进程</li>
                            <li>🧹 清理超长运行进程（>12小时）</li>
                            <li>🗑️ 删除临时文件</li>
                            <li>📁 创建今天的目录结构</li>
                            <li>✅ 保留Web服务器运行</li>
                        </ul>
                        <p style="color: #e74c3c; margin-top: 15px;">
                            <strong>警告：</strong>正在处理的文章将被中断
                        </p>
                    </div>
                    <div class="modal-buttons">
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
                        <button class="modal-btn confirm" onclick="executeStopAll(this)">确认停止</button>
                    </div>
                </div>
            \`;
            document.body.appendChild(modal);
        }

        async function executeStopAll(button) {
            const modalContent = button.closest('.modal-content');
            const originalContent = modalContent.innerHTML;
            
            // 显示处理中状态
            modalContent.innerHTML = \`
                <div class="processing-status">
                    <div class="spinner"></div>
                    <h3>正在停止进程...</h3>
                    <p>请稍候，正在执行清理操作</p>
                </div>
            \`;
            
            try {
                const response = await fetch('/api/stop-all-processes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // 显示详细结果
                    let resultHTML = \`
                        <div class="result-success">
                            <h3>✅ 清理完成</h3>
                            <div class="result-stats">
                                <p><strong>操作结果：</strong></p>
                                <ul style="text-align: left;">
                                    <li>成功停止: \${data.stoppedCount} 个进程</li>
                    \`;
                    
                    if (data.analysis.longRunning > 0) {
                        resultHTML += \`<li>清理超长进程: \${data.analysis.longRunning} 个</li>\`;
                    }
                    if (data.analysis.highCPU > 0) {
                        resultHTML += \`<li>停止高CPU进程: \${data.analysis.highCPU} 个</li>\`;
                    }
                    if (data.analysis.stuck > 0) {
                        resultHTML += \`<li>清理卡死进程: \${data.analysis.stuck} 个</li>\`;
                    }
                    
                    resultHTML += \`
                                    <li>创建目录: \${data.todayDir}</li>
                                </ul>
                            </div>
                            <button class="modal-btn confirm" onclick="location.reload()">刷新页面</button>
                        </div>
                    \`;
                    
                    modalContent.innerHTML = resultHTML;
                    
                    // 3秒后自动刷新
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                    
                } else {
                    throw new Error(data.error || '操作失败');
                }
                
            } catch (error) {
                modalContent.innerHTML = \`
                    <div class="result-error">
                        <h3>❌ 操作失败</h3>
                        <p>\${error.message}</p>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">关闭</button>
                    </div>
                \`;
            }
        }

        // 添加必要的CSS动画
        const styleSheet = document.createElement('style');
        styleSheet.textContent = \`
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            .modal-content {
                background: #1e3a5f;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                animation: modalSlideIn 0.3s ease;
            }
            
            @keyframes modalSlideIn {
                from {
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .processing-status {
                text-align: center;
                padding: 30px;
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                margin: 0 auto 20px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #e74c3c;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .result-success {
                text-align: center;
                padding: 20px;
            }
            
            .result-success h3 {
                color: #27ae60;
                margin-bottom: 20px;
            }
            
            .result-error {
                text-align: center;
                padding: 20px;
            }
            
            .result-error h3 {
                color: #e74c3c;
                margin-bottom: 20px;
            }
            
            .result-stats {
                background: #0f1c2e;
                border-radius: 8px;
                padding: 15px;
                margin: 15px 0;
            }
        \`;
        document.head.appendChild(styleSheet);

        // 点击模态框外部关闭
        document.getElementById('confirmModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });

        // 页面加载时立即更新
        updateStatus();
        
        // 启动倒计时
        startCountdown();

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                countdown = 10;
                updateStatus();
            }
        });
    </script>
</body>
</html>`;
    
    res.send(monitorHTML);
});

// 一键重启系统API (完全按照CLAUDE.md的流程)
app.post('/api/restart-system', async (req, res) => {
    // 立即返回响应
    res.json({ 
        success: true, 
        message: '系统重启已开始，请稍候...' 
    });
    
    // 异步执行重启流程
    (async () => {
        try {
            console.log('🔄 开始重启系统...');
            
            // 1. 停止现有处理进程（不影响Web服务器）
            console.log('停止现有处理进程...');
            await execAsync("ps aux | grep -E 'node.*(batch_process|scrape|intelligent|resilient|smart_startup)' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true");
            
            // 2. 等待3秒确保进程完全停止
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 2.5 清理所有批处理相关文件，确保重新开始
            console.log('清理批处理残留文件...');
            try {
                // 清理去重文件
                const dedupedFiles = fs.readdirSync(__dirname)
                    .filter(f => f.endsWith('_deduped.txt'));
                for (const file of dedupedFiles) {
                    fs.unlinkSync(path.join(__dirname, file));
                    console.log(`  删除去重文件: ${file}`);
                }
                
                // 清理进度文件
                const progressFiles = fs.readdirSync(__dirname)
                    .filter(f => f.startsWith('batch_progress_') && f.endsWith('.json'));
                for (const file of progressFiles) {
                    fs.unlinkSync(path.join(__dirname, file));
                    console.log(`  删除进度文件: ${file}`);
                }
                
                // 清理临时批处理文件
                const tempBatchFiles = fs.readdirSync(__dirname)
                    .filter(f => f.startsWith('temp_batch_') && f.endsWith('.txt'));
                for (const file of tempBatchFiles) {
                    fs.unlinkSync(path.join(__dirname, file));
                    console.log(`  删除临时文件: ${file}`);
                }
            } catch (error) {
                console.error('清理文件时出错:', error.message);
            }
            
            // 3. 重新生成URL (所有18个网站)
            console.log('开始生成新URL...');
            const generateUrls = spawn('node', ['auto_scrape_three_sites.js', '--all-sites'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            generateUrls.stdout.on('data', (data) => {
                console.log('URL生成:', data.toString());
            });
            
            generateUrls.stderr.on('data', (data) => {
                console.error('URL生成错误:', data.toString());
            });
            
            generateUrls.on('close', (code) => {
                if (code === 0) {
                    console.log('URL生成完成');
                    
                    // 4. 启动智能并发控制器
                    setTimeout(() => {
                        console.log('启动智能控制器处理新URL...');
                        const controller = spawn('node', ['intelligent_concurrent_controller.js'], {
                            detached: true,
                            stdio: ['ignore', 'pipe', 'pipe']
                        });
                        
                        // 将输出重定向到日志文件
                        const logStream = fs.createWriteStream('intelligent_controller.log', { flags: 'a' });
                        controller.stdout.pipe(logStream);
                        controller.stderr.pipe(logStream);
                        
                        controller.unref();
                        console.log('✅ 系统重启完成！智能控制器已启动');
                    }, 2000);
                } else {
                    console.error('URL生成失败，退出码:', code);
                }
            });
            
        } catch (error) {
            console.error('重启系统失败:', error);
        }
    })();
});

// 继续处理现有URL的API
app.post('/api/continue-processing', async (req, res) => {
    try {
        const { regenerateUrls = false } = req.body || {};
        
        // 先清理可能存在的去重文件
        const dedupedFiles = fs.readdirSync(__dirname)
            .filter(f => f.endsWith('_deduped.txt'));
        
        if (dedupedFiles.length > 0) {
            console.log('🧹 清理残留的去重文件...');
            dedupedFiles.forEach(file => {
                try {
                    fs.unlinkSync(path.join(__dirname, file));
                    console.log(`  删除: ${file}`);
                } catch (e) {
                    console.error(`  无法删除 ${file}: ${e.message}`);
                }
            });
        }
        
        // 如果需要重新生成URL
        if (regenerateUrls) {
            console.log('🔄 重新生成最新URL...');
            
            // 执行URL生成
            const urlGenProcess = spawn('node', ['auto_scrape_three_sites.js', '--all-sites'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            let urlGenOutput = '';
            urlGenProcess.stdout.on('data', (data) => {
                urlGenOutput += data.toString();
                console.log('[URL生成]', data.toString().trim());
            });
            
            urlGenProcess.stderr.on('data', (data) => {
                console.error('[URL生成错误]', data.toString());
            });
            
            await new Promise((resolve) => {
                urlGenProcess.on('close', (code) => {
                    console.log(`URL生成完成，退出码: ${code}`);
                    resolve();
                });
            });
            
            // 等待文件写入完成
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // 检查是否有待处理的URL文件
        const urlFiles = [
            'deep_urls_golf_com.txt',
            'deep_urls_golfmonthly_com.txt',
            'deep_urls_mygolfspy_com.txt',
            'deep_urls_www_golfwrx_com.txt',
            'deep_urls_www_golfdigest_com.txt',
            'deep_urls_todays_golfer_com.txt',
            'deep_urls_golfweek_usatoday_com.txt',
            'deep_urls_nationalclubgolfer_com.txt',
            'deep_urls_skysports_com.txt',
            'deep_urls_www_pgatour_com.txt',
            'deep_urls_golfmagic_com.txt',
            'deep_urls_yardbarker_com.txt',
            'deep_urls_golf_net_cn.txt',
            'deep_urls_si_com.txt',
            'deep_urls_yahoo_golf.txt',
            'deep_urls_espn_golf.txt',
            'deep_urls_lpga_com.txt',
            'deep_urls_cbssports_golf.txt'
        ];
        
        let totalUrls = 0;
        let actualUrlCount = 0;
        for (const file of urlFiles) {
            try {
                const content = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const urls = content.trim().split('\n').filter(line => line.startsWith('http'));
                totalUrls += urls.length;
                if (urls.length > 0) {
                    actualUrlCount++;
                    console.log(`  ${file}: ${urls.length} URLs`);
                }
            } catch (e) {}
        }
        
        if (totalUrls === 0) {
            return res.json({ 
                success: false, 
                message: '没有找到待处理的URL，请先运行URL生成' 
            });
        }
        
        console.log(`📋 找到 ${actualUrlCount} 个URL文件，共 ${totalUrls} 个URL`);
        
        // 立即返回响应
        res.json({ 
            success: true, 
            totalUrls: totalUrls,
            message: regenerateUrls ? `已重新生成URL，准备处理 ${totalUrls} 个URL` : `准备处理 ${totalUrls} 个URL`,
            regenerated: regenerateUrls 
        });
        
        // 异步启动处理器
        setTimeout(() => {
            console.log(`▶️ 继续处理 ${totalUrls} 个URL...`);
            
            // 添加 --continue 参数，智能处理未完成的URL
            const controller = spawn('node', ['intelligent_concurrent_controller.js', '--continue'], {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // 将输出追加到日志文件
            const logStream = fs.createWriteStream('intelligent_controller.log', { flags: 'a' });
            logStream.write(`\n\n========== 继续处理 ${new Date().toISOString()} ==========\n`);
            if (regenerateUrls) {
                logStream.write(`[已重新生成URL]\n`);
            }
            controller.stdout.pipe(logStream);
            controller.stderr.pipe(logStream);
            
            controller.unref();
        }, 100);
        
    } catch (error) {
        console.error('继续处理错误:', error);
        res.json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 处理失败的文章API
app.post('/api/process-failed-urls', async (req, res) => {
    const { spawn } = require('child_process');
    
    try {
        // 启动处理失败URL的进程
        const processor = spawn('node', ['process_failed_urls.js'], {
            detached: true,
            stdio: 'ignore'
        });
        
        processor.unref();
        
        res.json({ 
            success: true, 
            message: '失败文章处理已启动'
        });
        
    } catch (error) {
        console.error('处理失败文章错误:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n👋 服务器正在关闭...');
    process.exit(0);
});

// 启动
startServer();