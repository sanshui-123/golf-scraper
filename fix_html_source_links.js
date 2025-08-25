#!/usr/bin/env node
// fix_html_source_links.js - 修复HTML文件中的原文链接和来源信息

const fs = require('fs');
const path = require('path');

// 获取今天的日期
const todayDate = new Date().toISOString().split('T')[0];

// 从URL获取友好的网站名称
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        
        const siteNames = {
            'golf.com': 'Golf.com',
            'golfmonthly.com': 'Golf Monthly',
            'golfdigest.com': 'Golf Digest',
            'golfwrx.com': 'GolfWRX',
            'mygolfspy.com': 'MyGolfSpy',
            'golfweek.usatoday.com': 'Golfweek',
            'todays-golfer.com': "Today's Golfer",
            'nationalclubgolfer.com': 'National Club Golfer',
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
        
        return siteNames[hostname] || hostname;
    } catch (e) {
        return 'unknown';
    }
}

// 修复单个HTML文件
function fixHtmlFile(htmlPath, url, mdPath) {
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    let needsFix = false;
    let fixes = [];
    
    // 修复原文链接占位符
    if (htmlContent.includes('href="原文链接"')) {
        htmlContent = htmlContent.replace(
            /href="原文链接"/g,
            `href="${url}"`
        );
        needsFix = true;
        fixes.push('修复原文链接占位符');
    }
    
    // 检查是否缺少查看原文部分
    if (!htmlContent.includes('查看原文') && !htmlContent.includes(url)) {
        // 从MD文件提取作者信息（如果存在）
        let author = '';
        if (mdPath && fs.existsSync(mdPath)) {
            const mdContent = fs.readFileSync(mdPath, 'utf8');
            const authorMatch = mdContent.match(/作者：(.+?)(?:\n|$)/);
            if (authorMatch) {
                author = authorMatch[1].trim();
            }
        }
        
        // 构建源信息HTML
        const sourceInfo = `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #f0f0f0; font-size: 14px; color: #666;">
        <p><a href="${url}" target="_blank" style="color: #1976d2; text-decoration: none;">查看原文</a>${author ? ' | 作者：' + author : ''}</p>
    </div>`;
        
        // 在</body>标签前插入
        if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', sourceInfo + '\n</body>');
            needsFix = true;
            fixes.push('添加查看原文链接');
        } else {
            // 如果没有</body>标签，在末尾添加
            htmlContent += sourceInfo;
            needsFix = true;
            fixes.push('在文件末尾添加查看原文链接');
        }
    }
    
    return { content: htmlContent, needsFix, fixes };
}

// 主函数
function fixArticleSources(dateStr = todayDate) {
    const articleUrlsPath = path.join(__dirname, 'golf_content', dateStr, 'article_urls.json');
    
    if (!fs.existsSync(articleUrlsPath)) {
        console.error(`❌ 找不到 ${dateStr} 的 article_urls.json 文件`);
        return;
    }
    
    console.log(`🔧 开始修复 ${dateStr} 的文章原文链接...`);
    
    try {
        const articleUrls = JSON.parse(fs.readFileSync(articleUrlsPath, 'utf8'));
        const htmlDir = path.join(__dirname, 'golf_content', dateStr, 'wechat_html');
        const mdDir = path.join(__dirname, 'golf_content', dateStr, 'wechat_ready');
        
        if (!fs.existsSync(htmlDir)) {
            console.error('❌ 找不到 wechat_html 目录');
            return;
        }
        
        let fixedCount = 0;
        let totalCount = 0;
        let noUrlCount = 0;
        let skippedCount = 0;
        
        // 遍历所有HTML文件
        const htmlFiles = fs.readdirSync(htmlDir).filter(file => file.endsWith('.html'));
        
        htmlFiles.forEach(file => {
            const articleNumMatch = file.match(/wechat_article_(\d+)\.html/);
            if (!articleNumMatch) return;
            
            const articleNum = articleNumMatch[1];
            const articleInfo = articleUrls[articleNum];
            
            // 跳过没有URL或未完成的文章
            if (!articleInfo || !articleInfo.url) {
                noUrlCount++;
                return;
            }
            
            if (articleInfo.status !== 'completed') {
                skippedCount++;
                return;
            }
            
            totalCount++;
            const htmlPath = path.join(htmlDir, file);
            const mdPath = path.join(mdDir, file.replace('.html', '.md'));
            
            // 修复HTML文件
            const result = fixHtmlFile(htmlPath, articleInfo.url, mdPath);
            
            if (result.needsFix) {
                console.log(`📝 修复文章 ${articleNum}: ${articleInfo.url}`);
                console.log(`   - ${result.fixes.join(', ')}`);
                fs.writeFileSync(htmlPath, result.content, 'utf8');
                fixedCount++;
                
                // 同时修复MD文件（如果存在）
                if (fs.existsSync(mdPath)) {
                    let mdContent = fs.readFileSync(mdPath, 'utf8');
                    if (mdContent.includes('[查看原文](原文链接)')) {
                        mdContent = mdContent.replace(
                            /\[查看原文\]\(原文链接\)/g,
                            `[查看原文](${articleInfo.url})`
                        );
                        fs.writeFileSync(mdPath, mdContent, 'utf8');
                        console.log(`   - 同时修复了MD文件`);
                    }
                }
            }
        });
        
        // 显示统计信息
        console.log(`\n✅ 修复完成！`);
        console.log(`📊 统计信息:`);
        console.log(`   - 总HTML文件数: ${htmlFiles.length}`);
        console.log(`   - 有效文章数: ${totalCount}`);
        console.log(`   - 修复文章数: ${fixedCount}`);
        console.log(`   - 无URL文章数: ${noUrlCount}`);
        console.log(`   - 跳过文章数: ${skippedCount}`);
        
        // 显示文章来源统计
        console.log('\n📈 文章来源统计:');
        const sourceStats = {};
        Object.values(articleUrls).forEach(info => {
            if (info.url && info.status === 'completed') {
                const source = getDomainFromUrl(info.url);
                sourceStats[source] = (sourceStats[source] || 0) + 1;
            }
        });
        
        Object.entries(sourceStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([source, count]) => {
                console.log(`   ${source}: ${count} 篇`);
            });
        
    } catch (error) {
        console.error('❌ 修复过程出错:', error.message);
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    const dateStr = args[0] || todayDate;
    
    console.log('🔧 HTML原文链接修复工具');
    console.log('====================');
    
    if (args.includes('--help')) {
        console.log('\n用法:');
        console.log('  node fix_html_source_links.js          # 修复今天的文章');
        console.log('  node fix_html_source_links.js 2025-08-15  # 修复指定日期的文章');
        console.log('  node fix_html_source_links.js --all    # 修复所有日期的文章');
        process.exit(0);
    }
    
    if (args.includes('--all')) {
        // 修复所有日期
        const golfContentDir = path.join(__dirname, 'golf_content');
        if (fs.existsSync(golfContentDir)) {
            const dates = fs.readdirSync(golfContentDir)
                .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
                .sort();
            
            dates.forEach(date => {
                console.log(`\n📅 处理日期: ${date}`);
                console.log('='.repeat(50));
                fixArticleSources(date);
            });
        }
    } else {
        // 修复单个日期
        fixArticleSources(dateStr);
    }
}

module.exports = { fixArticleSources, getDomainFromUrl };