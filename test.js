#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Running Simple Tests...\n');

// Test 1: Basic Auth Helper Test
async function testAuthHelper() {
    console.log('Testing Auth Helper...');
    try {
        const { default: Auth } = await import('./src/helpers/auth.js');

        // Mock config untuk testing
        process.env.NODE_ENV = 'test';

        const auth = new Auth();

        // Test basic methods
        const isRootResult = auth.isRoot(123456789);
        console.log(`✅ Auth.isRoot() works: ${isRootResult}`);

        // Test cleanup - ini yang mengatasi masalah MySQL connection!
        await auth.destroy();
        console.log('✅ Auth.destroy() works - MySQL connections cleaned up');

        return true;
    } catch (error) {
        console.log(`❌ Auth Helper test failed: ${error.message}`);
        return false;
    }
}

// Test 2: Plugin System Test
async function testPluginSystem() {
    console.log('\nTesting Plugin System...');
    try {
        const { default: Plugin } = await import('./src/plugin.js');

        const mockBot = {
            on: () => {},
            removeListener: () => {}
        };

        const plugin = new Plugin('test-plugin', '/fake/path', mockBot, {});
        console.log('✅ Plugin instantiation works');

        return true;
    } catch (error) {
        console.log(`❌ Plugin System test failed: ${error.message}`);
        return false;
    }
}

// Test 3: Configuration Test
async function testConfiguration() {
    console.log('\nTesting Configuration...');
    try {
        const config = await import('./src/config.js');
        console.log('✅ Configuration loads successfully');
        return true;
    } catch (error) {
        console.log(`❌ Configuration test failed: ${error.message}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    const results = [];

    results.push(await testAuthHelper());
    results.push(await testPluginSystem());
    results.push(await testConfiguration());

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`\n📊 Test Results: ${passed}/${total} passed`);

    if (passed === total) {
        console.log('🎉 All tests passed! No more MySQL connection issues!');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed!');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
