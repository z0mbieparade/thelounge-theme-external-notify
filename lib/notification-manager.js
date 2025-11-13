"use strict";

const FormatTemplate = require('./format-template');

/**
 * Notification Manager
 * Central routing and filtering logic for notifications
 */
class NotificationManager {
	constructor(config, logger) {
		this.config = config;
		this.logger = logger;
		this.notifiers = {};
		this.recentNotifications = new Set();

		// Initialize configured notifiers
		this.initializeNotifiers();

		// Cleanup recent notifications every minute
		setInterval(() => this.cleanupRecentNotifications(), 60000);
	}

	/**
	 * Initialize notification service clients
	 * Dynamically loads notifiers based on configured services
	 * Only initializes services that are enabled
	 */
	initializeNotifiers() {
		if (!this.config.services) {
			return;
		}

		// Iterate through configured services
		for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
			if (!serviceConfig) {
				continue;
			}

			// Skip if service is not enabled
			if (!serviceConfig.enabled) {
				this.logger.debug(`Skipping ${serviceName}: service is not enabled`);
				continue;
			}

			try {
				// Try to load the notifier class
				const NotifierClass = require(`./notifiers/${serviceName}`);

				// Instantiate the notifier
				const newNotifier = new NotifierClass(
					serviceConfig,
					this.logger
				);

				// Only add if successfully setup
				if (!newNotifier.isMetadataMode) {
					this.notifiers[newNotifier.name] = newNotifier;
					this.logger.info(`${newNotifier.name} notifier initialized`);
				} else {
					this.logger.warn(`${serviceName} is enabled but failed validation`);
				}
			} catch (err) {
				this.logger.error(`Failed to initialize ${serviceName}: ${err.message}`);
			}
		}
	}

	/**
	 * Process an IRC message and determine if notification should be sent
	 * Returns notification details if sent, null otherwise
	 */
	async processMessage(messageData, client) {
		// Check filters
		if (!this.shouldNotify(messageData, client)) {
			return null;
		}

		// Check deduplication
		const dedupKey = this.getDeduplicationKey(messageData);
		if (this.recentNotifications.has(dedupKey)) {
			this.logger.debug(`Skipping duplicate notification: ${dedupKey}`);
			return null;
		}

		// Add to recent notifications
		this.recentNotifications.add(dedupKey);

		// Format notification
		const notification = this.formatNotification(messageData);

		// Send to all configured notifiers
		const promises = [];
		const sentVia = [];
		for (const [name, notifier] of Object.entries(this.notifiers)) {
			this.logger.debug(`Sending notification via ${name}`);
			promises.push(
				notifier.send(notification)
					.then(() => {
						sentVia.push(name);
					})
					.catch(err => {
						this.logger.error(`Failed to send via ${name}: ${err.message}`);
					})
			);
		}

		await Promise.all(promises);

		// Return details about what was sent
		return {
			notification: notification,
			services: sentVia,
			messageData: messageData
		};
	}

	/**
	 * Determine if a message should trigger a notification
	 */
	shouldNotify(messageData, client) {
		const filters = this.config.filters;

		this.logger.debug(`Checking notification for message from ${messageData.nick} in ${messageData.channel}: "${messageData.message}"`);

		// Check if user is away (if onlyWhenAway is enabled)
		if (filters.onlyWhenAway) {
			// Check if the client is marked as away using TheLounge's user.away property
			if (client.user && !client.user.away) {
				this.logger.debug(`Skipping notification: onlyWhenAway is enabled and user is not away`);
				return false;
			}
		}

		// Check if message is a highlight
		// TheLounge has already determined this based on user's nick and custom highlight words
		// configured in TheLounge's settings (clientSettings.highlights)
		if (filters.highlights && messageData.highlight) {
			this.logger.debug(`Message is a highlight - sending notification`);
			return true;
		}

		this.logger.debug(`Message is not a highlight - skipping notification`);
		return false;
	}

	/**
	 * Format notification message using templates
	 */
	formatNotification(messageData) {
		// Get format templates from config or use defaults
		const format = this.config.format || FormatTemplate.getDefaults();

		// Get template variables
		const variables = FormatTemplate.getVariables(messageData);

		// Choose title template based on whether it's a channel message
		const isChannelMessage = messageData.channel && messageData.channel.startsWith('#');
		let titleTemplate = format.title;
		if (isChannelMessage && format.titleWithChannel) {
			titleTemplate = format.titleWithChannel;
		}

		// Choose message template based on message type
		let messageTemplate = format.message;
		if (messageData.type === "action" && format.actionMessage) {
			messageTemplate = format.actionMessage;
		}

		// Process templates
		const title = FormatTemplate.process(titleTemplate, variables);
		const message = FormatTemplate.process(messageTemplate, variables);

		return {
			title: title,
			message: message,
			timestamp: messageData.timestamp
		};
	}

	/**
	 * Get deduplication key for a message
	 */
	getDeduplicationKey(messageData) {
		// Create a unique key based on network, channel, nick, and message
		// Hash the message to keep key size reasonable
		const msgHash = messageData.message.substring(0, 50);
		return `${messageData.network}-${messageData.channel}-${messageData.nick}-${msgHash}`;
	}

	/**
	 * Clean up old entries from recent notifications
	 * Keep entries for 60 seconds to prevent duplicates
	 */
	cleanupRecentNotifications() {
		// Simple approach: clear the entire set every minute
		// This means duplicates are blocked for up to 60 seconds
		this.recentNotifications.clear();
		this.logger.debug("Cleared recent notifications cache");
	}

	/**
	 * Send a test notification
	 * @param {string} serviceName - Optional: specific service to test (e.g., "pushover")
	 */
	async sendTestNotification(serviceName = null) {
		const notification = {
			title: "TheLounge External Notify",
			message: "Test notification - your notifications are working!",
			timestamp: new Date()
		};

		// If specific service requested, only test that one
		if (serviceName) {
			if (!this.notifiers[serviceName]) {
				throw new Error(`Service "${serviceName}" not found or not configured`);
			}

			this.logger.info(`Sending test notification via ${serviceName}`);
			await this.notifiers[serviceName].send(notification);
			return;
		}

		// Otherwise, send to all configured notifiers
		const promises = [];
		for (const [name, notifier] of Object.entries(this.notifiers)) {
			this.logger.info(`Sending test notification via ${name}`);
			promises.push(notifier.send(notification));
		}

		await Promise.all(promises);
	}
}

module.exports = NotificationManager;
