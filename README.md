# TheLounge External Notify Plugin

Send IRC notifications to external services like Pushover when you're highlighted in IRC.

## Features

- Get notifications on your phone or other devices when highlighted/mentioned in IRC
- Supports multiple notification services:
  - **Pushover** - Popular push notification service
  - **Prowl** - iOS push notifications (Growl compatible)
  - **ntfy.sh** - Open-source, self-hostable notification service
  - **Generic Webhook** - Send to any webhook endpoint (Discord, Slack, Mattermost, etc.)
- Smart filtering to avoid notification spam
  - Only notify when away (optional)
  - Deduplication to prevent spam
- Easy command-based configuration
- Service-agnostic architecture for easy expansion

## Installation

### Prerequisites

- TheLounge 4.0.0 or higher
- Node.js 14.0.0 or higher
- A Pushover account (free tier works great)

### Install the Plugin

1. Navigate to your TheLounge home directory:
   ```bash
   cd ~/.thelounge
   ```

2. Install the plugin:
   ```bash
   npm install thelounge-plugin-external-notify
   ```

3. Restart TheLounge:
   ```bash
   thelounge restart
   ```

### Pushover Setup

1. Sign up for a free account at [pushover.net](https://pushover.net/)
2. Note your **User Key** from the dashboard
3. Create an application at [pushover.net/apps/build](https://pushover.net/apps/build)
4. Note your **API Token** for the application

### Prowl Setup

1. Download Prowl from the [App Store](https://apps.apple.com/app/prowl-easy-push-notifications/id320876271)
2. Create an account or sign in to the Prowl app
3. Get your API key from [prowlapp.com/api_settings.php](https://www.prowlapp.com/api_settings.php)
4. Note your **40-character API Key**

### ntfy.sh Setup

1. Choose a unique topic name (e.g., `thelounge-yourname`)
2. Optional: Set up your own ntfy server at [docs.ntfy.sh/install](https://docs.ntfy.sh/install/)
3. Install the ntfy app on your device:
   - Android: [Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - iOS: [App Store](https://apps.apple.com/us/app/ntfy/id1625396347)
   - Web: [ntfy.sh/app](https://ntfy.sh/app)
4. Subscribe to your topic in the ntfy app

### Generic Webhook Setup

Works with any service that accepts webhooks:
- **Discord**: Create a webhook in Server Settings → Integrations → Webhooks
- **Slack**: Create an incoming webhook app
- **Mattermost**: Create an incoming webhook
- **Custom**: Any HTTP endpoint that accepts POST requests

## Configuration

### Quick Start (Interactive Setup)

The easiest way to configure the plugin is directly from IRC. Choose your preferred service:

#### Pushover

```
/notify config pushover userKey YOUR_30_CHARACTER_USER_KEY
/notify config pushover apiToken YOUR_30_CHARACTER_API_TOKEN
/notify enable
/notify test
```

#### Prowl

```
/notify config prowl apiKey YOUR_40_CHARACTER_API_KEY
/notify enable
/notify test
```

#### ntfy.sh

```
/notify config ntfy topic thelounge-yourname
/notify enable
/notify test
```

#### Generic Webhook

```
/notify config webhook url https://your-webhook-url
/notify enable
/notify test
```

For Discord webhooks:
```
/notify config webhook url https://discord.com/api/webhooks/YOUR_WEBHOOK
/notify config webhook bodyTemplate '{"content": "**{{title}}**\n{{message}}"}'
/notify enable
```

The configuration is automatically saved to your user config file.

### Alternative: Manual Configuration

If you prefer to edit the config file directly, you can also manually add the configuration to your network object in `~/.thelounge/users/<username>/<network>.json`:

```json
{
  "externalNotify": {
    "enabled": true,
    "services": {
      "pushover": {
        "enabled": true,
        "userKey": "your-30-character-user-key-here",
        "apiToken": "your-30-character-api-token-here",
        "priority": 0,
        "sound": "pushover"
      }
    },
    "filters": {
      "onlyWhenAway": true,
      "highlights": true
    }
  }
}
```

### Interactive Configuration Commands

You can configure all settings from within IRC using the `/notify config` command:

#### Pushover Settings
```
/notify config pushover userKey YOUR_USER_KEY
/notify config pushover apiToken YOUR_API_TOKEN
/notify config pushover priority 0           # -2 to 2
/notify config pushover sound cosmic         # Any Pushover sound
```

#### Filter Settings
```
/notify config filter onlyWhenAway true      # true or false
/notify config filter highlights true        # true or false
```

All changes are automatically saved to your user configuration file.

### Configuration Options

#### Pushover Settings

- **userKey**: Your 30-character Pushover user key (required)
- **apiToken**: Your 30-character Pushover API token (required)
- **priority**: Notification priority (-2 to 2, default: 0)
  - `-2`: No notification, just badge update
  - `-1`: Quiet notification
  - `0`: Normal priority (default)
  - `1`: High priority, bypasses quiet hours
  - `2`: Emergency priority, requires acknowledgment
- **sound**: Notification sound (default: "pushover", see [Pushover sounds](https://pushover.net/api#sounds))

#### Prowl Settings

- **apiKey**: Your 40-character Prowl API key (required)
- **priority**: Notification priority (-2 to 2, default: 0)
  - `-2`: Very Low
  - `-1`: Moderate
  - `0`: Normal (default)
  - `1`: High
  - `2`: Emergency
- **application**: Application name shown in notification (default: "TheLounge", max 256 chars)

#### ntfy.sh Settings

- **topic**: Your unique topic name (required)
- **server**: ntfy server URL (default: "https://ntfy.sh")
- **priority**: Notification priority (1-5, default: 3)
  - `1`: Min priority
  - `3`: Default priority
  - `5`: Max priority
- **tags**: Comma-separated tags (default: "", example: "irc,thelounge")

#### Generic Webhook Settings

- **url**: Webhook URL to POST notifications to (required)
- **method**: HTTP method (default: "POST", options: GET, POST, PUT, PATCH)
- **contentType**: Content-Type header (default: "application/json")
- **headers**: Custom headers as JSON string (default: "{}", example: '{"Authorization": "Bearer TOKEN"}')
- **bodyTemplate**: JSON template for request body (default: '{"title": "{{title}}", "message": "{{message}}", "timestamp": "{{timestamp}}"}')
  - Use `{{title}}`, `{{message}}`, `{{timestamp}}` as placeholders

**Common Webhook Templates:**
- Discord: `'{"content": "**{{title}}**\n{{message}}"}'`
- Slack: `'{"text": "{{title}}", "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "{{message}}"}}]}'`
- Mattermost: `'{"text": "**{{title}}**\n{{message}}"}'`

#### Filter Settings

- **onlyWhenAway**: Only send notifications when marked as away (default: `true`)
- **highlights**: Notify when your nickname is mentioned (default: `true`)

**Note**: TheLounge has built-in highlight configuration in Settings > Highlights. This plugin respects those settings when determining what triggers a notification.

## Usage

All commands are used with `/notify` in any channel or private message.

### Basic Commands

```
/notify status              Show current configuration and status
/notify enable              Enable notifications
/notify disable             Disable notifications
/notify config              Configure settings interactively
/notify test                Send a test notification
/notify help                Show help message
```

### Setup Commands

```
/notify setup pushover      Show Pushover setup instructions
/notify setup prowl         Show Prowl setup instructions
/notify setup ntfy          Show ntfy.sh setup instructions
/notify setup webhook       Show generic webhook setup instructions
```

### Customizing Notification Format

You can customize how notifications are formatted using template variables. This allows you to control exactly what information is displayed in the notification title and message.

#### Available Template Variables

- `{{network}}` - IRC network name (e.g., "freenode")
- `{{channel}}` - Channel name or "PM" for private messages (e.g., "#lounge")
- `{{nick}}` or `{{user}}` - Sender's nickname (e.g., "john")
- `{{message}}` or `{{text}}` - Message content
- `{{date}}` - Formatted date/time (e.g., "Jan 15, 14:30")
- `{{time}}` - Time only (e.g., "14:30")
- `{{timestamp}}` - ISO timestamp (e.g., "2025-01-15T14:30:00.000Z")
- `{{type}}` - Message type ("message", "action", "notice")

#### Format Configuration Commands

```
/notify config format title "{{network}}"
/notify config format message "<{{nick}}> {{message}}"
/notify config format actionMessage "* {{nick}} {{message}}"
/notify config format reset
```

#### Format Examples

**Default Format (channel messages):**
- Title: `freenode - #lounge`
- Message: `<john> Hello everyone`

**Default Format (private messages):**
- Title: `freenode`
- Message: `<john> Hi there`

**With timestamps:**
```
/notify config format message "{{time}} <{{nick}}> {{message}}"
```
Result: `14:30 <john> Hello everyone`

**Minimal format:**
```
/notify config format title "{{network}}"
/notify config format message "{{nick}}: {{message}}"
```
Result:
- Title: `freenode`
- Message: `john: Hello everyone`

**Detailed format:**
```
/notify config format title "{{network}} / {{channel}} @ {{time}}"
/notify config format message "[{{type}}] {{nick}}: {{message}}"
```
Result:
- Title: `freenode / #lounge @ 14:30`
- Message: `[message] john: Hello everyone`

## Example Configurations

### Minimal - Only Highlights When Away

```json
{
  "enabled": true,
  "services": {
    "pushover": {
      "enabled": true,
      "userKey": "your-user-key",
      "apiToken": "your-api-token",
      "priority": 0,
      "sound": "pushover"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### Always Notify on Highlights

```json
{
  "enabled": true,
  "services": {
    "pushover": {
      "enabled": true,
      "userKey": "your-user-key",
      "apiToken": "your-api-token",
      "priority": 1,
      "sound": "cosmic"
    }
  },
  "filters": {
    "onlyWhenAway": false,
    "highlights": true
  }
}
```

### Quiet Notifications

```json
{
  "enabled": true,
  "services": {
    "pushover": {
      "enabled": true,
      "userKey": "your-user-key",
      "apiToken": "your-api-token",
      "priority": -1,
      "sound": "none"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### Prowl - iOS Notifications

```json
{
  "enabled": true,
  "services": {
    "prowl": {
      "enabled": true,
      "apiKey": "your-40-character-api-key",
      "priority": 0,
      "application": "TheLounge"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### ntfy.sh - Public Server

```json
{
  "enabled": true,
  "services": {
    "ntfy": {
      "enabled": true,
      "server": "https://ntfy.sh",
      "topic": "thelounge-yourname",
      "priority": 3,
      "tags": "irc,thelounge"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### ntfy.sh - Self-Hosted

```json
{
  "enabled": true,
  "services": {
    "ntfy": {
      "enabled": true,
      "server": "https://ntfy.example.com",
      "topic": "irc-notifications",
      "priority": 4,
      "tags": ""
    }
  },
  "filters": {
    "onlyWhenAway": false,
    "highlights": true
  }
}
```

### Generic Webhook - Discord

```json
{
  "enabled": true,
  "services": {
    "webhook": {
      "enabled": true,
      "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
      "method": "POST",
      "contentType": "application/json",
      "headers": "{}",
      "bodyTemplate": "{\"content\": \"**{{title}}**\\n{{message}}\"}"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### Generic Webhook - Slack

```json
{
  "enabled": true,
  "services": {
    "webhook": {
      "enabled": true,
      "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "method": "POST",
      "contentType": "application/json",
      "headers": "{}",
      "bodyTemplate": "{\"text\": \"{{title}}\", \"blocks\": [{\"type\": \"section\", \"text\": {\"type\": \"mrkdwn\", \"text\": \"{{message}}\"}}]}"
    }
  },
  "filters": {
    "onlyWhenAway": false,
    "highlights": true
  }
}
```

### Multiple Services

You can use multiple services simultaneously:

```json
{
  "enabled": true,
  "services": {
    "pushover": {
      "enabled": true,
      "userKey": "your-user-key",
      "apiToken": "your-api-token",
      "priority": 0,
      "sound": "pushover"
    },
    "prowl": {
      "enabled": true,
      "apiKey": "your-40-character-api-key",
      "priority": 0,
      "application": "TheLounge"
    },
    "ntfy": {
      "enabled": true,
      "server": "https://ntfy.sh",
      "topic": "thelounge-backup",
      "priority": 3,
      "tags": "irc"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  }
}
```

### Custom Notification Format

Customize how notifications are displayed with template variables:

```json
{
  "enabled": true,
  "services": {
    "pushover": {
      "enabled": true,
      "userKey": "your-user-key",
      "apiToken": "your-api-token",
      "priority": 0,
      "sound": "pushover"
    }
  },
  "filters": {
    "onlyWhenAway": true,
    "highlights": true
  },
  "format": {
    "title": "{{network}}",
    "titleWithChannel": "{{network}} / {{channel}}",
    "message": "{{time}} <{{nick}}> {{message}}",
    "actionMessage": "{{time}} * {{nick}} {{message}}"
  }
}
```

This will display notifications like:
- Title: `freenode / #lounge` (for channel messages) or `freenode` (for PMs)
- Message: `14:30 <john> Hello everyone`

## Troubleshooting

### Notifications not working

1. Check plugin is loaded:
   ```
   /notify status
   ```

2. Verify configuration file exists and has valid JSON

3. Check TheLounge logs for errors:
   ```bash
   thelounge logs
   ```

4. Send a test notification:
   ```
   /notify test
   ```

### Configuration location

The configuration is stored in your TheLounge user config file:
```
~/.thelounge/users/<username>/<network>.json
```

Look for the `externalNotify` property. Replace `<username>` and `<network>` with your TheLounge username and network name.

### Invalid Pushover credentials

- Verify your User Key is exactly 30 characters
- Verify your API Token is exactly 30 characters
- Make sure there are no extra spaces or quotes
- Test your credentials at [pushover.net](https://pushover.net/)

### Notifications too frequent

Adjust your filters:
- Set `onlyWhenAway: true` to only notify when away
- Disable notifications when you're actively using IRC

### Highlight Detection

This plugin uses TheLounge's built-in highlight detection. To customize what triggers highlights:

1. Go to Settings (gear icon in TheLounge)
2. Navigate to "Highlights"
3. Add custom highlight words/patterns

The plugin will send notifications for any message that TheLounge marks as a highlight.

## Development

### Project Structure

```
thelounge-plugin-external-notify/
├── index.js                      # Main plugin entry point
├── package.json                  # Plugin metadata
├── lib/
│   ├── commands.js              # Command implementations
│   ├── config-manager.js        # Configuration handling
│   ├── notification-manager.js  # Notification routing logic
│   ├── format.js                # Message formatting utilities
│   ├── message.js               # Message sending utility
│   └── notifiers/
│       ├── base.js             # Abstract notifier interface
│       ├── pushover.js         # Pushover implementation
│       └── example.js          # Example notifier template
└── test/
    ├── config-manager.test.js
    ├── notification-manager.test.js
    ├── pushover.test.js
    ├── integration.test.js
    └── simple.test.js
```

### Adding New Notifiers

To add support for a new service:

1. Create `lib/notifiers/yourservice.js` extending `BaseNotifier`
2. Implement required methods:
   - `constructor()` - Set up registerVariables with required/optional fields
   - Define defaults for optional fields
   - Let BaseNotifier handle validation
3. The plugin will automatically:
   - Load your notifier when configured
   - Validate configuration using your registerVariables
   - Apply defaults for optional fields

See `lib/notifiers/pushover.js` for a complete example.

### Design Philosophy

**Service-Agnostic Architecture:**
- Core infrastructure (`config-manager.js`, `notification-manager.js`) knows nothing about specific services
- Each notifier (`lib/notifiers/*.js`) manages its own:
  - Configuration schema (via `registerVariables`)
  - Validation logic (via `validate()`)
  - Default values for optional fields
  - API integration

**Benefits:**
- Easy to add new notification services
- No service-specific code in core files
- Each service is self-contained and maintainable

## Testing

Run the test suite:
```bash
npm test
```

See `TESTING.md` for detailed testing instructions.

## License

MIT

## Support

- Report bugs at: [GitHub Issues](https://github.com/z0mbieparade/thelounge-plugin-external-notify/issues)
- TheLounge documentation: [thelounge.chat](https://thelounge.chat/)
- Pushover API docs: [pushover.net/api](https://pushover.net/api)
- Prowl API docs: [prowlapp.com/api/api](https://www.prowlapp.com/api.php)
- Ntfy docs: [https://docs.ntfy.sh](https://docs.ntfy.sh)