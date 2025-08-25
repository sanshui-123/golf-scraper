// fix_article_source.js - 修复文章来源显示问题
const fs = require('fs');
const path = require('path');

class ArticleSourceFixer {
    constructor(dateStr = null) {
        // 允许指定日期，默认为今天
        this.dateStr = dateStr || new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
    }

    /**
     * 从URL提取域名并返回友好的网站名称
     * @param {string} url - 完整URL
     * @returns {string} 网站名称
     */
    getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            
            // 域名到网站名称的映射（与batch_process_articles.js保持一致）
            const siteNames = {
                'golf.com': 'Golf.com',
                'golfmonthly.com': 'Golf Monthly',
                'golfdigest.com': 'Golf Digest',
                'mygolfspy.com': 'MyGolfSpy',
                'golfwrx.com': 'GolfWRX',
                'todays-golfer.com': "Today's Golfer",
                'golfweek.usatoday.com': 'Golfweek',
                'nationalclubgolfer.com': 'National Club Golfer',
                'pgatour.com': 'PGA Tour',
                'skysports.com': 'Sky Sports',
                'dpworldtour.com': 'DP World Tour'
            };
            
            return siteNames[hostname] || hostname;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * 检查并显示文章来源状态
     */
    checkArticleSources() {
        console.log(`🔍 检查 ${this.dateStr} 的文章来源状态...`);
        
        const urlMapFile = path.join(this.baseDir, 'article_urls.json');
        if (!fs.existsSync(urlMapFile)) {
            console.error('❌ article_urls.json 不存在');
            return;
        }

        try {
            const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            const stats = {
                total: 0,
                withSource: 0,
                withoutSource: 0,
                sources: {}
            };

            console.log('\n📊 文章来源分析：');
            console.log('='.repeat(80));
            
            for (const [articleNum, data] of Object.entries(urlMapping)) {
                if (data.url && data.status === 'completed') {
                    stats.total++;
                    const source = this.getDomainFromUrl(data.url);
                    
                    if (source && source !== 'unknown') {
                        stats.withSource++;
                        stats.sources[source] = (stats.sources[source] || 0) + 1;
                        console.log(`✅ 文章 ${articleNum}: ${source} - ${data.url}`);
                    } else {
                        stats.withoutSource++;
                        console.log(`❌ 文章 ${articleNum}: 未知来源 - ${data.url}`);
                    }
                }
            }

            console.log('\n📈 统计汇总：');
            console.log('='.repeat(80));
            console.log(`总文章数: ${stats.total}`);
            console.log(`有来源: ${stats.withSource}`);
            console.log(`无来源: ${stats.withoutSource}`);
            
            console.log('\n📰 各网站文章数量：');
            console.log('-'.repeat(40));
            for (const [source, count] of Object.entries(stats.sources).sort((a, b) => b[1] - a[1])) {
                console.log(`${source}: ${count} 篇`);
            }

            // 提供建议
            console.log('\n💡 建议：');
            if (stats.withoutSource > 0) {
                console.log('- 部分文章显示"未知来源"可能是因为URL格式不正确');
                console.log('- 请检查article_urls.json中的URL是否有效');
            } else {
                console.log('- 所有文章来源都能正确识别！');
            }
            console.log('- Web界面（http://localhost:8080）会自动从URL提取来源信息');
            console.log('- 无需修改文件内容，系统会自动处理');

        } catch (error) {
            console.error('❌ 读取article_urls.json失败:', error.message);
        }
    }

    /**
     * 扫描所有日期的文章
     */
    scanAllDates() {
        console.log('🔍 扫描所有日期的文章来源...\n');
        
        const golfContentDir = path.join(process.cwd(), 'golf_content');
        if (!fs.existsSync(golfContentDir)) {
            console.error('❌ golf_content目录不存在');
            return;
        }

        const dates = fs.readdirSync(golfContentDir)
            .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
            .sort()
            .reverse();

        for (const date of dates) {
            console.log(`\n📅 日期: ${date}`);
            console.log('='.repeat(80));
            const fixer = new ArticleSourceFixer(date);
            fixer.checkArticleSources();
        }
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    let dateStr = null;
    let scanAll = false;
    
    // 解析参数
    args.forEach(arg => {
        if (arg === '--all') {
            scanAll = true;
        } else if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = arg;
        }
    });
    
    if (scanAll) {
        const fixer = new ArticleSourceFixer();
        fixer.scanAllDates();
    } else {
        const fixer = new ArticleSourceFixer(dateStr);
        fixer.checkArticleSources();
    }
}

module.exports = ArticleSourceFixer;