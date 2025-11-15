"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Configuration Manager
 * Handles loading and saving user notification configurations using plugin storage
 */
class ConfigManager {
	constructor(client, storageDir) {
		this.client = client;
		this.storageDir = storageDir;
		this.configPath = path.join(storageDir, `${client.name}-config.json`);
	}

	/**
	 * Load configuration from plugin storage
	 * Returns default config if not set
	 */
	load() {
		try {
			// Check if config file exists
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf8");
				const config = JSON.parse(data);
				console.log(`[External Notify] Loaded config for user ${this.client.name} from ${this.configPath}`);
				console.log(`[External Notify] Config contents:`, JSON.stringify(config, null, 2));
				// Validate and merge with defaults
				return this.validateConfig(config);
			}
		} catch (err) {
			console.error(`[External Notify] Failed to load config from ${this.configPath}:`, err.message);
			console.error(`[External Notify] Error details:`, err);
		}

		// Return default configuration
		console.log(`[External Notify] No config found at ${this.configPath} for user ${this.client.name}, using defaults`);
		return this.getDefaultConfig();
	}

	/**
	 * Save configuration to plugin storage
	 */
	save(config) {
		try {
			const validated = this.validateConfig(config);

			// Ensure storage directory exists
			if (!fs.existsSync(this.storageDir)) {
				console.log(`[External Notify] Creating storage directory: ${this.storageDir}`);
				fs.mkdirSync(this.storageDir, { recursive: true });
			}

			// Check directory permissions before writing
			try {
				fs.accessSync(this.storageDir, fs.constants.W_OK);
			} catch (permErr) {
				console.error(`[External Notify] Storage directory is not writable: ${this.storageDir}`);
				console.error(`[External Notify] Permission error:`, permErr.message);
				console.error(`[External Notify] If running in Docker, check volume mount permissions`);
				return false;
			}

			// Write config to file
			fs.writeFileSync(this.configPath, JSON.stringify(validated, null, 2), "utf8");
			console.log(`[External Notify] Saved config for user ${this.client.name} to ${this.configPath}`);
			console.log(`[External Notify] Config contents:`, JSON.stringify(validated, null, 2));

			return true;
		} catch (err) {
			console.error(`[External Notify] Failed to save config to ${this.configPath}:`, err.message);
			console.error(`[External Notify] Error details:`, err);
			console.error(`[External Notify] Storage directory: ${this.storageDir}`);
			console.error(`[External Notify] If running in Docker, ensure the storage directory is writable`);
			return false;
		}
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig() {
		const FormatTemplate = require('./format-template');
		return {
			enabled: false,
			channelName: "external-notify",
			services: {},
			filters: {
				onlyWhenAway: true,
				highlights: true
			},
			format: FormatTemplate.getDefaults()
		};
	}

	/**
	 * Validate configuration and merge with defaults
	 */
	validateConfig(config) {
		const defaults = this.getDefaultConfig();

		// Ensure all required top-level keys exist
		const validated = {
			enabled: typeof config.enabled === "boolean" ? config.enabled : defaults.enabled,
			channelName: typeof config.channelName === "string" ? config.channelName : defaults.channelName,
			services: config.services || defaults.services,
			filters: config.filters || defaults.filters,
			format: config.format || defaults.format
		};

		// Validate filters object
		if (validated.filters) {
			const filters = config.filters || {};

			validated.filters = {
				onlyWhenAway: typeof filters.onlyWhenAway === "boolean"
					? filters.onlyWhenAway
					: defaults.filters.onlyWhenAway,
				highlights: typeof filters.highlights === "boolean"
					? filters.highlights
					: defaults.filters.highlights
			};
		}

		// Validate format object
		if (validated.format) {
			const format = config.format || {};

			validated.format = {
				title: typeof format.title === "string"
					? format.title
					: defaults.format.title,
				titleWithChannel: typeof format.titleWithChannel === "string"
					? format.titleWithChannel
					: defaults.format.titleWithChannel,
				message: typeof format.message === "string"
					? format.message
					: defaults.format.message,
				actionMessage: typeof format.actionMessage === "string"
					? format.actionMessage
					: defaults.format.actionMessage
			};
		}

		// Validate services - ensure it's an object
		if (validated.services && typeof validated.services !== 'object') {
			validated.services = {};
		}

		return validated;
	}

	/**
	 * Check if configuration is valid and complete
	 */
	isValid() {
		const config = this.load();

		// Must have at least one service configured
		if (!config.services || Object.keys(config.services).length === 0) {
			return false;
		}

		// Check if at least one service has valid configuration by trying to load and validate
		for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
			if (!serviceConfig || typeof serviceConfig !== 'object') {
				continue;
			}

			try {
				// Try to load the notifier class
				// Normalize to lowercase for file system compatibility (Linux is case-sensitive)
				const fileName = serviceName.toLowerCase();
				const NotifierClass = require(`./notifiers/${fileName}`);

				// Create a temporary instance (in metadata mode, won't actually initialize)
				const tempNotifier = new NotifierClass(serviceConfig, this.logger);

				// Check if it validates (has all required fields)
				if (tempNotifier.validate()) {
					return true;
				}
			} catch (err) {
				// If notifier doesn't exist or fails to load, skip it
				continue;
			}
		}

		return false;
	}
}

module.exports = ConfigManager;
