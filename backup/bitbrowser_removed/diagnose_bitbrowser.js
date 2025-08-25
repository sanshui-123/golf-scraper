#!/usr/bin/env node

/**
 * BitBrowser深度诊断脚本
 * 检查所有关键组件和配置
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function diagnoseBitBrowser() {
    // 对于本地连接，不使用代理
    process.env.NO_PROXY = 'localhost,127.0.0.1';
    
    console.log('🔍 BitBrowser深度诊断工具');
    console.log('=' .repeat(50));
    console.log('');
    
    const results = {
        configFile: false,
        apiConnection: false,
        browserList: false,
        launchTest: false,
        portListening: false,
        processRunning: false,
        recommendations: []
    };
    
    // 1. 检查配置文件
    console.log('1️⃣  检查配置文件...');
    const configPath = path.join(__dirname, 'bitbrowser_config.json');
    if (!fs.existsSync(configPath)) {
        console.log('❌ 配置文件不存在');
        results.recommendations.push('创建 bitbrowser_config.json 配置文件');
        return results;
    }
    
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log('✅ 配置文件存在');
        console.log(`   API地址: ${config.apiHost}:${config.apiPort}`);
        console.log(`   API密钥: ${config.apiKey ? '已配置' : '未配置'}`);
        results.configFile = true;
    } catch (error) {
        console.log('❌ 配置文件格式错误:', error.message);
        results.recommendations.push('修复 bitbrowser_config.json 格式');
        return results;
    }
    
    // 2. 检查端口监听
    console.log('\n2️⃣  检查端口监听状态...');
    try {
        const { stdout: lsofOut } = await execAsync(`lsof -i :${config.apiPort} 2>/dev/null || true`);
        if (lsofOut.trim()) {
            console.log(`✅ 端口 ${config.apiPort} 正在监听`);
            console.log(`   进程信息:\n${lsofOut.trim()}`);
            results.portListening = true;
        } else {
            console.log(`❌ 端口 ${config.apiPort} 未监听`);
            results.recommendations.push('启动BitBrowser客户端或检查端口配置');
        }
    } catch (error) {
        console.log('⚠️  无法检查端口状态:', error.message);
    }
    
    // 3. 检查BitBrowser进程
    console.log('\n3️⃣  检查BitBrowser进程...');
    try {
        const { stdout: psOut } = await execAsync('ps aux | grep -i bitbrowser | grep -v grep || true');
        if (psOut.trim()) {
            console.log('✅ 找到BitBrowser进程');
            const lines = psOut.trim().split('\n');
            lines.forEach(line => {
                const parts = line.split(/\s+/);
                console.log(`   PID: ${parts[1]}, CPU: ${parts[2]}%, MEM: ${parts[3]}%`);
            });
            results.processRunning = true;
        } else {
            console.log('❌ 未找到BitBrowser进程');
            results.recommendations.push('启动BitBrowser客户端软件');
        }
    } catch (error) {
        console.log('⚠️  无法检查进程状态:', error.message);
    }
    
    // 4. 测试API连接
    console.log('\n4️⃣  测试API基础连接...');
    try {
        const testUrl = `${config.apiHost}:${config.apiPort}`;
        console.log(`   尝试连接: ${testUrl}`);
        
        // 测试基础连接
        const response = await axios.get(testUrl, { 
            timeout: 5000,
            proxy: false,
            validateStatus: () => true
        });
        console.log(`✅ API服务响应: ${response.status}`);
        results.apiConnection = true;
    } catch (error) {
        console.log('❌ API连接失败:', error.code || error.message);
        if (error.code === 'ECONNREFUSED') {
            results.recommendations.push('确保BitBrowser API服务已启用');
        } else if (error.code === 'ECONNRESET') {
            results.recommendations.push('API服务异常，尝试重启BitBrowser');
        }
    }
    
    // 5. 测试浏览器列表API
    console.log('\n5️⃣  测试浏览器列表API...');
    try {
        const response = await axios.post(
            `${config.apiHost}:${config.apiPort}/browser/list`,
            { page: 0, pageSize: 100 },
            {
                proxy: false,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey || ''
                },
                timeout: 5000,
                validateStatus: () => true
            }
        );
        
        if (response.status === 200) {
            console.log('✅ 浏览器列表API正常');
            const data = response.data;
            if (data.data && data.data.list) {
                console.log(`   配置文件数量: ${data.data.totalNum || 0}`);
                if (data.data.totalNum === 0) {
                    results.recommendations.push('在BitBrowser中创建至少一个浏览器配置文件');
                }
            }
            results.browserList = true;
        } else {
            console.log(`❌ API返回错误: ${response.status}`);
            console.log(`   响应: ${JSON.stringify(response.data)}`);
            if (response.status === 401) {
                results.recommendations.push('检查API密钥是否正确');
            }
        }
    } catch (error) {
        console.log('❌ 浏览器列表API失败:', error.message);
        if (error.code === 'ECONNRESET') {
            results.recommendations.push('API连接被重置，可能需要重启BitBrowser');
        }
    }
    
    // 6. 检查代理配置
    console.log('\n6️⃣  检查代理配置...');
    const proxyConfigPath = path.join(__dirname, 'proxy_config.json');
    if (fs.existsSync(proxyConfigPath)) {
        try {
            const proxyConfig = JSON.parse(fs.readFileSync(proxyConfigPath, 'utf-8'));
            const proxyCount = proxyConfig.proxies?.length || 0;
            console.log(`📊 代理配置: ${proxyCount} 个代理`);
            if (proxyCount === 0) {
                console.log('⚠️  没有配置代理（降级模式不可用）');
                results.recommendations.push('配置至少一个可用代理作为备用方案');
            }
        } catch (error) {
            console.log('❌ 代理配置文件格式错误');
        }
    } else {
        console.log('⚠️  代理配置文件不存在');
    }
    
    // 7. 总结和建议
    console.log('\n' + '=' .repeat(50));
    console.log('📊 诊断总结\n');
    
    const status = {
        '配置文件': results.configFile ? '✅' : '❌',
        '端口监听': results.portListening ? '✅' : '❌',
        '进程运行': results.processRunning ? '✅' : '❌',
        'API连接': results.apiConnection ? '✅' : '❌',
        '浏览器API': results.browserList ? '✅' : '❌'
    };
    
    Object.entries(status).forEach(([key, value]) => {
        console.log(`${value} ${key}`);
    });
    
    if (results.recommendations.length > 0) {
        console.log('\n🔧 建议操作:');
        results.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });
    } else {
        console.log('\n✅ BitBrowser配置正常！');
    }
    
    // 8. 快速修复建议
    console.log('\n💡 快速修复步骤:');
    if (!results.processRunning || !results.portListening) {
        console.log('1. 启动BitBrowser客户端');
        console.log('2. 在BitBrowser中点击"API对接文档"');
        console.log('3. 启用本地API服务');
        console.log('4. 记录API密钥并更新到 bitbrowser_config.json');
    }
    
    if (!results.apiConnection && results.portListening) {
        console.log('1. 重启BitBrowser客户端');
        console.log('2. 检查防火墙设置');
        console.log('3. 确认API服务已启用');
    }
    
    return results;
}

// 运行诊断
if (require.main === module) {
    diagnoseBitBrowser().catch(console.error);
}

module.exports = diagnoseBitBrowser;