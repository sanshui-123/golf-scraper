#!/usr/bin/env node

/**
 * 自动抓取高尔夫网站的所有未处理文章
 * 完全自动化，无需用户确认
 * 支持网站：Golf.com, Golf Monthly, MyGolfSpy, GolfWRX, Golf Digest, Today's Golfer, Golfweek, National Club Golfer, PGA Tour, Sky Sports Golf, Golf Magic, Yardbarker Golf, 中国高尔夫网, Sports Illustrated Golf, Yahoo Sports Golf, ESPN Golf, LPGA, CBS Sports Golf
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const UnifiedHistoryDatabase = require('./unified_history_database');

// 网站配置
const siteConfigs = {
    'golf.com': {
        name: 'Golf.com',
        script: 'discover_golf_com_24h.js',  // 使用专用脚本：扫描多个分类页面
        args: ['50', '--urls-only'],  // 增加数量限制到50篇
        skipIfError: true  // 如果出错可以跳过，继续处理其他网站
        // 注意：Golf.com必须使用专用脚本，通用脚本只能抓到6篇，专用脚本能抓到16篇
    },
    'golfmonthly.com': {
        name: 'Golf Monthly',
        script: 'discover_recent_articles.js',  // 使用通用脚本：工作正常，能抓到20+篇
        args: ['https://www.golfmonthly.com', '30', '--urls-only']  // 适当增加数量
        // 注意：Golf Monthly使用通用脚本效果很好，不要改用专用脚本
    },
    'mygolfspy.com': {
        name: 'MyGolfSpy',
        script: 'mygolfspy_url_generator.js',  // 恢复使用URL生成器（能获取47+个URL）
        args: ['--urls-only'],  // URL生成阶段不会触发403
        // 📡 注意：文章处理时将自动使用RSS模式，避免403错误
    },
    'golfwrx.com': {
        name: 'GolfWRX',
        script: 'golfwrx_rss_url_generator.js',  // 使用RSS方案，绕过Cloudflare
        args: ['20', '--urls-only'],  // RSS通常只有最新20篇
        skipIfError: true  // 可能有Cloudflare保护，允许跳过
    },
    'golfdigest.com': {
        name: 'Golf Digest',
        script: 'golfdigest_smart_generator.js',  // 使用智能版，混合策略
        args: ['50', '--urls-only'],  // 增加到50篇文章
        skipIfError: true  // 新站点，允许跳过错误
    },
    'todays-golfer.com': {
        name: "Today's Golfer",
        script: 'discover_todays_golfer_articles.js',  // 使用专门的抓取器
        args: ['100', '--urls-only'],  // 抓取100篇文章
        skipIfError: true  // 允许跳过错误
    },
    'golfweek.usatoday.com': {
        name: 'Golfweek (USA Today)',
        script: 'discover_golfweek_articles.js',  // 使用专用抓取脚本
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'nationalclubgolfer.com': {
        name: 'National Club Golfer',
        script: 'discover_nationalclubgolfer_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'www.pgatour.com': {
        name: 'PGA Tour',
        script: 'discover_pgatour_articles.js',  // 使用专门的抓取器
        args: ['100', '--urls-only'],  // 抓取100篇文章
        skipIfError: true  // 允许跳过错误
    },
    'skysports.com': {
        name: 'Sky Sports Golf',
        script: 'discover_skysports_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'golfmagic.com': {
        name: 'Golf Magic',
        script: 'discover_golfmagic_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'yardbarker.com': {
        name: 'Yardbarker Golf',
        script: 'discover_yardbarker_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'golf.net.cn': {
        name: '中国高尔夫网',
        script: 'discover_golfnet_cn_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'si.com': {
        name: 'Sports Illustrated Golf',
        script: 'discover_si_golf_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'sports.yahoo.com': {
        name: 'Yahoo Sports Golf',
        script: 'discover_yahoo_golf_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'espn.com': {
        name: 'ESPN Golf',
        script: 'discover_espn_golf_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'lpga.com': {
        name: 'LPGA',
        script: 'discover_lpga_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    },
    'cbssports.com': {
        name: 'CBS Sports Golf',
        script: 'discover_cbssports_golf_articles.js',  // 使用专门的抓取器
        args: ['50', '--urls-only'],  // 抓取50篇文章
        skipIfError: true  // 允许跳过错误
    }
};

// 统计信息
let totalStats = {
    totalArticles: 0,
    newArticles: 0,
    processedArticles: 0,
    failedArticles: 0,
    sites: {}
};

// 运行单个网站抓取
async function runSiteScript(siteName, config) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🌐 正在抓取 ${config.name} (${siteName})...`);
        console.log(`${'='.repeat(70)}`);
        
        const startTime = Date.now();
        let output = '';
        
        const child = spawn('node', [config.script, ...config.args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        // 收集输出
        child.stdout.on('data', (data) => {
            const text = data.toString();
            console.log(text);
            output += text;
        });
        
        child.stderr.on('data', (data) => {
            const text = data.toString();
            console.error(text);
            output += text;
        });
        
        child.on('close', (code) => {
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            
            // 解析输出统计信息
            const siteStats = parseSiteOutput(output, siteName);
            totalStats.sites[siteName] = {
                ...siteStats,
                duration: duration,
                exitCode: code
            };
            
            if (code === 0) {
                console.log(`\n✅ ${config.name} 抓取完成！耗时: ${duration}秒`);
                console.log(`   📊 新文章: ${siteStats.newArticles || 0} 篇`);
                console.log(`   ✅ 处理成功: ${siteStats.processedArticles || 0} 篇`);
                console.log(`   ❌ 处理失败: ${siteStats.failedArticles || 0} 篇`);
            } else {
                console.log(`\n❌ ${config.name} 抓取失败，退出码: ${code}`);
                if (config.skipIfError) {
                    console.log(`   ⚠️ 已配置跳过错误，将继续处理其他网站`);
                }
            }
            
            resolve();
        });
        
        child.on('error', (err) => {
            console.error(`\n❌ ${config.name} 执行错误:`, err);
            resolve();
        });
    });
}

// 🚀 并行URL发现：同时从所有网站发现文章（带重试机制）
async function discoverUrlsFromAllSites(sitesToProcess) {
    console.log(`\n🎯 阶段1: 并行URL发现（${sitesToProcess.length}个网站）`);
    console.log('='.repeat(70));
    
    const discoveryPromises = sitesToProcess.map(async (siteName) => {
        const config = siteConfigs[siteName];
        const maxRetries = 3;
        let lastError = null;
        
        // 重试逻辑
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const startTime = Date.now();
            
            try {
                if (attempt === 1) {
                    console.log(`🔍 开始发现 ${config.name} URLs...`);
                } else {
                    console.log(`🔄 重试 ${config.name} (第${attempt}/${maxRetries}次)...`);
                }
                
                // 修改参数：只发现URL，不处理文章
                const discoveryArgs = [...config.args.filter(arg => !arg.includes('--auto-process')), '--urls-only'];
                
                const result = await new Promise((resolve) => {
                    let output = '';
                    const child = spawn('node', [config.script, ...discoveryArgs], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        cwd: __dirname
                    });
                    
                    child.stdout.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    child.stderr.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    child.on('close', (code) => {
                        const duration = Math.round((Date.now() - startTime) / 1000);
                        
                        if (code === 0) {
                            // 从输出中提取URL列表（增强版：支持文件回退）
                            const urls = extractUrlsFromOutput(output, siteName);
                            console.log(`✅ ${config.name}: 发现 ${urls.length} 个URL (${duration}秒)`);
                            resolve({
                                siteName,
                                success: true,
                                urls,
                                duration,
                                output,
                                attempts: attempt
                            });
                        } else {
                            resolve({
                                siteName,
                                success: false,
                                urls: [],
                                duration,
                                error: `Exit code: ${code}`,
                                attempts: attempt
                            });
                        }
                    });
                    
                    child.on('error', (error) => {
                        resolve({
                            siteName,
                            success: false,
                            urls: [],
                            duration: 0,
                            error: error.message,
                            attempts: attempt
                        });
                    });
                });
                
                // 如果成功，返回结果
                if (result.success && result.urls.length > 0) {
                    return result;
                }
                
                // 记录最后的错误
                lastError = result.error;
                
                // 如果不是最后一次尝试，等待2秒后重试
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                lastError = error.message;
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        // 所有重试都失败
        console.log(`❌ ${config.name}: URL发现失败（重试${maxRetries}次后）`);
        return {
            siteName,
            success: false,
            urls: [],
            duration: 0,
            error: lastError || 'Unknown error',
            attempts: maxRetries
        };
    });
    
    // 等待所有网站的URL发现完成
    const results = await Promise.allSettled(discoveryPromises);
    
    // 整理结果
    const discoveryResults = results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                siteName: 'unknown',
                success: false,
                urls: [],
                duration: 0,
                error: result.reason?.message || 'Unknown error',
                attempts: 1
            };
        }
    });
    
    // 显示统计汇总
    displayUrlDiscoveryStats(discoveryResults);
    
    return discoveryResults;
}

// 📊 显示URL发现统计
function displayUrlDiscoveryStats(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 URL发现统计汇总');
    console.log('='.repeat(70));
    
    let totalUrls = 0;
    let successfulSites = 0;
    let failedSites = [];
    let sitesWithRetries = [];
    
    results.forEach(result => {
        if (result.success) {
            totalUrls += result.urls.length;
            successfulSites++;
            if (result.attempts > 1) {
                sitesWithRetries.push(`${result.siteName}(${result.attempts}次)`);
            }
        } else {
            failedSites.push(result.siteName);
        }
    });
    
    console.log(`✅ 成功: ${successfulSites}/${results.length} 个网站`);
    console.log(`📝 总URL数: ${totalUrls} 个`);
    console.log(`📊 平均每网站: ${Math.round(totalUrls / successfulSites)} 个URL`);
    
    if (sitesWithRetries.length > 0) {
        console.log(`🔄 需要重试的网站: ${sitesWithRetries.join(', ')}`);
    }
    
    if (failedSites.length > 0) {
        console.log(`❌ 失败的网站: ${failedSites.join(', ')}`);
        console.log(`💡 建议: 可以单独运行失败网站的脚本进行调试`);
    }
    
    console.log('='.repeat(70));
}

// 📝 从输出中提取URL列表 - 增强版：支持文件回退
function extractUrlsFromOutput(output, siteName = '') {
    const urls = [];
    const lines = output.split('\n');
    
    // 方式1：从stdout解析URL（保持向后兼容）
    for (const line of lines) {
        const trimmed = line.trim();
        // 匹配HTTP/HTTPS URL
        if (trimmed.match(/^https?:\/\/.+/)) {
            urls.push(trimmed);
        }
    }
    
    // 方式2：如果stdout没有URL，尝试读取URL文件（文件优先架构）
    if (urls.length === 0 && siteName) {
        console.log(`📁 stdout未发现URL，尝试读取${siteName}的URL文件...`);
        const urlFile = getUrlFileName(siteName);
        if (urlFile && fs.existsSync(urlFile)) {
            try {
                const fileContent = fs.readFileSync(urlFile, 'utf8');
                const fileUrls = fileContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line.match(/^https?:\/\/.+/));
                
                console.log(`✅ 从文件${urlFile}读取到${fileUrls.length}个URL`);
                urls.push(...fileUrls);
            } catch (error) {
                console.log(`⚠️  读取URL文件失败: ${error.message}`);
            }
        }
    }
    
    // 方式3：如果URL数量为0，使用备用URL
    if (urls.length === 0 && fallbackUrls[siteName]) {
        console.log(`⚠️  ${siteName}的URL生成失败（0个），使用1个备用URL...`);
        const backupUrls = fallbackUrls[siteName];
        urls.push(...backupUrls);
        console.log(`✅ 添加了${backupUrls.length}个备用URL，总计${urls.length}个URL`);
        console.log(`⚠️  请注意：${siteName}可能存在问题，需要检查`);
    }
    
    return urls;
}

// 📁 获取网站对应的URL文件名（标准化映射）
function getUrlFileName(siteName) {
    const urlFileMap = {
        'golf.com': 'deep_urls_golf_com.txt',
        'golfmonthly.com': 'deep_urls_golfmonthly_com.txt', 
        'mygolfspy.com': 'deep_urls_mygolfspy_com.txt',
        'golfwrx.com': 'deep_urls_www_golfwrx_com.txt',
        'golfdigest.com': 'deep_urls_www_golfdigest_com.txt',
        'todays-golfer.com': 'deep_urls_todays_golfer_com.txt',
        'golfweek.usatoday.com': 'deep_urls_golfweek_usatoday_com.txt',
        'nationalclubgolfer.com': 'deep_urls_nationalclubgolfer_com.txt',
        'www.pgatour.com': 'deep_urls_www_pgatour_com.txt',
        'skysports.com': 'deep_urls_skysports_com.txt',
        'golfmagic.com': 'deep_urls_golfmagic_com.txt',
        'yardbarker.com': 'deep_urls_yardbarker_com.txt',
        'golf.net.cn': 'deep_urls_golf_net_cn.txt',
        'si.com': 'deep_urls_si_com.txt',
        'lpga.com': 'deep_urls_lpga_com.txt'
    };
    
    return urlFileMap[siteName] || null;
}

// 🎯 备用URL配置 - 当URL生成失败时使用
// 只保留1个URL，这样抓取失败时用户能明显看出问题
const fallbackUrls = {
    'golfwrx.com': [
        'https://www.golfwrx.com/news/spotted-tiger-woods-new-taylormade-prototype/'
    ],
    'golfdigest.com': [
        'https://www.golfdigest.com/story/tiger-woods-pga-tour-future-2025'
    ],
    'mygolfspy.com': [
        'https://mygolfspy.com/buyers-guide/can-a-129-putter-really-compete-with-a-scotty-cameron/'
    ],
    'yardbarker.com': [
        'https://www.yardbarker.com/golf/articles/scottie_scheffler_rory_mcilroy_paired_again_at_tour_championship/s1_17051_42605616'
    ],
    'golf.net.cn': [
        'https://www.golf.net.cn/zhishi/5414.html'
    ],
    'si.com': [
        'https://www.si.com/golf/news/scottie-scheffler-pga-tour-fedex-cup-playoffs-2025'
    ]
}

// 🎯 智能URL合并和去重
function consolidateUrls(discoveryResults) {
    console.log(`\n🎯 阶段2: 智能URL整合和优先级排序`);
    console.log('='.repeat(70));
    
    // 初始化历史数据库
    const historyDB = new UnifiedHistoryDatabase();
    console.log('📚 加载历史数据库进行去重检查...');
    
    const allUrls = [];
    const urlMap = new Map(); // 用于去重
    let duplicateCount = 0;
    let newUrlCount = 0;
    
    discoveryResults.forEach(result => {
        if (result.success && result.urls.length > 0) {
            result.urls.forEach(url => {
                if (!urlMap.has(url)) {
                    // 检查历史数据库
                    const processedRecord = historyDB.isUrlProcessed(url);
                    if (processedRecord) {
                        duplicateCount++;
                        // 减少日志输出，只在DEBUG模式下显示
                        if (process.env.DEBUG_DEDUP) {
                            console.log(`  ⏭️  跳过已处理: ${url.substring(0, 80)}...`);
                        }
                    } else {
                        // 新URL，添加到处理队列
                        urlMap.set(url, {
                            url,
                            source: result.siteName,
                            priority: getSitePriority(result.siteName),
                            discoveredAt: new Date().toISOString()
                        });
                        allUrls.push(urlMap.get(url));
                        newUrlCount++;
                    }
                }
            });
        }
    });
    
    // 按优先级和网站分布排序
    allUrls.sort((a, b) => {
        // 首先按优先级排序
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        // 相同优先级按网站名排序，确保网站间的平衡
        return a.source.localeCompare(b.source);
    });
    
    console.log(`\n📊 URL整合结果:`);
    console.log(`  🔍 发现重复URL: ${duplicateCount} 篇（已自动过滤）`);
    console.log(`  ✨ 新发现URL: ${newUrlCount} 篇`);
    
    const siteStats = {};
    allUrls.forEach(item => {
        siteStats[item.source] = (siteStats[item.source] || 0) + 1;
    });
    
    console.log(`\n📊 各网站新文章分布:`);
    Object.entries(siteStats).forEach(([site, count]) => {
        const config = Object.values(siteConfigs).find(c => c.name.toLowerCase().includes(site.replace('.com', '')));
        console.log(`  📌 ${config?.name || site}: ${count} 篇新文章`);
    });
    
    console.log(`  🎯 总计: ${allUrls.length} 篇新文章待处理`);
    
    return allUrls;
}

// 🏆 网站优先级评分
function getSitePriority(siteName) {
    const priorities = {
        'golf.com': 5,
        'golfmonthly.com': 4,
        'mygolfspy.com': 3,
        'golfwrx.com': 4,
        'golfdigest.com': 5
    };
    return priorities[siteName] || 3;
}

// 🔄 串行文章处理：统一队列逐个处理
async function processArticlesSerially(consolidatedUrls) {
    console.log(`\n🎯 阶段3: 串行文章处理（${consolidatedUrls.length}篇）`);
    console.log('='.repeat(70));
    
    if (consolidatedUrls.length === 0) {
        console.log('📝 没有新文章需要处理');
        return { processed: 0, failed: 0 };
    }
    
    // 创建临时URL文件
    const tempUrlFile = path.join(__dirname, `temp_batch_${Date.now()}.txt`);
    const urlList = consolidatedUrls.map(item => item.url).join('\n');
    fs.writeFileSync(tempUrlFile, urlList, 'utf8');
    
    console.log(`📄 已创建批处理文件: ${path.basename(tempUrlFile)}`);
    console.log(`🚀 开始串行处理...`);
    
    try {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let output = '';
            
            const child = spawn('node', ['intelligent_concurrent_controller.js', tempUrlFile], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
            });
            
            child.stdout.on('data', (data) => {
                const text = data.toString();
                console.log(text);
                output += text;
            });
            
            child.stderr.on('data', (data) => {
                const text = data.toString();
                console.error(text);
                output += text;
            });
            
            child.on('close', (code) => {
                const duration = Math.round((Date.now() - startTime) / 1000);
                
                // 清理临时文件
                try {
                    fs.unlinkSync(tempUrlFile);
                } catch (e) {
                    // 忽略清理错误
                }
                
                // 解析处理结果
                const stats = parseBatchOutput(output);
                
                console.log(`\n🎉 串行处理完成！耗时: ${duration}秒`);
                console.log(`   ✅ 成功处理: ${stats.processed || 0} 篇`);
                console.log(`   ❌ 处理失败: ${stats.failed || 0} 篇`);
                
                resolve({
                    success: code === 0,
                    processed: stats.processed || 0,
                    failed: stats.failed || 0,
                    duration,
                    exitCode: code
                });
            });
            
            child.on('error', (error) => {
                console.error(`❌ 批处理启动失败:`, error.message);
                // 清理临时文件
                try {
                    fs.unlinkSync(tempUrlFile);
                } catch (e) {
                    // 忽略清理错误
                }
                resolve({
                    success: false,
                    processed: 0,
                    failed: consolidatedUrls.length,
                    duration: 0,
                    error: error.message
                });
            });
        });
    } catch (error) {
        // 清理临时文件
        try {
            fs.unlinkSync(tempUrlFile);
        } catch (e) {
            // 忽略清理错误
        }
        throw error;
    }
}

// 📊 解析批处理输出
function parseBatchOutput(output) {
    const stats = { processed: 0, failed: 0 };
    
    // 查找成功处理的数量
    const processedMatch = output.match(/成功处理[：:]\s*(\d+)/i) || output.match(/处理完成[：:]\s*(\d+)/i);
    if (processedMatch) {
        stats.processed = parseInt(processedMatch[1]) || 0;
    }
    
    // 查找失败的数量
    const failedMatch = output.match(/处理失败[：:]\s*(\d+)/i) || output.match(/失败[：:]\s*(\d+)/i);
    if (failedMatch) {
        stats.failed = parseInt(failedMatch[1]) || 0;
    }
    
    return stats;
}

// 解析网站输出，提取统计信息
function parseSiteOutput(output, siteName) {
    const stats = {
        newArticles: 0,
        processedArticles: 0,
        failedArticles: 0
    };
    
    // 提取统计信息
    if (siteName === 'mygolfspy.com') {
        // MyGolfSpy的输出格式
        const successMatch = output.match(/成功处理: (\d+)\/\d+ 篇/);
        if (successMatch) {
            stats.processedArticles = parseInt(successMatch[1]);
        }
        
        const newMatch = output.match(/将处理 (\d+) 个新URL/);
        if (newMatch) {
            stats.newArticles = parseInt(newMatch[1]);
        }
        
        const failMatch = output.match(/(\d+) 篇文章改写失败/);
        if (failMatch) {
            stats.failedArticles = parseInt(failMatch[1]);
        }
    } else {
        // Golf.com 和 GolfMonthly的输出格式
        const totalMatch = output.match(/总计发现 (\d+) 篇新文章/);
        if (totalMatch) {
            stats.newArticles = parseInt(totalMatch[1]);
        }
        
        const processMatch = output.match(/成功处理: (\d+)\/\d+ 篇/);
        if (processMatch) {
            stats.processedArticles = parseInt(processMatch[1]);
        }
        
        const failMatch = output.match(/(\d+) 篇文章改写失败/);
        if (failMatch) {
            stats.failedArticles = parseInt(failMatch[1]);
        }
    }
    
    return stats;
}

// 显示最终统计
function showFinalStats(siteCount) {
    console.log('\n\n' + '='.repeat(70));
    console.log(`🎯 ${siteCount}个网站抓取完成！最终统计报告`);
    console.log('='.repeat(70));
    
    let totalNew = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    // 计算总计
    Object.entries(totalStats.sites).forEach(([siteName, stats]) => {
        const config = siteConfigs[siteName];
        console.log(`\n📊 ${config.name}:`);
        console.log(`   ⏱️  耗时: ${stats.duration}秒`);
        console.log(`   🆕 新文章: ${stats.newArticles || 0} 篇`);
        console.log(`   ✅ 处理成功: ${stats.processedArticles || 0} 篇`);
        console.log(`   ❌ 处理失败: ${stats.failedArticles || 0} 篇`);
        console.log(`   📈 退出码: ${stats.exitCode}`);
        
        totalNew += stats.newArticles || 0;
        totalProcessed += stats.processedArticles || 0;
        totalFailed += stats.failedArticles || 0;
        totalDuration += stats.duration || 0;
    });
    
    console.log(`\n📈 总计统计:`);
    console.log(`   🆕 总新文章: ${totalNew} 篇`);
    console.log(`   ✅ 总处理成功: ${totalProcessed} 篇`);
    console.log(`   ❌ 总处理失败: ${totalFailed} 篇`);
    console.log(`   ⏱️  总耗时: ${Math.round(totalDuration / 60)}分${totalDuration % 60}秒`);
    
    // 成功率计算
    const totalAttempted = totalProcessed + totalFailed;
    if (totalAttempted > 0) {
        const successRate = ((totalProcessed / totalAttempted) * 100).toFixed(1);
        console.log(`   📊 成功率: ${successRate}%`);
    }
    
    console.log(`\n🌐 Web界面: http://localhost:8080`);
    console.log('='.repeat(70));
}

// 主函数
async function main() {
    // 检查命令行参数
    const args = process.argv.slice(2);
    const includeGolfWRX = args.includes('--include-golfwrx') || args.includes('--four-sites');
    const includeGolfDigest = args.includes('--include-golfdigest') || args.includes('--five-sites');
    const includeAll = args.includes('--all-sites');
    
    // 动态设置要处理的网站
    let sitesToProcess = ['golf.com', 'golfmonthly.com', 'mygolfspy.com'];
    
    if (includeAll) {
        // 包含所有网站
        sitesToProcess.push('golfwrx.com');
        sitesToProcess.push('golfdigest.com');
        sitesToProcess.push('todays-golfer.com');
        sitesToProcess.push('golfweek.usatoday.com');
        sitesToProcess.push('nationalclubgolfer.com');
        sitesToProcess.push('skysports.com');
        sitesToProcess.push('www.pgatour.com');
        sitesToProcess.push('golfmagic.com');
        sitesToProcess.push('yardbarker.com');
        sitesToProcess.push('golf.net.cn');
        sitesToProcess.push('si.com');
        sitesToProcess.push('sports.yahoo.com');
        sitesToProcess.push('espn.com');
        sitesToProcess.push('lpga.com');
    } else {
        // 根据参数添加网站
        if (includeGolfWRX) {
            sitesToProcess.push('golfwrx.com');
        }
        if (includeGolfDigest) {
            sitesToProcess.push('golfdigest.com');
        }
    }
    
    const numberWords = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
    const siteCount = numberWords[sitesToProcess.length] || sitesToProcess.length;
    const siteNames = sitesToProcess.map(site => siteConfigs[site].name).join(', ');
    
    console.log(`🚀 增强版并行抓取系统启动 - 处理${siteCount}个网站`);
    console.log(`📌 网站列表: ${siteNames}`);
    console.log('🎯 并行URL发现 + 串行文章处理架构');
    console.log('🤖 完全自动化模式 - 无需用户确认');
    
    // 显示启用的额外网站
    if (includeAll) {
        console.log('📢 包含所有网站（使用 --all-sites 参数）');
    } else {
        if (includeGolfWRX) {
            console.log('📢 包含GolfWRX网站（使用 --include-golfwrx 参数）');
        }
        if (includeGolfDigest) {
            console.log('📢 包含Golf Digest网站（使用 --include-golfdigest 参数）');
        }
        
        // 提示可用参数
        const tips = [];
        if (!includeGolfWRX) {
            tips.push('--include-golfwrx (包含GolfWRX)');
        }
        if (!includeGolfDigest) {
            tips.push('--include-golfdigest (包含Golf Digest)');
        }
        if (tips.length > 0) {
            console.log(`💡 提示：可用参数 ${tips.join(', ')}`);
            console.log('        或使用 --all-sites 包含所有网站');
        }
    }
    console.log();
    
    // 尝试加载网站配置
    let siteConfigOverride = {};
    try {
        siteConfigOverride = JSON.parse(fs.readFileSync(path.join(__dirname, 'site_config.json'), 'utf8'));
        console.log('📋 已加载网站配置文件\n');
    } catch (e) {
        console.log('📋 使用默认网站配置\n');
    }
    
    const startTime = Date.now();
    
    // 🚀 新架构：并行URL发现 + 串行文章处理
    console.log('🎯 使用混合并行架构：URL发现并行，文章处理串行\n');
    
    // 过滤启用的网站
    const enabledSites = sitesToProcess.filter(siteName => {
        if (siteConfigOverride.enabledSites && siteConfigOverride.enabledSites[siteName] === false) {
            console.log(`⏭️ 跳过 ${siteConfigs[siteName].name} (已在配置中禁用)`);
            return false;
        }
        return true;
    });
    
    if (enabledSites.length === 0) {
        console.log('❌ 没有启用的网站需要处理');
        return;
    }
    
    try {
        // 阶段1: 并行URL发现
        const discoveryResults = await discoverUrlsFromAllSites(enabledSites);
        
        // 更新统计信息
        discoveryResults.forEach(result => {
            totalStats.sites[result.siteName] = {
                duration: result.duration,
                exitCode: result.success ? 0 : 1,
                discoveredUrls: result.urls.length,
                success: result.success
            };
        });
        
        // 阶段2: 智能URL整合
        const consolidatedUrls = consolidateUrls(discoveryResults);
        
        // 阶段3: 串行文章处理
        if (consolidatedUrls.length > 0) {
            const processingResult = await processArticlesSerially(consolidatedUrls);
            
            // 更新全局统计
            totalStats.newArticles = consolidatedUrls.length;
            totalStats.processedArticles = processingResult.processed;
            totalStats.failedArticles = processingResult.failed;
        } else {
            console.log('\n📝 所有网站都没有发现新文章');
        }
        
    } catch (error) {
        console.error('❌ 混合架构处理过程中出现错误:', error.message);
        
        // 如果新架构失败，回退到传统串行模式
        console.log('\n🔄 回退到传统串行处理模式...');
        
        for (let i = 0; i < enabledSites.length; i++) {
            const siteName = enabledSites[i];
            const config = siteConfigs[siteName];
            
            await runSiteScript(siteName, config);
            
            // 每个网站处理完后等待3秒，避免编号冲突（最后一个网站不需要等待）
            if (i < enabledSites.length - 1) {
                console.log('\n⏳ 等待3秒后处理下一个网站...\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    
    const endTime = Date.now();
    const totalDuration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n⏱️  总执行时间: ${Math.round(totalDuration / 60)}分${totalDuration % 60}秒`);
    
    // 显示最终统计
    showFinalStats(siteCount);
    
    console.log('\n✨ 抓取任务完成！');
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };