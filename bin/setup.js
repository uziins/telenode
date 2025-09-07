import fs from 'fs';
import inquirer from "inquirer";

let Config;
if (fs.existsSync('.env')) {
    const module = await import ('../src/config.js');
    Config = module.default;
} else {
    // copy .env.example to .env, delete all comments and blank lines
    const envExample = fs.readFileSync('.env.example', 'utf8');
    const env = envExample.split('\n').filter(line => line.trim() !== '' && line[0] !== '#').join('\n');
    fs.writeFileSync('.env', env);
    const module = await import ('../src/config.js');
    Config = module.default;
}

async function preparingDatabase() {
    const pluginModule = await import ("../src/models/plugins.js");
    const userModule = await import ("../src/models/users.js");

    const Plugin = new pluginModule.default();
    const User = new userModule.default();
    console.log('Preparing database...');
    // check table plugins exists
    await Plugin.rawQuery('SHOW TABLES LIKE "plugins"').then(async (result) => {
        if (result.length === 0) {
            await Plugin.rawQuery('CREATE TABLE IF NOT EXISTS plugins (' +
                'id INT AUTO_INCREMENT PRIMARY KEY,' +
                'identifier VARCHAR(255) NOT NULL UNIQUE,' +
                'version VARCHAR(50) NOT NULL DEFAULT "1.0.0",' +
                'name VARCHAR(255),' +
                'description TEXT, ' +
                'help TEXT,' +
                'is_visible BOOLEAN DEFAULT 0,' +
                'is_active BOOLEAN DEFAULT 0,' +
                'deleted_at TIMESTAMP NULL DEFAULT NULL,' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table plugins created')
            });
        }
    });

    // check table users exists
    await User.rawQuery('SHOW TABLES LIKE "users"').then(async (result) => {
        if (result.length === 0) {
            await User.rawQuery('CREATE TABLE IF NOT EXISTS users (' +
                'id BIGINT PRIMARY KEY,' +
                'username VARCHAR(255),' +
                'first_name VARCHAR(255),' +
                'last_name VARCHAR(255),' +
                'is_bot BOOLEAN DEFAULT 0,' +
                'is_blocked BOOLEAN DEFAULT 0,' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table users created')
            });
        }
    });

    // check table chats exists
    await User.rawQuery('SHOW TABLES LIKE "chats"').then(async (result) => {
        if (result.length === 0) {
            await User.rawQuery('CREATE TABLE IF NOT EXISTS chats (' +
                'id BIGINT PRIMARY KEY,' +
                'type ENUM("private", "group", "supergroup", "channel"),' +
                'title VARCHAR(255),' +
                'username VARCHAR(255),' +
                'first_name VARCHAR(255),' +
                'last_name VARCHAR(255),' +
                'is_blocked BOOLEAN DEFAULT 0,' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table chats created')
            });
        }
    });

    // check table configurations exists
    await User.rawQuery('SHOW TABLES LIKE "configurations"').then(async (result) => {
        if (result.length === 0) {
            await User.rawQuery('CREATE TABLE IF NOT EXISTS configurations (' +
                'id INT AUTO_INCREMENT PRIMARY KEY,' +
                '`key` VARCHAR(255) NOT NULL UNIQUE,' +
                'value JSON,' +
                'type ENUM("string", "number", "boolean", "array", "object") DEFAULT "string",' +
                'category ENUM("general", "global", "system", "plugin") DEFAULT "general",' +
                'is_encrypted BOOLEAN DEFAULT 0,' +
                'description TEXT,' +
                'created_by VARCHAR(255),' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table configurations created')
            });
        }
    });

    // check table authorizations exists
    await User.rawQuery('SHOW TABLES LIKE "authorizations"').then(async (result) => {
        if (result.length === 0) {
            // use user_id and chat_id as primary key
            await User.rawQuery('CREATE TABLE IF NOT EXISTS authorizations (' +
                'user_id INT NOT NULL,' +
                'chat_id INT NOT NULL,' +
                'PRIMARY KEY (user_id, chat_id),' +
                'role ENUM("root", "admin", "user", "banned") DEFAULT "user",' +
                'granted_by INT,' +
                'granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,' +
                'note TEXT,' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table authorizations created')
            });
        }
    });

    console.log('Database prepared');
    process.exit(0);
}

function prepareConfig() {
    console.log('Preparing config...');

    inquirer.prompt([
        {
            type: 'input',
            name: 'BOT_TOKEN',
            message: 'Bot token:',
            default: Config?.BOT_TOKEN || null
        },
        // mysql
        {
            type: 'input',
            name: 'DB_HOST',
            message: 'Database host:',
            default: Config?.db.host
        },
        {
            type: 'input',
            name: 'DB_PORT',
            message: 'Database port:',
            default: Config?.db.port
        },
        {
            type: 'input',
            name: 'DB_USER',
            message: 'Database user:',
            default: Config?.db.user
        },
        {
            type: 'password',
            name: 'DB_PASSWORD',
            message: 'Database password:',
            default: Config?.db.password || null
        },
        {
            type: 'input',
            name: 'DB_DATABASE',
            message: 'Database name:',
            default: Config?.db.database
        },
        // update mode
        {
            type: 'list',
            name: 'UPDATE_MODE',
            message: 'Update mode:',
            choices: ['polling', 'webhook'],
            default: Config?.UPDATE_MODE || 'polling',
        },
        {
            type: 'input',
            name: 'WEBHOOK_URL',
            message: 'Webhook URL:',
            default: Config?.WEBHOOK_URL || null,
            when: (answers) => answers.UPDATE_MODE === 'webhook',
            validate: (input) => {
                if (input === null) {
                    return true;
                } else {
                    return input.match(/https?:\/\/.+/) ? true : 'Please enter a valid URL';
                }
            }
        },
        // sudoers
{
            type: 'input',
            name: 'BOT_SUDOERS',
            message: 'Bot superusers (comma separated list of user IDs):',
            default: Config?.BOT_SUDOERS.join(', ') || null,
            filter: (input) => {
                return input.split(',').map(Number);
            },
            validate: (input) => {
                return input.every((id) => Number.isInteger(id)) ? true : 'Please enter a comma separated list of user IDs';
            }
        },
    ]).then(async (answers) => {
        // read .env as object
        let env = fs.readFileSync('.env', 'utf8')
            .split('\n')
            .filter(line => line.trim() !== '') // Filter out empty lines
            .reduce((acc, line) => {
                const [key, ...rest] = line.split('=');
                acc[key.trim()] = rest.join('=').trim(); // Re-join the split parts for the value
                return acc;
            }, {});

        // iterate answers object, if key is not in env, add it, otherwise update it (if value is not empty)
        for (const key in answers) {
            if (env[key] === undefined) {
                env[key] = answers[key];
            } else {
                if (answers[key] !== '') {
                    env[key] = answers[key];
                }
            }
        }

        // write back to .env
        fs.writeFileSync('.env', Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'));
    });
}

if (process.argv.length === 2) {
    console.error('Expected at least one argument!');
    process.exit(1);
} else {
    const command = process.argv[2];
    switch (command) {
        case 'env':
            prepareConfig();
            break;
        case 'db':
            preparingDatabase().then(() => {
                console.log('Database prepared');
            })
            break;
        default:
            console.error('Invalid command');
            process.exit(1);
    }
}