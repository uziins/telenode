# Auth Helper Documentation

The Auth helper is a comprehensive authorization and permission management system for the Telenode bot application. It provides user authentication, role-based access control, caching, and monitoring capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Core Concepts](#core-concepts)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Caching System](#caching-system)
8. [Monitoring and Metrics](#monitoring-and-metrics)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

## Overview

The Auth helper manages:
- User authentication and authorization
- Role-based permissions (Root, Admin, Regular users)
- Chat-level and user-level blocking/banning
- Caching for performance optimization
- Comprehensive metrics and monitoring
- Database integration with users, chats, and authorizations

## Installation

The Auth helper is automatically loaded as part of the Telenode application. It requires the following dependencies:

```javascript
import Auth from "./src/helpers/auth.js";

// Initialize
const auth = new Auth();
```

## Configuration

The Auth helper uses configuration from `config.js`:

```javascript
// Required configuration
config.BOT_SUDOERS = [12345, 67890]; // Root user IDs
config.cache = {
    ttl: 300,        // Cache timeout in seconds
    maxSize: 1000    // Maximum cache entries
};
config.LOG_LEVEL = "info";
```

## Core Concepts

### User Roles

1. **Root Users**: Defined in `config.BOT_SUDOERS`, have unlimited access
2. **Admin Users**: Have elevated permissions in specific chats
3. **Regular Users**: Standard access based on blocking/banning status

### Permission Levels

- **Global Level**: User blocking affects all chats
- **Chat Level**: Chat blocking affects all users in that chat
- **User-Chat Level**: Specific user banning in individual chats

### Cache System

- **TTL-based**: Entries expire after configured timeout
- **Size-limited**: Automatic cleanup when cache grows too large
- **Type-specific**: Different cache keys for users, chats, and permissions

## API Reference

### Constructor

```javascript
new Auth()
```

Creates a new Auth instance with automatic initialization, cache setup, and admin loading.

### Core Authorization Methods

#### `isGranted(message)`

Main authorization check method.

```javascript
const granted = await auth.isGranted(message);
// Returns: boolean
```

**Parameters:**
- `message`: Telegram message object with `from` and `chat` properties

**Returns:** Boolean indicating if access is granted

**Process:**
1. Checks if user is root (immediate grant)
2. Validates chat permissions
3. Validates user permissions
4. Checks for chat-specific bans
5. Caches result for performance

### Role Management

#### `isRoot(user_id)`

Check if user is a root user.

```javascript
const isRoot = auth.isRoot(user_id);
// Returns: boolean
```

#### `isAdmin(user_id, chat_id)`

Check if user is admin in specific chat.

```javascript
const isAdmin = auth.isAdmin(user_id, chat_id);
// Returns: boolean
```

#### `addAdmin(user_id, chat_id)`

Add user as admin in specific chat.

```javascript
const result = await auth.addAdmin(user_id, chat_id);
// Returns: { success: boolean, message?: string, error?: string }
```

**Validation:**
- Prevents adding already-admin users
- Prevents adding blocked users as admins
- Updates both database and in-memory cache

#### `removeAdmin(user_id, chat_id)`

Remove admin privileges from user in specific chat.

```javascript
const result = await auth.removeAdmin(user_id, chat_id);
// Returns: { success: boolean, message?: string, error?: string }
```

### User Management

#### `blockUser(user_id, reason, blocked_by)`

Block user globally across all chats.

```javascript
const result = await auth.blockUser(user_id);
// Returns: { success: boolean, message?: string, error?: string }
```

**Parameters:**
- `user_id`: ID of user to block
- `reason`: Optional reason for blocking
- `blocked_by`: Optional ID of user performing the block

**Features:**
- Prevents blocking root users
- Checks if user is already blocked
- Clears relevant cache entries
- Logs action with details

#### `unblockUser(user_id)`

Unblock previously blocked user.

```javascript
const result = await auth.unblockUser(user_id);
// Returns: { success: boolean, message?: string, error?: string }
```

#### `banUser(user_id, chat_id, reason, banned_by)`

Ban user from specific chat.

```javascript
const result = await auth.banUser(user_id, chat_id, "Inappropriate behavior", admin_id);
// Returns: { success: boolean, message?: string, error?: string }
```

**Features:**
- Chat-specific banning
- Prevents banning root users
- Tracks who performed the ban and when
- Supports ban reasons

#### `unbanUser(user_id, chat_id, unbanned_by)`

Remove chat-specific ban.

```javascript
const result = await auth.unbanUser(user_id, chat_id, admin_id);
// Returns: { success: boolean, message?: string, error?: string }
```

#### `isUserBannedFromChat(user_id, chat_id)`

Check if user is banned from specific chat.

```javascript
const isBanned = await auth.isUserBannedFromChat(user_id, chat_id);
// Returns: boolean
```

### Chat Management

#### `blockChat(chat_id)`

Block entire chat.

```javascript
const result = await auth.blockChat(chat_id);
// Returns: { success: boolean, message?: string, error?: string }
```

#### `unblockChat(chat_id)`

Unblock previously blocked chat.

```javascript
const result = await auth.unblockChat(chat_id);
// Returns: { success: boolean, message?: string, error?: string }
```

### Information Retrieval

#### `getUserInfo(user_id)`

Get comprehensive user information.

```javascript
const userInfo = await auth.getUserInfo(user_id);
// Returns: { success: boolean, data?: object, error?: string }
```

**Response data:**
```javascript
{
    id: user_id,
    username: "username",
    first_name: "First",
    last_name: "Last",
    is_blocked: false,
    is_bot: false,
    is_root: false,
    admin_chats: [chat_id1, chat_id2]
}
```

#### `getChatInfo(chat_id)`

Get comprehensive chat information.

```javascript
const chatInfo = await auth.getChatInfo(chat_id);
// Returns: { success: boolean, data?: object, error?: string }
```

#### `listAdmins(chat_id)`

List admins for specific chat or all chats.

```javascript
const admins = await auth.listAdmins(chat_id); // Specific chat
const allAdmins = await auth.listAdmins(); // All chats
// Returns: { success: boolean, data: array }
```

#### `getBannedUsersInChat(chat_id)`

Get list of banned users in specific chat.

```javascript
const bannedUsers = await auth.getBannedUsersInChat(chat_id);
// Returns: { success: boolean, data?: array, error?: string }
```

#### `getUserBannedChats(user_id)`

Get list of chats where user is banned.

```javascript
const bannedChats = await auth.getUserBannedChats(user_id);
// Returns: { success: boolean, data?: array, error?: string }
```

## Usage Examples

### Basic Authorization Check

```javascript
import Auth from "./src/helpers/auth.js";

const auth = new Auth();

// In your message handler
async function handleMessage(message) {
    const granted = await auth.isGranted(message);
    
    if (!granted) {
        return bot.sendMessage(message.chat.id, "Access denied");
    }
    
    // Process message
}
```

### Admin Management

```javascript
// Add admin
async function addChatAdmin(message, user_id) {
    // Check if requester is root or existing admin
    if (!auth.isRoot(message.from.id) && !auth.isAdmin(message.from.id, message.chat.id)) {
        return bot.sendMessage(message.chat.id, "Insufficient permissions");
    }
    
    const result = await auth.addAdmin(user_id, message.chat.id);
    
    if (result.success) {
        bot.sendMessage(message.chat.id, `User ${user_id} is now an admin`);
    } else {
        bot.sendMessage(message.chat.id, `Failed: ${result.message || result.error}`);
    }
}
```

### User Blocking

```javascript
// Block user globally
async function blockUser(message, user_id) {
    if (!auth.isRoot(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Only root users can block users globally");
    }
    
    const result = await auth.blockUser(user_id);
    
    if (result.success) {
        bot.sendMessage(message.chat.id, `User ${user_id} has been blocked`);
    } else {
        bot.sendMessage(message.chat.id, `Failed: ${result.message || result.error}`);
    }
}
```

### Chat-specific Banning

```javascript
// Ban user from current chat
async function banUserFromChat(message, user_id, reason) {
    if (!auth.isAdmin(message.from.id, message.chat.id) && !auth.isRoot(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Admin privileges required");
    }
    
    const result = await auth.banUser(user_id, message.chat.id, reason, message.from.id);
    
    if (result.success) {
        bot.sendMessage(message.chat.id, `User ${user_id} has been banned from this chat`);
    } else {
        bot.sendMessage(message.chat.id, `Failed: ${result.message || result.error}`);
    }
}
```

## Caching System

The Auth helper implements a sophisticated caching system for performance optimization:

### Cache Types

- **User permissions**: `user:{user_id}`
- **Chat permissions**: `chat:{chat_id}`
- **Authorization results**: `granted:{user_id}:{chat_id}`

### Cache Management

```javascript
// Manual cache operations
const cacheKey = auth.getCacheKey('user', user_id);
const cached = auth.getFromCache(cacheKey);
auth.setCache(cacheKey, value);

// Clear specific user cache
auth.clearUserCache(user_id, chat_id);
```

### Cache Cleanup

- **Automatic**: Runs on configured interval
- **TTL-based**: Removes expired entries
- **Size-based**: Removes oldest entries when cache is full

## Monitoring and Metrics

### Statistics Overview

```javascript
const stats = auth.getStats();
console.log(stats);
```

**Returns comprehensive statistics:**

```javascript
{
    cache: {
        size: 150,
        maxSize: 1000,
        utilization: 15.0,
        hitRate: 85.5,
        hits: 1200,
        misses: 210,
        totalCleanups: 5,
        lastCleanup: "2025-09-08T10:30:00.000Z",
        timeoutMs: 300000
    },
    authorization: {
        adminCount: 25,
        rootUsersCount: 2,
        totalAuthChecks: 5000,
        blockedAttempts: 150,
        blockRate: 3.0
    },
    performance: {
        uptime: {
            ms: 3600000,
            seconds: 3600,
            minutes: 60,
            hours: 1
        },
        avgResponseTime: 12.5,
        recentResponseTimes: [10, 15, 8, 20, 12],
        totalQueries: 5000
    },
    database: {
        connectionCount: 3,
        connections: [
            { type: "Authorizations", status: "active" },
            { type: "Chats", status: "active" },
            { type: "Users", status: "active" }
        ]
    },
    system: {
        memoryUsage: {
            rss: 45.2,
            heapTotal: 20.1,
            heapUsed: 15.3,
            external: 2.1,
            arrayBuffers: 0.5
        },
        timestamp: "2025-09-08T11:30:00.000Z",
        nodeVersion: "v18.17.0",
        platform: "linux"
    }
}
```

### Detailed Cache Statistics

```javascript
const detailedStats = auth.getDetailedCacheStats();
```

### Metrics Reset

```javascript
auth.resetMetrics(); // Reset all performance metrics
```

## Error Handling

The Auth helper implements comprehensive error handling:

### Standard Response Format

```javascript
{
    success: boolean,
    message?: string,  // Success or error message
    error?: string,    // Detailed error information
    data?: any        // Response data when applicable
}
```

### Common Error Scenarios

1. **Invalid Parameters**: Missing required user_id or chat_id
2. **Permission Denied**: Attempting unauthorized actions
3. **Database Errors**: Connection or query failures
4. **Validation Errors**: Invalid data or state conflicts

### Error Logging

All errors are automatically logged with appropriate levels:
- `log.error()`: Critical errors
- `log.warn()`: Warning conditions
- `log.debug()`: Debug information

## Best Practices

### 1. Always Check Authorization

```javascript
// Good
const granted = await auth.isGranted(message);
if (!granted) return;

// Bad - skipping authorization
processMessage(message);
```

### 2. Handle Async Operations

```javascript
// Good
try {
    const result = await auth.addAdmin(user_id, chat_id);
    if (result.success) {
        // Handle success
    } else {
        // Handle failure
    }
} catch (error) {
    // Handle error
}
```

### 3. Use Appropriate Permission Levels

```javascript
// Global blocking - only for root users
if (auth.isRoot(admin_id)) {
    await auth.blockUser(user_id);
}

// Chat banning - for admins and root users
if (auth.isAdmin(admin_id, chat_id) || auth.isRoot(admin_id)) {
    await auth.banUser(user_id, chat_id, reason, admin_id);
}
```

### 4. Monitor Performance

```javascript
// Regular monitoring
setInterval(() => {
    const stats = auth.getStats();
    if (stats.cache.hitRate < 80) {
        console.warn("Low cache hit rate:", stats.cache.hitRate);
    }
}, 60000);
```

### 5. Proper Cleanup

```javascript
// In application shutdown
process.on('SIGTERM', async () => {
    await auth.destroy();
    process.exit(0);
});
```

### 6. Cache Optimization

- Use consistent cache keys
- Clear cache after modifications
- Monitor cache hit rates
- Adjust cache size based on usage

### 7. Error Recovery

```javascript
// Implement fallback for critical operations
async function safeAuthCheck(message) {
    try {
        return await auth.isGranted(message);
    } catch (error) {
        console.error("Auth check failed:", error);
        // Fallback to basic checks
        return !auth.isRoot(message.from.id); // Deny non-root users on error
    }
}
```

## Database Schema

The Auth helper works with three main database tables:

### Users Table
- `id`: Primary key (Telegram user ID)
- `username`, `first_name`, `last_name`: User details
- `is_blocked`: Global blocking status
- `blocked_reason`, `blocked_at`, `blocked_by`: Blocking metadata

### Chats Table
- `id`: Primary key (Telegram chat ID)
- `title`, `type`: Chat details
- `is_blocked`: Chat blocking status
- `blocked_reason`, `blocked_at`, `blocked_by`: Blocking metadata

### Authorizations Table
- `user_id`, `chat_id`: Composite key
- `role`: User role ('admin', 'banned')
- `granted_by`, `granted_at`: Grant metadata
- `note`: Additional information

## Security Considerations

1. **Root User Protection**: Root users cannot be blocked or banned
2. **Input Validation**: All user inputs are validated
3. **SQL Injection Prevention**: Uses parameterized queries
4. **Cache Security**: Sensitive data is not cached unnecessarily
5. **Audit Trail**: All actions are logged with context

## Performance Optimization

1. **Caching Strategy**: Intelligent caching reduces database queries
2. **Batch Operations**: Efficient database operations
3. **Memory Management**: Automatic cache cleanup prevents memory leaks
4. **Connection Pooling**: Reuses database connections
5. **Metrics Tracking**: Monitors performance for optimization

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Check cache size and cleanup intervals
2. **Slow Authorization**: Monitor cache hit rates and database performance
3. **Permission Errors**: Verify user roles and chat permissions
4. **Database Errors**: Check connection status and query logs

### Debug Mode

Enable debug logging for detailed information:

```javascript
// In config.js
config.LOG_LEVEL = "debug";
```

### Cache Analysis

```javascript
// Check cache utilization
const stats = auth.getStats();
console.log("Cache utilization:", stats.cache.utilization);

// Get detailed cache breakdown
const detailed = auth.getDetailedCacheStats();
console.log("Cache types:", detailed.typeBreakdown);
```

This documentation provides a comprehensive guide to using the Auth helper effectively in your Telenode bot application.
