"use strict";

const ConfigManager = require("./lib/config-manager");
const NotificationManager = require("./lib/notification-manager");
const { F, C } = require("./lib/format");
const sendMessage = require("./lib/message");
const { checkForUpdate } = require("./lib/version-check");

// Plugin state management - tracks active notification sessions
// Key: `${clientId}-${networkId}`
const pluginState = new Map();

let apiInstance = null;

// Storage directory for plugin configs
let storageDir = null;

/**
 * Helper: Get logger instance (uses TheLounge logger if available, falls back to console)
 */
function getLogger() {
	return apiInstance ? apiInstance.Logger : console;
}

/**
 * Get or create plugin state for a client-network pair
 */
function getPluginState(client, network) {
	const key = `${client.id}-${network.uuid}`;

	if (!pluginState.has(key)) {
		const configManager = new ConfigManager(client, storageDir);
		const config = configManager.load();

		pluginState.set(key, {
			enabled: config.enabled || false,
			client: client,
			network: network,
			configManager: configManager,
			notificationManager: null, // Created when enabled
			listenersSetup: false,
			virtualChannel: null // Virtual channel for settings/status
		});

		// If enabled in config, initialize notification manager
		if (config.enabled && config.services && Object.keys(config.services).length > 0) {
			const state = pluginState.get(key);
			state.notificationManager = new NotificationManager(
				config,
				getLogger()
			);
			setupMessageMonitoring(state);
		}
	}

	return pluginState.get(key);
}

/**
 * Get or create the virtual channel for notifications UI
 */
function getOrCreateVirtualChannel(client, network) {
	const state = getPluginState(client, network);

	// Check if virtual channel already exists
	if (state.virtualChannel) {
		return state.virtualChannel;
	}

	// Load config to get channel name
	const config = state.configManager.load();
	const channelName = config.channelName || "external-notify";

	// Get version for channel topic
	const packageJson = require("./package.json");
	const version = packageJson.version || "1.0.0";
	const channelTopic = `External Notify - Settings & Status (v${version})`;

	// Check if channel already exists in network
	let virtualChannel = network.channels.find(chan =>
		chan.name === channelName && chan.topic.startsWith("External Notify - Settings & Status")
	);

	if (!virtualChannel) {
		// Create new virtual channel
		virtualChannel = client.createChannel({
			name: channelName,
			type: "channel",  // Use channel type so messages display properly
			topic: channelTopic
		});

		// Add to channels array (our export hook will filter it out when saving)
		network.channels.push(virtualChannel);
		const channelIndex = network.channels.length - 1;

		sendMessage(client, network, F.HEADER("External Notify Plugin"));

		// Send welcome message and help text
		const commands = require("./lib/commands");
		commands.handleHelp(client, network);

		// Check for updates (non-blocking)
		const packageJson = require("./package.json");
		if (packageJson.repository && packageJson.repository.url) {
			checkForUpdate(packageJson.version, packageJson.repository.url)
				.then(updateInfo => {
					if (updateInfo.updateAvailable) {
						sendMessage(client, network, [
							F.BREAK,
							`${C.WARNING}⚠ Update Available${C.RESET}`,
							F.INDENT(1, `Current version: ${C.CYAN}v${updateInfo.currentVersion}${C.RESET}`),
							F.INDENT(1, `Latest version: ${C.SUCCESS}v${updateInfo.latestVersion}${C.RESET}`),
							F.INDENT(1, `Run ${C.BOLD}npm update thelounge-plugin-external-notify${C.RESET} to update`),
							F.BREAK
						]);
					}
				})
				.catch(err => {
					// Silently ignore version check errors
					if (apiInstance) {
						apiInstance.Logger.debug(`Version check failed: ${err.message}`);
					}
				});
		}

		// Notify client about new channel
		if (client.manager && client.manager.sockets) {
			client.manager.sockets.to(client.id).emit("join", {
				network: network.uuid,
				chan: virtualChannel.getFilteredClone(client),
				index: channelIndex
			});
		}
	} else {
		// Update topic if it doesn't match current version
		if (virtualChannel.topic !== channelTopic) {
			virtualChannel.topic = channelTopic;
		}
	}

	// Store in state
	state.virtualChannel = virtualChannel;

	return virtualChannel;
}

/**
 * Setup message monitoring by wrapping channel pushMessage methods
 * This gives us access to messages after TheLounge has determined if they're highlights
 */
function setupMessageMonitoring(state) {
	if (state.listenersSetup) {
		return;
	}

	const { network, client } = state;

	// Wrap pushMessage for all channels in this network
	for (const channel of network.channels) {
		wrapChannelPushMessage(channel, state);
	}

	// Also watch for new channels being added
	const originalAddChannel = network.addChannel.bind(network);
	network.addChannel = function(channel) {
		const result = originalAddChannel(channel);
		wrapChannelPushMessage(channel, state);
		return result;
	};

	state.listenersSetup = true;

	if (apiInstance) {
		apiInstance.Logger.debug(`Message monitoring setup for ${client.name} on ${network.name}`);
	}
}

