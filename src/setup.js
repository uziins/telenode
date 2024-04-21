import Config from "./config.js";
import PluginModel from "./models/plugins.js";
import UserModel from "./models/users.js";

const Plugin = new PluginModel();
const User = new UserModel();

async function preparingDatabase() {
    console.log('Preparing database...');
    // check tables plugins exists
    await Plugin.rawQuery('SHOW TABLES LIKE "plugins"').then(async (result) => {
        if (result.length === 0) {
            await Plugin.rawQuery('CREATE TABLE IF NOT EXISTS plugins (' +
                'id INT AUTO_INCREMENT PRIMARY KEY,' +
                'plugin_name VARCHAR(255) NOT NULL,' +
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

    // check tables users exists
    await User.rawQuery('SHOW TABLES LIKE "users"').then(async (result) => {
        if (result.length === 0) {
            await User.rawQuery('CREATE TABLE IF NOT EXISTS users (' +
                'id INT PRIMARY KEY,' +
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

    // check tables authorizations exists
    await User.rawQuery('SHOW TABLES LIKE "authorizations"').then(async (result) => {
        if (result.length === 0) {
            // use user_id and chat_id as primary key
            await User.rawQuery('CREATE TABLE IF NOT EXISTS authorizations (' +
                'user_id INT NOT NULL,' +
                'chat_id INT NOT NULL,' +
                'PRIMARY KEY (user_id, chat_id),' +
                'role ENUM("root", "admin", "user") DEFAULT "user",' +
                'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
                'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
                console.log('Table authorizations created')
            });
        }
    });

    console.log('Database prepared');
}

await preparingDatabase();
process.exit(0)

// TODO: make install script