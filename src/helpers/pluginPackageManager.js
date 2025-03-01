import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Logger from '../logger.js';
import TemplateManager from './templateManager.js';

export default class PluginPackageManager {
    constructor(config) {
        this.config = config;
        this.log = Logger(config.APP_NAME, 'PluginPackageManager', config.LOG_LEVEL);
        this.pluginsDir = 'plugins';
        this.templateManager = new TemplateManager();
    }

    /**
     * Install dependencies for a specific plugin
     */
    async installPluginDependencies(pluginName) {
        const pluginDir = path.join(this.pluginsDir, pluginName);
        const packageJsonPath = path.join(pluginDir, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            this.log.debug(`No package.json found for plugin ${pluginName}`);
            return { success: true, message: 'No dependencies to install' };
        }

        try {
            this.log.info(`Installing dependencies for plugin: ${pluginName}`);
            
            const originalCwd = process.cwd();
            process.chdir(pluginDir);

            // Install dependencies in plugin directory
            execSync('npm install --production', { 
                stdio: 'inherit',
                timeout: 300000 // 5 minutes timeout
            });

            process.chdir(originalCwd);

            this.log.info(`Dependencies installed successfully for plugin: ${pluginName}`);
            return { success: true, message: 'Dependencies installed successfully' };

        } catch (error) {
            this.log.error(`Failed to install dependencies for plugin ${pluginName}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Install dependencies for all plugins
     */
    async installAllPluginDependencies() {
        if (!fs.existsSync(this.pluginsDir)) {
            this.log.warn('Plugins directory does not exist');
            return { success: true, results: [] };
        }

        const pluginDirs = fs.readdirSync(this.pluginsDir);
        const results = [];

        for (const pluginDir of pluginDirs) {
            const pluginPath = path.join(this.pluginsDir, pluginDir);
            if (fs.statSync(pluginPath).isDirectory()) {
                const result = await this.installPluginDependencies(pluginDir);
                results.push({ plugin: pluginDir, ...result });
            }
        }

        return { success: true, results };
    }

    /**
     * Check plugin dependencies status
     */
    async checkPluginDependencies(pluginName) {
        const pluginDir = path.join(this.pluginsDir, pluginName);
        const packageJsonPath = path.join(pluginDir, 'package.json');
        const nodeModulesPath = path.join(pluginDir, 'node_modules');

        const status = {
            hasPackageJson: fs.existsSync(packageJsonPath),
            hasNodeModules: fs.existsSync(nodeModulesPath),
            dependencies: [],
            devDependencies: [],
            installedPackages: []
        };

        if (status.hasPackageJson) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                status.dependencies = Object.keys(packageJson.dependencies || {});
                status.devDependencies = Object.keys(packageJson.devDependencies || {});
            } catch (error) {
                this.log.error(`Error reading package.json for plugin ${pluginName}:`, error);
            }
        }

        if (status.hasNodeModules) {
            try {
                status.installedPackages = fs.readdirSync(nodeModulesPath)
                    .filter(dir => !dir.startsWith('.'));
            } catch (error) {
                this.log.error(`Error reading node_modules for plugin ${pluginName}:`, error);
            }
        }

        return status;
    }

    /**
     * Create plugin template with package.json
     */
    async createPluginTemplate(pluginName, options = {}) {
        // Validate plugin name
        if (!pluginName || typeof pluginName !== 'string') {
            throw new Error('Plugin name is required and must be a string');
        }

        // Sanitize plugin name
        const sanitizedName = pluginName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!sanitizedName) {
            throw new Error('Invalid plugin name. Use only letters, numbers, hyphens, and underscores');
        }

        const pluginDir = path.join(this.pluginsDir, sanitizedName);

        if (fs.existsSync(pluginDir)) {
            throw new Error(`Plugin directory ${sanitizedName} already exists`);
        }

        try {
            // Validate templates exist
            this.templateManager.validateTemplates();

            // Ensure plugins directory exists
            if (!fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            }

            // Create plugin directory
            fs.mkdirSync(pluginDir, { recursive: true });

            // Generate all files from templates
            const { files, pluginName: finalPluginName, className } =
                this.templateManager.generatePluginFiles(sanitizedName, options);

            // Write all generated files
            for (const [filename, content] of Object.entries(files)) {
                fs.writeFileSync(path.join(pluginDir, filename), content);
            }

            this.log.info(`Plugin template created successfully: ${finalPluginName}`);
            return {
                success: true,
                path: pluginDir,
                pluginName: finalPluginName,
                className: className
            };

        } catch (error) {
            // Cleanup on error
            if (fs.existsSync(pluginDir)) {
                try {
                    fs.rmSync(pluginDir, { recursive: true, force: true });
                } catch (cleanupError) {
                    this.log.error('Error during cleanup:', cleanupError);
                }
            }
            this.log.error(`Error creating plugin template ${sanitizedName}:`, error);
            throw error;
        }
    }

    /**
     * Remove plugin and its dependencies
     */
    async removePlugin(pluginName) {
        const pluginDir = path.join(this.pluginsDir, pluginName);
        
        if (!fs.existsSync(pluginDir)) {
            throw new Error(`Plugin ${pluginName} does not exist`);
        }

        try {
            // Remove plugin directory
            fs.rmSync(pluginDir, { recursive: true, force: true });
            this.log.info(`Plugin removed: ${pluginName}`);
            return { success: true };
        } catch (error) {
            this.log.error(`Error removing plugin ${pluginName}:`, error);
            throw error;
        }
    }
}
