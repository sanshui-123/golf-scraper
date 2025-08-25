const ProxyRotationManager = require('./proxy_rotation_manager.js');

(async () => {
    console.log('=== 测试代理健康恢复机制 ===\n');
    
    const manager = new ProxyRotationManager();
    await manager.initialize();
    
    console.log('1. 初始状态:');
    const stats1 = await manager.getProxyStats();
    console.log(`   健康代理数: ${stats1.healthyProxies}/${stats1.totalProxies}`);
    console.log(`   代理详情:`, stats1.proxyDetails[0]);
    
    // 模拟代理失败
    console.log('\n2. 模拟代理失败3次...');
    const proxy = manager.proxies[0];
    await manager.recordProxyUsage(proxy, false, 'TIMEOUT');
    await manager.recordProxyUsage(proxy, false, 'TIMEOUT');
    await manager.recordProxyUsage(proxy, false, 'PERMANENT_ERROR');
    
    const stats2 = await manager.getProxyStats();
    console.log(`   健康代理数: ${stats2.healthyProxies}/${stats2.totalProxies}`);
    console.log(`   代理详情:`, stats2.proxyDetails[0]);
    
    // 修改最后使用时间为2小时前
    console.log('\n3. 模拟2小时前的失败...');
    const proxyKey = manager.getProxyKey(proxy);
    manager.proxyStatus[proxyKey].lastUsedTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await manager.saveStatus();
    
    // 触发健康恢复检查
    console.log('\n4. 执行健康恢复检查...');
    await manager.checkHealthRecovery();
    
    const stats3 = await manager.getProxyStats();
    console.log(`   健康代理数: ${stats3.healthyProxies}/${stats3.totalProxies}`);
    console.log(`   代理详情:`, stats3.proxyDetails[0]);
    
    console.log('\n✅ 测试完成');
})();