const ProxyRotationManager = require('./proxy_rotation_manager.js');
const fs = require('fs').promises;

(async () => {
    console.log('=== 测试每日重置机制 ===\n');
    
    // 设置昨天的状态
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const testStatus = {
        "http://156.243.229.75:44001": {
            "usedToday": 99,
            "totalUsed": 99,
            "lastUsedTime": yesterday.toISOString(),
            "lastResetDate": yesterday.toDateString(),
            "isHealthy": false,
            "failureCount": 10
        }
    };
    
    console.log('1. 设置昨天的状态（不健康，已用99次）:');
    console.log(JSON.stringify(testStatus, null, 2));
    await fs.writeFile('proxy_status.json', JSON.stringify(testStatus, null, 2));
    
    // 初始化管理器，应该自动重置
    console.log('\n2. 初始化代理管理器（应触发每日重置）...');
    const manager = new ProxyRotationManager();
    await manager.initialize();
    
    const stats = await manager.getProxyStats();
    console.log('\n3. 重置后的状态:');
    console.log(`   健康代理数: ${stats.healthyProxies}/${stats.totalProxies}`);
    console.log(`   今日使用: ${stats.usedQuotaToday}/${stats.totalQuotaToday}`);
    console.log(`   代理详情:`, stats.proxyDetails[0]);
    
    console.log('\n✅ 每日重置测试完成');
})();