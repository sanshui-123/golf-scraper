#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');

async function processEquipmentArticles() {
    console.log('🛍️ 开始处理装备类文章...\n');
    
    const equipmentUrls = [
        'https://www.golfmonthly.com/buying-advice/best-beginner-golf-clubs-for-ladies',
        'https://www.golfmonthly.com/buying-advice/best-womens-golf-clubs-year'
    ];
    
    const processor = new BatchProcessor();
    
    try {
        await processor.processArticles(equipmentUrls);
        console.log('\n✅ 装备类文章处理完成！');
    } catch (error) {
        console.error('\n❌ 处理装备类文章时出错:', error);
    }
}

processEquipmentArticles();