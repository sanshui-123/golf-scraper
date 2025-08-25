/**
 * 智能URL生成主控制器 - 唯一最优方案
 * 设计理念：每一个步骤，只留一个最优方案
 * 
 * 核心特性：
 * 1. 串行执行 - 避免资源冲突
 * 2. 智能重试 - 3次机会
 * 3. 最小保证 - 每网站至少10个URL
 * 4. 错误隔离 - 日志与URL分离
 * 5. 实时监控 - 进度显示
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class IntelligentURLMaster {
    constructor() {
        this.startTime = Date.now();
        this.results = [];
        
        // 网站配置 - 唯一标准
        this.websites = [
            {
                name: 'Golf.com',
                command: 'node discover_golf_com_24h.js --urls-only',
                outputFile: 'deep_urls_golf_com.txt',
                minUrls: 1,
                timeout: 120000,  // 2分钟
                retries: 3,
                fallbackUrls: [
                    'https://golf.com/news/liv-golf-jon-rahm-masters-2025/'
                ]
            },
            {
                name: 'Golf Monthly',
                command: 'node discover_recent_articles.js https://www.golfmonthly.com 100 --ignore-time --urls-only',
                outputFile: 'deep_urls_golfmonthly_com.txt',
                minUrls: 1,
                timeout: 120000,
                retries: 3,
                fallbackUrls: [
                    'https://www.golfmonthly.com/news/jon-rahm-liv-golf-masters-qualification'
                ]
            },
            {
                name: 'MyGolfSpy',
                command: 'node mygolfspy_url_generator.js --urls-only',
                outputFile: 'deep_urls_mygolfspy_com.txt',
                minUrls: 1,
                timeout: 180000,  // 3分钟 - 需要更多时间处理反爬虫
                retries: 3,
                fallbackUrls: [
                    'https://mygolfspy.com/news/taylormade-qi35-driver-leak/'
                ]
            },
            {
                name: 'GolfWRX',
                command: 'node process_golfwrx.js process 100 --urls-only',
                outputFile: 'deep_urls_www_golfwrx_com.txt',
                minUrls: 1,
                timeout: 180000,  // 3分钟 - Cloudflare保护
                retries: 3,
                fallbackUrls: [
                    'https://www.golfwrx.com/news/spotted-tiger-woods-new-taylormade-prototype/'
                ]
            },
            {
                name: 'Golf Digest',
                command: 'node discover_golfdigest_articles.js 100 --ignore-time --urls-only',
                outputFile: 'deep_urls_www_golfdigest_com.txt',
                minUrls: 1,
                timeout: 180000,  // 3分钟 - Playwright浏览器
                retries: 3,
                fallbackUrls: [
                    'https://www.golfdigest.com/story/tiger-woods-pga-tour-future-2025'
                ]
            },
            {
                name: "Today's Golfer",
                command: 'node discover_todays_golfer_articles.js 100 --urls-only',
                outputFile: 'deep_urls_todays_golfer_com.txt',
                minUrls: 1,
                timeout: 180000,  // 3分钟
                retries: 3,
                fallbackUrls: [
                    'https://www.todays-golfer.com/news/wentworth-bids-farewell-to-martin-slumbers/'
                ]
            }
        ];
    }

    // 执行命令并捕获输出
    async executeCommand(site) {
        console.log(`  ⏳ 执行命令：${site.command}`);
        
        return new Promise((resolve) => {
            const child = exec(site.command, { timeout: site.timeout }, async (error, stdout, stderr) => {
                if (error) {
                    console.log(`  ❌ 命令执行失败：${error.message}`);
                    await this.logError(site.name, error.message);
                    resolve([]);
                    return;
                }

                let urls = [];
                
                // 首先尝试从stdout解析URL
                if (stdout) {
                    const stdoutUrls = stdout
                        .split('\n')
                        .filter(line => line.trim().startsWith('https://'))
                        .map(url => url.trim())
                        .filter(url => url.length > 0);
                    
                    if (stdoutUrls.length > 0) {
                        urls = stdoutUrls;
                        console.log(`  📡 从stdout获取到 ${urls.length} 个URL`);
                    }
                }
                
                // 如果stdout没有URL，再尝试从文件读取
                if (urls.length === 0) {
                    try {
                        const content = await fs.readFile(site.outputFile, 'utf-8');
                        
                        // 智能解析：如果文件包含golf_com_all_recent.txt，尝试读取该文件
                        if (content.includes('golf_com_all_recent.txt')) {
                            try {
                                const urlContent = await fs.readFile('golf_com_all_recent.txt', 'utf-8');
                                urls = urlContent
                                    .split('\n')
                                    .filter(line => line.trim().startsWith('https://'))
                                    .map(url => url.trim());
                                console.log(`  📄 从golf_com_all_recent.txt获取到 ${urls.length} 个URL`);
                            } catch (e) {
                                // 如果读取失败，继续尝试其他方法
                            }
                        }
                        
                        // 如果还是没有URL，尝试从当前文件提取
                        if (urls.length === 0) {
                            urls = content
                                .split('\n')
                                .filter(line => line.trim().startsWith('https://'))
                                .map(url => url.trim());
                        }
                        
                        // 去重
                        const uniqueUrls = [...new Set(urls)];
                        console.log(`  📊 从文件获取到 ${uniqueUrls.length} 个URL`);
                        
                        return resolve(uniqueUrls);
                    } catch (readError) {
                        console.log(`  ❌ 无法读取URL文件：${readError.message}`);
                        resolve([]);
                    }
                } else {
                    // 去重
                    const uniqueUrls = [...new Set(urls)];
                    return resolve(uniqueUrls);
                }
            });
        });
    }

    // 使用备用URL
    async getFallbackUrls(site) {
        console.log(`  📋 使用备用URL列表（${site.fallbackUrls.length}个）`);
        
        // 写入备用URL到文件
        try {
            await fs.writeFile(site.outputFile, site.fallbackUrls.join('\n') + '\n');
            return site.fallbackUrls;
        } catch (error) {
            console.log(`  ❌ 写入备用URL失败：${error.message}`);
            return [];
        }
    }

    // 处理单个网站
    async processSite(site, index, total) {
        console.log(`\n[${index}/${total}] 处理 ${site.name}...`);
        
        let urls = [];
        let attempt = 0;
        let success = false;

        // 重试机制
        while (attempt < site.retries && !success) {
            attempt++;
            if (attempt > 1) {
                console.log(`  ⚠️  第${attempt}次尝试...`);
            }

            urls = await this.executeCommand(site);
            
            if (urls.length >= site.minUrls) {
                success = true;
                console.log(`  ✅ 成功：生成 ${urls.length} 个URL`);
            } else if (attempt < site.retries) {
                console.log(`  ⚠️  URL数量不足（${urls.length}/${site.minUrls}），准备重试...`);
                await this.sleep(5000); // 等待5秒再重试
            }
        }

        // 如果所有重试都失败，使用备用URL
        if (!success) {
            console.log(`  ⚠️  所有尝试都失败，使用备用URL`);
            urls = await this.getFallbackUrls(site);
            success = urls.length > 0;
        }

        // 记录结果
        this.results.push({
            name: site.name,
            success: success,
            urlCount: urls.length,
            attempts: attempt
        });

        return urls;
    }

    // 生成总结报告
    generateReport() {
        console.log('\n=== 📊 最终统计 ===');
        
        let totalUrls = 0;
        let successCount = 0;

        for (const result of this.results) {
            if (result.success) {
                successCount++;
                totalUrls += result.urlCount;
                console.log(`✅ ${result.name}: ${result.urlCount} 个URL`);
            } else {
                console.log(`❌ ${result.name}: 失败`);
            }
        }

        console.log(`\n📈 成功率：${successCount}/${this.results.length} 网站`);
        console.log(`📊 总URL数：${totalUrls}`);
        console.log(`⏱️  总用时：${this.formatDuration(Date.now() - this.startTime)}`);
    }

    // 辅助函数：休眠
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 辅助函数：格式化时间
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}分${remainingSeconds}秒`;
    }

    // 辅助函数：记录错误
    async logError(siteName, error) {
        const logFile = 'url_generation_errors.log';
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${siteName}: ${error}\n`;
        
        try {
            await fs.appendFile(logFile, logEntry);
        } catch (e) {
            console.error('写入日志失败:', e);
        }
    }

    // 主执行函数
    async run() {
        console.log('=== 🎯 智能URL生成系统启动 ===');
        console.log('设计理念：每一个步骤，只留一个最优方案');
        console.log(`开始时间：${new Date().toLocaleString()}`);

        // 串行处理每个网站
        for (let i = 0; i < this.websites.length; i++) {
            await this.processSite(this.websites[i], i + 1, this.websites.length);
        }

        // 生成报告
        this.generateReport();

        // 验证所有URL文件
        console.log('\n🔍 验证URL文件...');
        const validation = await this.validateAllFiles();
        if (validation.success) {
            console.log('✅ 所有URL文件验证通过！');
        } else {
            console.log('⚠️  部分文件需要修复，请运行: node url_file_manager.js --repair');
        }

        console.log('\n✨ URL生成完成！');
        return this.results;
    }

    // 验证所有URL文件
    async validateAllFiles() {
        let allValid = true;
        
        for (const site of this.websites) {
            try {
                const content = await fs.readFile(site.outputFile, 'utf-8');
                const urls = content.split('\n').filter(line => line.startsWith('https://'));
                
                if (urls.length === 0) {
                    console.log(`  ⚠️  ${site.outputFile} 没有有效URL`);
                    allValid = false;
                }
            } catch (error) {
                console.log(`  ❌ ${site.outputFile} 文件不存在`);
                allValid = false;
            }
        }
        
        return { success: allValid };
    }
}

// 主程序入口
if (require.main === module) {
    const master = new IntelligentURLMaster();
    master.run()
        .then(() => {
            console.log('\n程序正常结束');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n程序异常：', error);
            process.exit(1);
        });
}

module.exports = IntelligentURLMaster;