#!/usr/bin/env node

/**
 * 检查比特浏览器是否正确安装和运行
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 读取配置
const configPath = path.join(__dirname, 'bitbrowser_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

async function checkBitBrowser() {
    console.log('🔍 检查比特浏览器安装状态...\n');
    
    const checks = {
        installed: false,
        running: false,
        apiAccessible: false,
        version: null
    };
    
    // 1. 检查API是否可访问
    try {
        console.log('1. 检查API连接...');
        const response = await axios.post(`${config.apiHost}:${config.apiPort}/browser/list`, {
            page: 0,
            pageSize: 100
        }, {
            timeout: 3000,
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        checks.apiAccessible = true;
        checks.running = true;
        console.log('✅ API连接成功\n');
        
        // 尝试获取版本信息
        if (response.data) {
            console.log('2. 获取浏览器信息...');
            console.log(`   状态: ${response.data.success !== false ? '正常' : '异常'}`);
            
            // 获取配置文件数量
            if (response.data.data) {
                console.log(`   总配置文件数: ${response.data.data.totalNum || 0}`);
                console.log(`   当前页显示: ${response.data.data.list ? response.data.data.list.length : 0}`);
                
                if (!response.data.data.totalNum || response.data.data.totalNum === 0) {
                    console.log('\n⚠️  还没有创建配置文件');
                    console.log('   请在比特浏览器中创建至少一个配置文件');
                } else if (response.data.data.list && response.data.data.list.length > 0) {
                    console.log('\n📋 配置文件列表:');
                    response.data.data.list.forEach((profile, index) => {
                        console.log(`   ${index + 1}. ${profile.name || '未命名'} (ID: ${profile.id})`);
                    });
                }
            }
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ 无法连接到比特浏览器\n');
            console.log('可能的原因：');
            console.log('1. 比特浏览器客户端未启动');
            console.log('2. API端口不是默认的54345');
            console.log('3. 防火墙阻止了连接\n');
        } else {
            console.log('❌ 连接失败:', error.message);
        }
    }
    
    // 2. 检查进程（仅macOS/Linux）
    if (process.platform !== 'win32') {
        console.log('\n3. 检查进程...');
        const { exec } = require('child_process');
        
        exec('ps aux | grep -i bitbrowser | grep -v grep', (error, stdout, stderr) => {
            if (stdout) {
                checks.installed = true;
                console.log('✅ 找到比特浏览器进程');
            } else {
                console.log('⚠️  未找到比特浏览器进程');
            }
            
            // 显示总结
            showSummary(checks);
        });
    } else {
        // Windows系统直接显示总结
        showSummary(checks);
    }
}

function showSummary(checks) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 检查总结：');
    console.log('='.repeat(50));
    
    if (checks.apiAccessible) {
        console.log('✅ 比特浏览器已正确安装并运行！');
        console.log('\n下一步：');
        console.log('1. 在比特浏览器中创建多个配置文件');
        console.log('2. 运行测试: node test_bitbrowser_integration.js');
    } else {
        console.log('❌ 比特浏览器未检测到');
        console.log('\n请按以下步骤操作：');
        console.log('1. 访问 https://www.bitbrowser.cn/ 下载客户端');
        console.log('2. 安装并启动比特浏览器');
        console.log('3. 再次运行此检查脚本');
    }
    
    console.log('\n💡 提示：');
    console.log('- 确保比特浏览器在后台运行');
    console.log('- 默认API端口是54345');
    console.log('- 如果修改了端口，请更新 bitbrowser_config.json');
}

// 运行检查
checkBitBrowser().catch(console.error);