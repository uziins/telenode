import fs from 'fs';
import path from 'path';

/**
 * Template manager for plugin creation
 */
export default class TemplateManager {
    constructor() {
        this.templatesDir = path.join(process.cwd(), 'templates', 'plugin');
    }

    /**
     * Read template file and replace placeholders
     */
    processTemplate(templateName, placeholders) {
        const templatePath = path.join(this.templatesDir, templateName);
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templateName}`);
        }

        let content = fs.readFileSync(templatePath, 'utf8');
        
        // Replace all placeholders
        for (const [key, value] of Object.entries(placeholders)) {
            const placeholder = `{{${key}}}`;
            content = content.replace(new RegExp(placeholder, 'g'), value);
        }

        return content;
    }

    /**
     * Generate all plugin files from templates
     */
    generatePluginFiles(pluginName, options = {}) {
        // Sanitize plugin name
        const sanitizedName = pluginName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        
        // Generate class name (PascalCase)
        const className = sanitizedName.charAt(0).toUpperCase() + 
                         sanitizedName.slice(1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        
        // Generate command name (remove hyphens)
        const commandName = sanitizedName.replace(/-/g, '');

        // Prepare placeholders
        const placeholders = {
            IDENTIFIER: sanitizedName,
            CLASS_NAME: className,
            COMMAND_NAME: commandName,
            DESCRIPTION: options.description || `A TeleNode plugin for ${sanitizedName}`,
            HELP: options.help || `/${commandName} - ${options.description || `Execute ${sanitizedName} command`}`,
            AUTHOR: options.author || 'TeleNode Developer',
            LICENSE: options.license || 'MIT',
            CATEGORY: options.category || 'general',
            VISIBILITY: options.visibility || 'USER',
            USAGE: options.usage || 'Main plugin command',
            DEPENDENCIES: JSON.stringify(options.dependencies || {}, null, 2),
            DEPENDENCIES_LIST: this.generateDependenciesList(options.dependencies),
            TYPE: options.type || 'NORMAL',
        };

        // Generate files
        const files = {
            'package.json': this.processTemplate('package.json.template', placeholders),
            'index.js': this.processTemplate('index.js.template', placeholders),
            'README.md': this.processTemplate('README.md.template', placeholders),
            '.gitignore': this.processTemplate('.gitignore.template', placeholders)
        };

        return {
            files,
            pluginName: sanitizedName,
            className
        };
    }

    /**
     * Generate dependencies list for README
     */
    generateDependenciesList(dependencies) {
        if (!dependencies || Object.keys(dependencies).length === 0) {
            return 'No external dependencies required.';
        }

        return Object.entries(dependencies)
            .map(([pkg, ver]) => `- \`${pkg}\`: ${ver}`)
            .join('\n');
    }

    /**
     * Check if all required templates exist
     */
    validateTemplates() {
        const requiredTemplates = [
            'package.json.template',
            'index.js.template', 
            'README.md.template',
            '.gitignore.template'
        ];

        const missing = requiredTemplates.filter(template => 
            !fs.existsSync(path.join(this.templatesDir, template))
        );

        if (missing.length > 0) {
            throw new Error(`Missing template files: ${missing.join(', ')}`);
        }

        return true;
    }
}
