// fix_article_url.js - 修复文章原文链接问题
const fs = require('fs');
const path = require('path');

class ArticleUrlFixer {
    constructor(dateStr = null) {
        // 允许指定日期，默认为今天
        this.dateStr = dateStr || new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
    }

    // 修复指定文章的URL
    fixArticleUrl(articleNum) {
        try {
            // 读取URL映射
            const urlMapFile = path.join(this.baseDir, 'article_urls.json');
            if (!fs.existsSync(urlMapFile)) {
                console.error('❌ article_urls.json 不存在');
                return false;
            }

            const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            const articleData = urlMapping[articleNum];
            
            if (!articleData || !articleData.url) {
                console.error(`❌ 文章 ${articleNum} 的URL映射不存在`);
                return false;
            }

            const correctUrl = articleData.url;
            console.log(`✅ 找到文章 ${articleNum} 的正确URL: ${correctUrl}`);

            // 修复Markdown文件
            const mdFile = path.join(this.baseDir, 'wechat_ready', `wechat_article_${articleNum}.md`);
            if (fs.existsSync(mdFile)) {
                let mdContent = fs.readFileSync(mdFile, 'utf8');
                // 替换错误的URL - 扩展更多可能的格式
                const mdPatterns = [
                    /\[查看原文\]\(原文URL未提供\)/g,
                    /\[查看原文\]\(原文链接未提供\)/g,
                    /\[查看原文\]\(原文URL链接\)/g,
                    /\[查看原文\]\(原文URL\)/g,
                    /\[查看原文\]\(原文链接\)/g,
                    /\[查看原文\]\(undefined\)/g,
                    /\[查看原文\]\(null\)/g,
                    /\[查看原文\]\(无原文链接\)/g
                ];
                
                mdPatterns.forEach(pattern => {
                    mdContent = mdContent.replace(pattern, `[查看原文](${correctUrl})`);
                });
                
                fs.writeFileSync(mdFile, mdContent, 'utf8');
                console.log(`✅ 已修复 Markdown 文件`);
            }

            // 修复HTML文件
            const htmlFile = path.join(this.baseDir, 'wechat_html', `wechat_article_${articleNum}.html`);
            if (fs.existsSync(htmlFile)) {
                let htmlContent = fs.readFileSync(htmlFile, 'utf8');
                // 替换错误的URL - 扩展更多可能的格式
                const htmlPatterns = [
                    /<a href="原文URL未提供" target="_blank">查看原文<\/a>/g,
                    /<a href="原文链接未提供" target="_blank">查看原文<\/a>/g,
                    /<a href="原文URL链接" target="_blank">查看原文<\/a>/g,
                    /<a href="原文URL" target="_blank">查看原文<\/a>/g,
                    /<a href="原文链接" target="_blank">查看原文<\/a>/g,
                    /<a href="undefined" target="_blank">查看原文<\/a>/g,
                    /<a href="null" target="_blank">查看原文<\/a>/g,
                    /<a href="无原文链接" target="_blank">查看原文<\/a>/g
                ];
                
                htmlPatterns.forEach(pattern => {
                    htmlContent = htmlContent.replace(pattern, 
                        `<a href="${correctUrl}" target="_blank">查看原文</a>`);
                });
                
                fs.writeFileSync(htmlFile, htmlContent, 'utf8');
                console.log(`✅ 已修复 HTML 文件`);
            }

            return true;
        } catch (error) {
            console.error(`❌ 修复文章 ${articleNum} 时出错:`, error.message);
            return false;
        }
    }

    // 扫描并修复所有有问题的文章
    fixAllBrokenUrls() {
        console.log(`🔍 扫描 ${this.dateStr} 的文章...`);
        
        const htmlDir = path.join(this.baseDir, 'wechat_html');
        if (!fs.existsSync(htmlDir)) {
            console.error('❌ HTML目录不存在');
            return;
        }

        const files = fs.readdirSync(htmlDir).filter(file => file.endsWith('.html'));
        let brokenCount = 0;
        let fixedCount = 0;

        for (const file of files) {
            const filePath = path.join(htmlDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 检查多种格式的错误URL
            const errorPatterns = [
                '原文URL未提供',
                '原文链接未提供',
                'href="原文URL链接"',
                'href="原文URL"',
                'href="原文链接"',
                'href="undefined"',
                'href="null"',
                'href="无原文链接"'
            ];
            
            const hasError = errorPatterns.some(pattern => content.includes(pattern));
            
            if (hasError) {
                brokenCount++;
                const match = file.match(/wechat_article_(\d+)\.html/);
                if (match) {
                    const articleNum = match[1];
                    console.log(`\n🔧 修复文章 ${articleNum}...`);
                    if (this.fixArticleUrl(articleNum)) {
                        fixedCount++;
                    }
                }
            }
        }

        console.log(`\n📊 扫描完成:`);
        console.log(`   - 总文章数: ${files.length}`);
        console.log(`   - 有问题的文章: ${brokenCount}`);
        console.log(`   - 成功修复: ${fixedCount}`);
    }
}

// 命令行执行
if (require.main === module) {
    const args = process.argv.slice(2);
    let dateStr = null;
    let articleNum = null;
    
    // 解析参数
    args.forEach(arg => {
        if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = arg;
        } else if (arg.match(/^\d+$/)) {
            articleNum = arg;
        }
    });
    
    const fixer = new ArticleUrlFixer(dateStr);
    
    if (articleNum) {
        // 修复指定文章
        console.log(`🔧 修复文章 ${articleNum}...`);
        fixer.fixArticleUrl(articleNum);
    } else {
        // 扫描并修复所有文章
        fixer.fixAllBrokenUrls();
    }
}

module.exports = ArticleUrlFixer;