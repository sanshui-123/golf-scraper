#!/usr/bin/env node

const SmartProxyManager = require('./smart_proxy_manager');

async function testProxyManager() {
    console.log('🔍 测试代理管理器...');
    
    try {
        const manager = new SmartProxyManager();
        await manager.initialize();
        
        console.log('\n📊 代理信息:');
        console.log('代理数量:', manager.proxies ? manager.proxies.length : 0);
        
        if (manager.proxies && manager.proxies.length > 0) {
            console.log('\n📋 代理列表:');
            manager.proxies.forEach((proxy, index) => {
                console.log(`${index + 1}. ${proxy.name || proxy.type} - ${proxy.host}:${proxy.port || 'N/A'}`);
            });
        }
        
        console.log('\n🔄 尝试获取可用代理...');
        const proxy = await manager.getNextProxy();
        
        if (proxy) {
            console.log('✅ 获取到代理:', proxy);
        } else {
            console.log('❌ 没有可用的代理');
        }
        
        // 检查统计信息
        console.log('\n📊 代理统计:');
        const stats = await manager.getProxyStats();
        console.log(JSON.stringify(stats, null, 2));
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
testProxyManager();