/**
 * Wrap a channel's pushMessage method to intercept messages
 */
function wrapChannelPushMessage(channel, state) {
	// Skip if already wrapped
	if (channel._externalNotifyWrapped) {
		return;
	}

	const originalPushMessage = channel.pushMessage.bind(channel);

	channel.pushMessage = function(client, msg, increasesUnread) {
		// Call original first
		const result = originalPushMessage(client, msg, increasesUnread);

		// Then check if we should send notification
		handleTheloungeMessage(state, channel, msg);

		return result;
	};

	channel._externalNotifyWrapped = true;
}

/**
 * Handle TheLounge's processed messages
 * At this point, msg.highlight is already set based on TheLounge's highlight detection
 */
function handleTheloungeMessage(state, channel, msg) {
	if (!state.enabled || !state.notificationManager) {
		return;
	}

	const { client, network } = state;

	// Skip messages from self
	if (msg.self) {
		return;
	}

	// Only process MESSAGE, ACTION, and NOTICE types
	if (!["message", "action", "notice"].includes(msg.type)) {
		return;
	}

	// Build message data with TheLounge's processed information
	const messageData = {
		type: msg.type,
		network: network.name,
		channel: channel.name,
		nick: msg.from.nick || msg.from,
		message: msg.text,
		timestamp: msg.time,
		highlight: msg.highlight || false // Use TheLounge's highlight detection
	};

	// Let notification manager decide if this should trigger a notification
	state.notificationManager.processMessage(messageData, client)
		.then(result => {
			if (result && result.services.length > 0) {
				// Log notification to virtual channel
				logNotificationToChannel(state, result);
			}
		})
		.catch(err => {
			if (apiInstance) {
				apiInstance.Logger.error(`Error processing notification: ${err.message}`);
			}
		});
}

/**
 * Log notification activity to the virtual channel
 */
function logNotificationToChannel(state, result) {
	try {
		const time = result.notification.timestamp.toLocaleTimeString();
		const services = result.services.join(", ");
		const text = `[${time}] Notification sent via ${services}: ${result.notification.title} - ${result.notification.message}`;

		sendMessage(state.client, state.network, text);
	} catch (err) {
		if (apiInstance) {
			apiInstance.Logger.error(`Error logging notification to channel: ${err.message}`);
		}
	}
}

/**
 * Enable notifications for a client-network pair
 */
function enableNotifications(client, network) {
	const state = getPluginState(client, network);

	// Load configuration
	const config = state.configManager.load();

	if (!config || !config.services || Object.keys(config.services).length === 0) {
		return {
			success: false,
			message: "No notification services configured. Use /notify setup <service> first."
		};
	}

	// Create notification manager
	state.notificationManager = new NotificationManager(
		config,
		getLogger()
	);

	// Setup message monitoring
	setupMessageMonitoring(state);

	state.enabled = true;

	// Save enabled state to config
	config.enabled = true;
	state.configManager.save(config);

	return {
		success: true,
		message: "External notifications enabled"
	};
}

/**
 * Disable notifications for a client-network pair
 */
function disableNotifications(client, network) {
	const state = getPluginState(client, network);
	state.enabled = false;

	// Save disabled state to config
	const config = state.configManager.load();
	config.enabled = false;
	state.configManager.save(config);

	return {
		success: true,
		message: "External notifications disabled"
	};
}

/**
 * Get notification status for a client-network pair
 */
function getStatus(client, network) {
	const state = getPluginState(client, network);
	const config = state.configManager.load();

	return {
		enabled: state.enabled,
		config: config
	};
}

/**
 * Main plugin entry point
 * Called when TheLounge server starts
 */
module.exports = {
	onServerStart(api) {
		apiInstance = api;

		// Get plugin storage directory
		storageDir = api.Config.getPersistentStorageDir("thelounge-plugin-external-notify");
		api.Logger.info(`External Notify plugin loaded, using storage: ${storageDir}`);

		// Verify storage directory is writable
		const fs = require("fs");
		const path = require("path");
		try {
			if (!fs.existsSync(storageDir)) {
				fs.mkdirSync(storageDir, { recursive: true });
				api.Logger.info(`Created storage directory: ${storageDir}`);
			}

			// Test write permissions
			const testFile = path.join(storageDir, '.write-test');
			fs.writeFileSync(testFile, 'test', 'utf8');
			fs.unlinkSync(testFile);
			api.Logger.info(`Storage directory is writable`);
		} catch (err) {
			api.Logger.error(`Storage directory is NOT writable: ${err.message}`);
			api.Logger.error(`This will prevent configuration from being saved!`);
			api.Logger.error(`Check Docker volume permissions for: ${storageDir}`);
		}

		// Register the /notify command
		const commands = require("./lib/commands");
		api.Commands.add("notify", commands.notifyCommand);

		api.Logger.info("Use /notify to configure external notifications");
	},

	// Export utility functions for use by commands module
	getPluginState,
	getOrCreateVirtualChannel,
	enableNotifications,
	disableNotifications,
	getStatus,
	getApi: () => apiInstance
};
