const Config = require('./config');
const PluginModel = require('./models/plugins');
const UserModel = require('./models/users');
const Plugin = new PluginModel();
const User = new UserModel();

function preparingDatabase() {
    console.log('Preparing database...');
    User.rawQuery('CREATE TABLE IF NOT EXISTS users (' +
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
    Plugin.rawQuery('CREATE TABLE IF NOT EXISTS plugins (' +
        'id INT AUTO_INCREMENT PRIMARY KEY,' +
        'name VARCHAR(255),' +
        'description TEXT, ' +
        'is_active BOOLEAN DEFAULT 0,' +
        'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
        'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').then(() => {
      console.log('Table plugins created')
    });
    console.log('Database prepared');
}

preparingDatabase();
// process.exit(0)

// TODO: make install script