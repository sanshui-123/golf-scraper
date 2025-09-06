#!/usr/bin/env node

/**
 * 修复文章12537的改写失败问题
 * 该文章返回了确认消息而非实际内容
 */

const fs = require('fs');
const path = require('path');
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');

async function fixArticle12537() {
    console.log('🔧 修复文章12537的改写失败问题...\n');
    
    const articleNum = '12537';
    const date = '2025-09-01';
    const baseDir = path.join(__dirname, 'golf_content', date);
    
    // 检查原始JSON文件
    const jsonFile = path.join(baseDir, `article_${articleNum}.json`);
    if (!fs.existsSync(jsonFile)) {
        console.error(`❌ 找不到文章JSON文件: ${jsonFile}`);
        return;
    }
    
    const article = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    console.log(`📄 文章标题: ${article.title}`);
    console.log(`🔗 原文链接: ${article.url}`);
    
    // 检查当前MD内容
    const mdFile = path.join(baseDir, 'wechat_ready', `wechat_article_${articleNum}.md`);
    const currentContent = fs.readFileSync(mdFile, 'utf8');
    
    console.log('\n❌ 当前错误内容:');
    console.log(currentContent.substring(0, 200) + '...\n');
    
    if (currentContent.includes('已完成文章改写') || currentContent.length < 300) {
        console.log('⚠️ 确认：文章内容是Claude的确认消息，需要重新改写\n');
        
        // 准备重新改写
        const rewriter = new ArticleRewriterEnhanced();
        
        // 先测试Claude是否可用
        const isAvailable = await rewriter.testClaude();
        if (!isAvailable) {
            console.error('❌ Claude不可用，请检查环境');
            return;
        }
        
        try {
            console.log('🔄 开始重新改写文章...\n');
            
            // 从JSON中获取原始内容
            const originalContent = article.content_with_placeholders || article.content;
            
            // 重新改写
            const rewrittenContent = await rewriter.rewriteArticle(
                article.title, 
                originalContent,
                article.url
            );
            
            console.log('\n✅ 改写成功！');
            console.log(`📝 新内容长度: ${rewrittenContent.length} 字符`);
            console.log(`📄 前100字符: ${rewrittenContent.substring(0, 100)}...\n`);
            
            // 检查是否仍然是确认消息
            if (rewrittenContent.includes('已完成文章改写') || rewrittenContent.length < 500) {
                console.error('❌ 改写后仍然是确认消息，可能需要调整提示词');
                return;
            }
            
            // 保存新内容
            fs.writeFileSync(mdFile, rewrittenContent, 'utf8');
            console.log('✅ MD文件已更新');
            
            // 更新HTML文件
            const htmlFile = path.join(baseDir, 'wechat_html', `wechat_article_${articleNum}.html`);
            const generateHTML = require('./batch_process_articles').prototype.generateHTML;
            
            // 生成新的HTML
            const htmlContent = generateHTML.call({}, article.title, rewrittenContent, article);
            fs.writeFileSync(htmlFile, htmlContent, 'utf8');
            console.log('✅ HTML文件已更新');
            
            // 更新历史数据库
            const masterDbFile = path.join(__dirname, 'master_history_database.json');
            if (fs.existsSync(masterDbFile)) {
                const masterDb = JSON.parse(fs.readFileSync(masterDbFile, 'utf8'));
                const urlHash = require('crypto').createHash('md5').update(article.url).digest('hex');
                
                if (masterDb[urlHash]) {
                    masterDb[urlHash].rewriteCount = (masterDb[urlHash].rewriteCount || 0) + 1;
                    masterDb[urlHash].lastRewriteAt = new Date().toISOString();
                    fs.writeFileSync(masterDbFile, JSON.stringify(masterDb, null, 2));
                    console.log('✅ 历史数据库已更新');
                }
            }
            
            console.log('\n🎉 文章12537修复完成！');
            console.log(`📱 查看修复后的文章: http://localhost:8080/golf_content/${date}/wechat_html/wechat_article_${articleNum}.html`);
            
        } catch (error) {
            console.error('\n❌ 重新改写失败:', error.message);
            console.error('请稍后再试或手动处理');
        }
    } else {
        console.log('✅ 文章内容看起来正常，无需修复');
    }
}

// 执行修复
if (require.main === module) {
    fixArticle12537().catch(console.error);
}

module.exports = { fixArticle12537 };