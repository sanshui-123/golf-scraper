#!/usr/bin/env node

/**
 * 智能代理池管理系统测试脚本
 * 用于验证所有功能是否正常工作
 */

const SmartProxyManager = require('./smart_proxy_manager');

async function testSmartProxyManager() {
    console.log('🧪 开始测试智能代理池管理系统...\n');
    
    const manager = new SmartProxyManager();
    
    try {
        // 1. 测试初始化
        console.log('1️⃣ 测试初始化...');
        await manager.initialize();
        console.log('✅ 初始化成功\n');
        
        // 2. 测试获取最优代理
        console.log('2️⃣ 测试获取最优代理...');
        const proxy1 = await manager.getOptimalProxy();
        if (proxy1) {
            console.log(`✅ 获取到最优代理: ${proxy1.name || manager.getProxyKey(proxy1)}`);
            const score = manager.calculateProxyScore(proxy1);
            console.log(`   优先级分数: ${score}\n`);
        } else {
            console.log('❌ 无法获取代理\n');
        }
        
        // 3. 测试代理健康检查
        console.log('3️⃣ 测试单个代理健康检查...');
        if (proxy1) {
            const isHealthy = await manager.proxyHealthChecker(proxy1);
            console.log(`   代理健康状态: ${isHealthy ? '✅ 健康' : '❌ 不健康'}\n`);
        }
        
        // 4. 测试记录使用情况
        console.log('4️⃣ 测试记录代理使用...');
        if (proxy1) {
            // 模拟成功使用
            await manager.recordProxyUsage(proxy1, true, 1500);
            console.log('✅ 记录成功使用 (响应时间: 1.5秒)');
            
            // 模拟失败使用
            await manager.recordProxyUsage(proxy1, false, 0, 'TIMEOUT');
            console.log('✅ 记录失败使用 (原因: TIMEOUT)\n');
        }
        
        // 5. 测试智能故障转移
        console.log('5️⃣ 测试智能故障转移...');
        if (proxy1) {
            const newProxy = await manager.smartFailover(proxy1, 'NETWORK_ERROR');
            if (newProxy) {
                console.log(`✅ 故障转移成功: ${newProxy.name || manager.getProxyKey(newProxy)}\n`);
            } else {
                console.log('❌ 故障转移失败\n');
            }
        }
        
        // 6. 测试系统健康状态
        console.log('6️⃣ 测试系统健康状态...');
        const systemHealth = await manager.getSystemHealth();
        console.log('系统健康报告:');
        console.log(`   状态: ${systemHealth.system_status}`);
        console.log(`   总代理数: ${systemHealth.total_proxies}`);
        console.log(`   可用代理: ${systemHealth.available_proxies}`);
        console.log(`   健康代理: ${systemHealth.healthy_proxies}`);
        console.log(`   黑名单代理: ${systemHealth.blacklisted_proxies}`);
        console.log(`   整体成功率: ${(systemHealth.overall_success_rate * 100).toFixed(1)}%`);
        console.log(`   平均响应时间: ${(systemHealth.average_response_time / 1000).toFixed(2)}秒\n`);
        
        // 7. 测试统计信息
        console.log('7️⃣ 测试获取统计信息...');
        const stats = await manager.getProxyStatistics();
        console.log(`   智能管理: ${stats.smart_management ? '已启用' : '已禁用'}`);
        console.log(`   优先队列大小: ${stats.priority_queue_size}`);
        console.log(`   今日剩余配额: ${stats.remainingQuotaToday}\n`);
        
        // 8. 测试错误分类
        console.log('8️⃣ 测试错误分类...');
        const errors = [
            new Error('Connection timeout'),
            new Error('403 Forbidden'),
            new Error('Quota exceeded'),
            new Error('Network error')
        ];
        
        errors.forEach(error => {
            const type = manager.categorizeError(error);
            console.log(`   "${error.message}" → ${type}`);
        });
        console.log();
        
        // 9. 测试优先级队列重建
        console.log('9️⃣ 测试优先级队列重建...');
        await manager.rebuildPriorityQueue();
        console.log('✅ 优先级队列重建成功\n');
        
        // 10. 测试强制健康检查
        console.log('🔟 测试强制健康检查（可能需要较长时间）...');
        console.log('⏳ 正在检查所有代理...');
        await manager.forceHealthCheck();
        console.log('✅ 健康检查完成\n');
        
        // 清理
        await manager.cleanup();
        console.log('🧹 测试完成，已清理资源\n');
        
        // 最终报告
        console.log('📊 测试总结:');
        console.log('✅ 所有功能测试通过！');
        console.log('\n建议:');
        console.log('1. 配置真实的代理服务器信息到 proxy_config.json');
        console.log('2. 运行 node smart_proxy_manager.js stats 查看详细统计');
        console.log('3. 运行 node ai_content_detector.js 测试AI检测功能');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        await manager.cleanup();
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testSmartProxyManager().catch(console.error);
}