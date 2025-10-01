#!/usr/bin/env node

import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const {program} = require('commander');

import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import config dan PluginPackageManager
let config, PluginPackageManager;
try {
    const configModule = await import('../src/config.js');
    config = configModule.default;

    const packageManagerModule = await import('../src/helpers/pluginPackageManager.js');
    PluginPackageManager = packageManagerModule.default;
} catch (error) {
    console.error('❌ Error loading modules:', error.message);
    process.exit(1);
}

const packageManager = new PluginPackageManager(config);

program
    .name('telenode-plugin')
    .description('TeleNode Plugin Management CLI')
    .version('1.0.0');

program
    .command('create <name>')
    .description('Create a new plugin with template')
    .option('-d, --description <description>', 'Plugin description')
    .option('-a, --author <author>', 'Plugin author')
    .option('-v, --visibility <visibility>', 'Plugin visibility (USER, ADMIN, ROOT)', 'USER')
    .option('-t, --type <type>', 'Plugin type (e.g., "proxy", "normal")', 'normal')
    .option('-c, --category <category>', 'Plugin category', 'general')
    .option('-h, --help-text <help>', 'Custom help text for the plugin')
    .option('--deps <deps>', 'Comma-separated list of dependencies (format: package@version)')
    .action(async (name, options) => {
        try {
            const sanitizedName = packageManager.sanitizePluginName(name);

            const dependencies = {};
            if (options.deps) {
                options.deps.split(',').forEach(dep => {
                    const [pkg, version = 'latest'] = dep.split('@');
                    dependencies[pkg.trim()] = version;
                });
            }

            // Validate visibility option
            const validVisibilities = ['USER', 'ADMIN', 'ROOT'];
            if (!validVisibilities.includes(options.visibility.toUpperCase())) {
                console.error(`❌ Invalid visibility: ${options.visibility}. Must be one of: ${validVisibilities.join(', ')}`);
                process.exit(1);
            }

            // Validate type option
            const validTypes = ['PROXY', 'NORMAL'];
            if (!validTypes.includes(options.type.toUpperCase())) {
                console.error(`❌ Invalid type: ${options.type}. Must be one of: ${validTypes.join(', ')}`);
                process.exit(1);
            }

            const result = await packageManager.createPluginTemplate(sanitizedName, {
                description: options.description,
                author: options.author,
                visibility: options.visibility.toUpperCase(),
                category: options.category,
                help: options.helpText,
                type: options.type.toUpperCase(),
                dependencies
            });

            console.log(`✅ Plugin "${sanitizedName}" created successfully at ${result.path}`);
            console.log(`📁 Files created:`);
            console.log(`   - index.js (main plugin file)`);
            console.log(`   - package.json (metadata & dependencies)`);
            console.log(`   - README.md (documentation)`);

            console.log(`\n📋 Plugin Info:`);
            console.log(`   - Name: ${sanitizedName}`);
            console.log(`   - Description: ${options.description || `A TeleNode plugin for ${sanitizedName}`}`);
            console.log(`   - Author: ${options.author || 'TeleNode Developer'}`);
            console.log(`   - Visibility: ${options.visibility.toUpperCase()}`);
            console.log(`   - Category: ${options.category}`);

            if (Object.keys(dependencies).length > 0) {
                console.log(`\n📦 Installing dependencies...`);
                await packageManager.installPluginDependencies(sanitizedName);
                console.log(`✅ Dependencies installed successfully`);
            }

            console.log(`\n🚀 Next steps:`);
            console.log(`   1. Edit plugins/${sanitizedName}/index.js to implement your plugin logic`);
            console.log(`   2. Update plugins/${sanitizedName}/package.json if needed`);
            console.log(`   3. Test your plugin with TeleNode`);
        } catch (error) {
            console.error(`❌ Error creating plugin: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('install [plugin]')
    .description('Install dependencies for a plugin or all plugins')
    .action(async (plugin) => {
        try {
            if (plugin) {
                const sanitized = packageManager.sanitizePluginName(plugin);
                console.log(`📦 Installing dependencies for plugin: ${sanitized}`);
                const result = await packageManager.installPluginDependencies(sanitized);
                if (result.success) {
                    console.log(`✅ ${result.message}`);
                } else {
                    console.error(`❌ ${result.error}`);
                }
            } else {
                console.log(`📦 Installing dependencies for all plugins...`);
                const result = await packageManager.installAllPluginDependencies();

                console.log(`\n📊 Installation Summary:`);
                result.results.forEach(r => {
                    const status = r.success ? '✅' : '❌';
                    console.log(`${status} ${r.plugin}: ${r.message || r.error}`);
                });
            }
        } catch (error) {
            console.error(`❌ Error installing dependencies: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('check [plugin]')
    .description('Check plugin dependencies status')
    .action(async (plugin) => {
        try {
            if (!plugin) {
                // Check all plugins
                const pluginsDir = 'plugins';
                if (!fs.existsSync(pluginsDir)) {
                    console.log('❌ Plugins directory not found');
                    return;
                }

                const plugins = fs.readdirSync(pluginsDir);
                for (const p of plugins) {
                    if (fs.statSync(path.join(pluginsDir, p)).isDirectory()) {
                        await checkSinglePlugin(p);
                    }
                }
            } else {
                await checkSinglePlugin(plugin);
            }
        } catch (error) {
            console.error(`❌ Error checking dependencies: ${error.message}`);
            process.exit(1);
        }
    });

async function checkSinglePlugin(pluginName) {
    pluginName = packageManager.sanitizePluginName(pluginName);
    const status = await packageManager.checkPluginDependencies(pluginName);

    console.log(`\n🔧 Plugin: ${pluginName}`);
    console.log(`📄 package.json: ${status.hasPackageJson ? '✅' : '❌'}`);
    console.log(`📦 node_modules: ${status.hasNodeModules ? '✅' : '❌'}`);

    if (status.dependencies.length > 0) {
        console.log(`📋 Dependencies (${status.dependencies.length}):`);
        status.dependencies.forEach(dep => {
            const installed = status.installedPackages.includes(dep);
            console.log(`   ${installed ? '✅' : '❌'} ${dep}`);
        });
    }

    if (status.devDependencies.length > 0) {
        console.log(`🔧 Dev Dependencies (${status.devDependencies.length}):`);
        status.devDependencies.forEach(dep => {
            const installed = status.installedPackages.includes(dep);
            console.log(`   ${installed ? '✅' : '❌'} ${dep}`);
        });
    }
}

program
    .command('remove <plugin>')
    .description('Remove a plugin completely')
    .option('-f, --force', 'Force removal without confirmation')
    .action(async (plugin, options) => {
        try {
            const sanitized = packageManager.sanitizePluginName(plugin);

            if (!options.force) {
                const readline = await import('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise(resolve => {
                    rl.question(`❓ Are you sure you want to remove plugin "${sanitized}"? (y/N): `, resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                    console.log('❌ Operation cancelled');
                    return;
                }
            }

            await packageManager.removePlugin(sanitized);
            console.log(`✅ Plugin "${sanitized}" removed successfully`);
        } catch (error) {
            console.error(`❌ Error removing plugin: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all available plugins')
    .action(() => {
        try {
            const pluginsDir = 'plugins';
            if (!fs.existsSync(pluginsDir)) {
                console.log('❌ Plugins directory not found');
                return;
            }

            const plugins = fs.readdirSync(pluginsDir)
                .filter(item => fs.statSync(path.join(pluginsDir, item)).isDirectory());

            if (plugins.length === 0) {
                console.log('📭 No plugins found');
                return;
            }

            console.log(`📋 Available plugins (${plugins.length}):\n`);

            plugins.forEach(plugin => {
                const pluginPath = path.join(pluginsDir, plugin);
                const packageJsonPath = path.join(pluginPath, 'package.json');
                const indexPath = path.join(pluginPath, 'index.js');

                console.log(`🔌 ${plugin}`);
                console.log(`   📄 package.json: ${fs.existsSync(packageJsonPath) ? '✅' : '❌'}`);
                console.log(`   📄 index.js: ${fs.existsSync(indexPath) ? '✅' : '❌'}`);

                if (fs.existsSync(packageJsonPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                        console.log(`   📝 ${pkg.description || 'No description'}`);
                        console.log(`   👤 ${pkg.author || 'Unknown author'}`);
                        console.log(`   🏷️  v${pkg.version || '0.0.0'}`);
                    } catch (error) {
                        console.log(`   ❌ Invalid package.json`);
                    }
                }
                console.log('');
            });
        } catch (error) {
            console.error(`❌ Error listing plugins: ${error.message}`);
            process.exit(1);
        }
    });

program.parse();
