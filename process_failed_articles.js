#!/usr/bin/env node

/**
 * 处理之前失败的文章（利用优化后的超时设置）
 * 现在使用统一的处理器，避免重复代码
 */

const RecentArticleDiscoverer = require('./discover_recent_articles');

async function processFailedArticles() {
    // 使用统一的处理器，避免代码重复
    const discoverer = new RecentArticleDiscoverer();
    await discoverer.processFailedRetryArticles();
}

// 运行
if (require.main === module) {
    processFailedArticles().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}