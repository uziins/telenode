import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import AdmZip from 'adm-zip';
import Logger from '../logger.js';
import PluginModel from "../models/plugins.js";

const PluginTbl = new PluginModel();

export default class Marketplace {
    constructor(config) {
        this.config = config;
        this.log = Logger(config.APP_NAME, 'Marketplace', config.LOG_LEVEL);
        this.pluginsDir = 'plugins';
        this.tempDir = 'tmp';

        this.pluginLibraryUrl = config.MARKETPLACE_URL;
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Get available plugins from marketplace
     */
    async getMarketplacePlugins(page = 1, limit = 10, search = '') {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                q: search.trim()
            });

            return await this.makeRequest(`${this.pluginLibraryUrl}/search-plugins?${params}`)
        } catch (error) {
            this.log.error('Failed to fetch marketplace plugins:', error);
            return {
                success: false,
                error: error.message,
                data: [],
                total: 0,
                page: 1,
                totalPages: 0
            };
        }
    }

    /**
     * Get plugin details from marketplace
     */
    async getMarketplacePluginDetails(code) {
        try {
            return await this.makeRequest(`${this.pluginLibraryUrl}/get-plugin/${code}`);
        } catch (error) {
            this.log.error(`Failed to fetch plugin details for ${code}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Request plugin download URL from marketplace
     * */
    async getMarketplacePluginDownloadUrl(pluginCode, botId) {
        try {
            const requestBody = {
                identifier: pluginCode,
                timestamp: Math.floor(Date.now() / 1000),
                bot_id: botId.toString()
            };

            return await this.makeRequest(`${this.pluginLibraryUrl}/request-download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestBody
            });
        } catch (error) {
            this.log.error(`Failed to get download URL for plugin ${pluginCode}:`, error);
            return JSON.parse(error.data) || {
                success: false,
                error: error.message
            }
        }
    }


    /**
     * Download and install plugin from marketplace
     */
    async installPlugin(pluginCode, code = null) {
        try {
            this.log.info(`Installing plugin ${pluginCode}`);

            const downloadUrl = `${this.pluginLibraryUrl}/download-plugin/${pluginCode}?code=${code}`;

            // Download plugin zip
            const zipPath = path.join(this.tempDir, `${pluginCode}.zip`);
            await this.downloadFile(downloadUrl, zipPath);

            // Install from zip
            const result = await this.installFromZip(zipPath);

            // Clean up temp file
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }

            return result;

        } catch (error) {
            this.log.error(`Failed to install plugin ${pluginCode}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Install plugin from local zip file
     */
    async installFromZip(zipPath) {
        try {
            if (!fs.existsSync(zipPath)) {
                throw new Error('Zip file not found');
            }

            // Extract zip
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();

            // Validate zip structure
            const validation = this.validatePluginZip(zipEntries);
            if (!validation.valid) {
                throw new Error(`Invalid plugin zip: ${validation.error}`);
            }

            let pluginName = validation.pluginName;
            let pluginDir = path.join(this.pluginsDir, pluginName);

            // Extract to plugins directory, but flatten if zip contains a single root folder
            const rootEntries = zip.getEntries().map(e => e.entryName.split('/')[0]);
            const uniqueRoots = Array.from(new Set(rootEntries)).filter(r => r && r !== '__MACOSX');
            if (uniqueRoots.length === 1 && uniqueRoots[0] === pluginName) {
                // Extract to pluginsDir, removing the top-level folder
                zip.getEntries().forEach(entry => {
                    const relPath = entry.entryName.replace(`${pluginName}/`, '');
                    if (relPath) {
                        const destPath = path.join(pluginDir, relPath);
                        if (entry.isDirectory) {
                            fs.mkdirSync(destPath, { recursive: true });
                        } else {
                            fs.mkdirSync(path.dirname(destPath), { recursive: true });
                            fs.writeFileSync(destPath, entry.getData());
                        }
                    }
                });
            } else {
                // Default extraction
                zip.extractAllTo(pluginDir, true);
            }

            // Validate extracted plugin
            const packageJsonPath = path.join(pluginDir, 'package.json');
            const indexPath = path.join(pluginDir, 'index.js');

            if (!fs.existsSync(packageJsonPath) || !fs.existsSync(indexPath)) {
                // Clean up on failure
                if (fs.existsSync(pluginDir)) {
                    fs.rmSync(pluginDir, { recursive: true, force: true });
                }
                throw new Error('Invalid plugin structure: missing package.json or index.js');
            }

            // Read and validate package.json
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (!packageJson.name || !packageJson.main) {
                // Clean up on failure
                fs.rmSync(pluginDir, { recursive: true, force: true });
                throw new Error('Invalid package.json: missing name or main field');
            }

            this.log.info(`Plugin ${pluginName} installed successfully`);
            
            return {
                success: true,
                pluginName,
                message: `Plugin ${pluginName} installed successfully`,
                needsReload: true
            };

        } catch (error) {
            this.log.error('Failed to install plugin from zip:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Uninstall a plugin
     */
    async uninstallPlugin(pluginName) {
        try {
            const pluginDir = path.join(this.pluginsDir, pluginName);
            
            if (!fs.existsSync(pluginDir)) {
                throw new Error(`Plugin ${pluginName} not found`);
            }

            // Remove plugin directory
            fs.rmSync(pluginDir, { recursive: true, force: true });

            await PluginTbl.deletePlugin(pluginName);

            this.log.info(`Plugin ${pluginName} uninstalled successfully`);
            
            return {
                success: true,
                message: `Plugin ${pluginName} uninstalled successfully`,
                needsReload: true
            };

        } catch (error) {
            this.log.error(`Failed to uninstall plugin ${pluginName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate plugin zip structure
     */
    validatePluginZip(zipEntries) {
        const requiredFiles = ['package.json', 'index.js'];
        const foundFiles = new Set();
        let pluginName = null;

        for (const entry of zipEntries) {
            const fileName = entry.entryName;
            
            // Check for required files in root or single directory
            if (requiredFiles.includes(fileName)) {
                foundFiles.add(fileName);
            } else if (fileName.includes('/')) {
                const parts = fileName.split('/');
                if (parts.length === 2 && requiredFiles.includes(parts[1])) {
                    foundFiles.add(parts[1]);
                    if (!pluginName) {
                        pluginName = parts[0];
                    }
                }
            }
        }

        // Check if all required files are present
        const missingFiles = requiredFiles.filter(file => !foundFiles.has(file));
        if (missingFiles.length > 0) {
            return {
                valid: false,
                error: `Missing required files: ${missingFiles.join(', ')}`
            };
        }

        // If no plugin name detected from directory structure, use first package.json name
        if (!pluginName) {
            try {
                const packageEntry = zipEntries.find(entry => 
                    entry.entryName === 'package.json' || entry.entryName.endsWith('/package.json')
                );
                if (packageEntry) {
                    const packageJson = JSON.parse(packageEntry.getData().toString('utf8'));
                    pluginName = packageJson.name;
                }
            } catch (error) {
                // Fallback to default naming
                pluginName = `plugin-${Date.now()}`;
            }
        }

        return {
            valid: true,
            pluginName
        };
    }

    /**
     * Download file from URL
     */
    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const file = fs.createWriteStream(filePath);

            client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (error) => {
                    fs.unlink(filePath, () => {}); // Clean up on error
                    reject(error);
                });

            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Make HTTP request
     */
    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const method = options.method ? options.method.toUpperCase() : 'GET';
            const headers = {
                'User-Agent': 'TeleNode Framework',
                ...options.headers
            };

            let body = options.body;
            if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
                if (headers['Content-Type'] === 'application/json') {
                    body = JSON.stringify(body);
                }
            }

            if (body) {
                headers['Content-Length'] = Buffer.byteLength(body);
            }

            const requestOptions = {
                method,
                headers,
                timeout: 30000
            };

            const req = client.request(url, requestOptions, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch (error) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(Object.assign(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`), {
                            statusCode: response.statusCode,
                            statusMessage: response.statusMessage,
                            data
                        }));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }
}
