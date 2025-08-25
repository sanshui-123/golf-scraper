#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const BatchArticleProcessor = require('./batch_process_articles');

class ChromeExtensionProcessor {
    constructor() {
        this.processor = new BatchArticleProcessor();
        this.downloadDir = this.getDownloadDirectory();
    }

    /**
     * 获取默认下载目录
     */
    getDownloadDirectory() {
        const os = require('os');
        const platform = os.platform();
        
        if (platform === 'darwin') {
            return path.join(os.homedir(), 'Downloads');
        } else if (platform === 'win32') {
            return path.join(os.homedir(), 'Downloads');
        } else {
            return path.join(os.homedir(), 'Downloads');
        }
    }

    /**
     * 查找Chrome扩展生成的URL文件
     */
    findExtensionURLFiles() {
        const files = [];
        
        try {
            const downloadFiles = fs.readdirSync(this.downloadDir);
            
            // 查找MyGolfSpy相关的文件
            const patterns = [
                /mygolfspy.*\.json$/i,
                /mygolfspy.*\.txt$/i,
                /mygolfspy_queue.*\.txt$/i
            ];
            
            patterns.forEach(pattern => {
                const matchingFiles = downloadFiles.filter(file => pattern.test(file));
                matchingFiles.forEach(file => {
                    const filePath = path.join(this.downloadDir, file);
                    const stats = fs.statSync(filePath);
                    
                    files.push({
                        path: filePath,
                        name: file,
                        size: stats.size,
                        mtime: stats.mtime,
                        type: file.endsWith('.json') ? 'json' : 'txt'
                    });
                });
            });
            
            // 按修改时间排序，最新的在前
            files.sort((a, b) => b.mtime - a.mtime);
            
        } catch (error) {
            console.warn('⚠️  无法读取下载目录:', error.message);
        }
        
        return files;
    }

    /**
     * 处理Chrome扩展生成的URL文件
     */
    async processExtensionFile(filePath) {
        console.log(`📂 处理Chrome扩展文件: ${filePath}`);
        
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            let urls = [];
            
            if (filePath.endsWith('.json')) {
                // 处理JSON格式的文件
                const data = JSON.parse(fileContent);
                
                if (Array.isArray(data)) {
                    urls = data.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item.url) {
                            return item.url;
                        }
                        return null;
                    }).filter(url => url);
                } else {
                    console.error('❌ JSON文件格式不正确');
                    return false;
                }
            } else {
                // 处理TXT格式的文件
                urls = fileContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line.startsWith('http'));
            }
            
            if (urls.length === 0) {
                console.log('⚠️  文件中没有找到有效的URL');
                return false;
            }
            
            console.log(`📋 发现 ${urls.length} 个URL，开始处理...`);
            
            // 使用现有的批处理逻辑
            const results = await this.processor.processURLs(urls);
            
            // 移动已处理的文件到processed目录
            await this.moveProcessedFile(filePath);
            
            return results;
            
        } catch (error) {
            console.error('❌ 处理文件失败:', error.message);
            return false;
        }
    }

    /**
     * 移动已处理的文件
     */
    async moveProcessedFile(filePath) {
        try {
            const processedDir = path.join(this.downloadDir, 'processed');
            
            if (!fs.existsSync(processedDir)) {
                fs.mkdirSync(processedDir, { recursive: true });
            }
            
            const fileName = path.basename(filePath);
            const newPath = path.join(processedDir, fileName);
            
            fs.renameSync(filePath, newPath);
            console.log(`📁 已移动文件到: ${newPath}`);
            
        } catch (error) {
            console.warn('⚠️  移动文件失败:', error.message);
        }
    }

    /**
     * 自动监控并处理Chrome扩展文件
     */
    async startAutoProcessing() {
        console.log('🔄 开始自动监控Chrome扩展文件...');
        console.log(`📂 监控目录: ${this.downloadDir}`);
        
        // 首先处理现有文件
        const existingFiles = this.findExtensionURLFiles();
        
        if (existingFiles.length > 0) {
            console.log(`📋 发现 ${existingFiles.length} 个现有文件:`);
            existingFiles.forEach(file => {
                console.log(`  - ${file.name} (${(file.size/1024).toFixed(1)}KB)`);
            });
            
            for (const file of existingFiles) {
                console.log(`\n🔄 处理文件: ${file.name}`);
                await this.processExtensionFile(file.path);
            }
        }
        
        // 设置文件监控
        const chokidar = require('chokidar');
        const watcher = chokidar.watch(this.downloadDir, {
            ignored: /processed/,
            persistent: true
        });
        
        watcher.on('add', async (filePath) => {
            const fileName = path.basename(filePath);
            
            if (/mygolfspy.*\.(json|txt)$/i.test(fileName)) {
                console.log(`\n📁 检测到新文件: ${fileName}`);
                
                // 等待文件写入完成
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                await this.processExtensionFile(filePath);
            }
        });
        
        console.log('\n✅ 自动监控已启动');
        console.log('💡 请在Chrome扩展中抓取MyGolfSpy URLs并保存到处理队列');
        console.log('🔄 文件将自动被处理');
    }

    /**
     * 手动处理指定文件
     */
    async processFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.error(`❌ 文件不存在: ${filePath}`);
            return false;
        }
        
        return await this.processExtensionFile(filePath);
    }

    /**
     * 显示使用说明
     */
    showUsage() {
        console.log(`
🚀 MyGolfSpy Chrome扩展处理器使用说明

1. 📦 安装Chrome扩展:
   - 打开Chrome浏览器
   - 访问 chrome://extensions/
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 ${path.join(__dirname, 'chrome_extension')} 目录

2. 🔍 抓取URL:
   - 访问 https://mygolfspy.com
   - 点击Chrome扩展图标
   - 点击"抓取当前页面URLs"
   - 点击"保存到处理队列"

3. 🔄 处理URL:
   - 运行: node chrome_extension_processor.js auto
   - 或手动处理: node chrome_extension_processor.js process <文件路径>

4. 📁 监控目录: ${this.downloadDir}
        `);
    }
}

// 命令行处理
if (require.main === module) {
    const processor = new ChromeExtensionProcessor();
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help') {
        processor.showUsage();
    } else if (args[0] === 'auto') {
        processor.startAutoProcessing();
    } else if (args[0] === 'process' && args[1]) {
        processor.processFile(args[1]);
    } else if (args[0] === 'list') {
        const files = processor.findExtensionURLFiles();
        if (files.length === 0) {
            console.log('📂 下载目录中没有找到MyGolfSpy相关文件');
        } else {
            console.log(`📋 发现 ${files.length} 个文件:`);
            files.forEach(file => {
                console.log(`  - ${file.name} (${(file.size/1024).toFixed(1)}KB) - ${file.mtime.toLocaleString()}`);
            });
        }
    } else {
        console.log('❌ 参数错误');
        processor.showUsage();
    }
}

module.exports = ChromeExtensionProcessor;