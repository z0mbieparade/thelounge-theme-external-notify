"use strict";

const fs = require("fs");
const path = require("path");
const plugin = require("../index");
const { C, F, NF } = require("./format");
const sendMessage = require("./message");

/**
 * Helper: Get list of available notifier services
 * Scans lib/notifiers directory and returns array of service names from notifier instances
 */
function getAvailableNotifiers(withColors = false) {
	const notifiersDir = path.join(__dirname, "notifiers");
	try {
		const files = fs.readdirSync(notifiersDir)
			.filter(file => file.endsWith(".js") && file !== "base.js" && file !== "example.js")
			.map(file => file.replace(".js", ""));

		// Get the name from each notifier instance
		return files.map(serviceName => {
			const notifier = getNotifierMetadata(serviceName);
			return notifier ? (withColors ? notifier.getColorName() : notifier.name) : (withColors ? `${C.PINK}${serviceName}${C.RESET}` : serviceName);
		}).filter(Boolean);
	} catch (err) {
		return [];
	}
}

/**
 * Helper: Create a notifier instance in metadata mode (for accessing help/setup info)
 * @param {string} serviceName - Name of the notifier service
 * @returns {Object|null} Notifier instance or null if failed
 */
function getNotifierMetadata(serviceName) {
	try {
		// Normalize to lowercase for file system compatibility (Linux is case-sensitive)
		const fileName = serviceName.toLowerCase();
		const NotifierClass = require(`./notifiers/${fileName}`);
		// Create with empty config - notifier will be in metadata mode (_isSetup = false)
		return new NotifierClass();
	} catch (err) {
		return null;
	}
}

/**
 * Helper: Validate that setting and value arguments are present
 * Returns true if valid, sends error message and returns false otherwise
 */
function validateConfigArgs(client, network, setting, value) {
	if (!setting) {
		sendMessage(client, network, F.ERROR(`Missing setting name. Use ${F.CMD('config')} for usage.`));
		return false;
	}

	if (!value && value !== "") {
		sendMessage(client, network, F.ERROR(`Missing value. Use ${F.CMD('config')} for usage.`));
		return false;
	}

	return true;
}

/**
 * Helper: Set a boolean filter setting and save configuration
 * Handles validation, saving, and sending success/error messages
 */
function setBooleanFilterSetting(client, network, state, config, settingKey, displayName, value) {
	const boolValue = value.toLowerCase();
	if (boolValue !== "true" && boolValue !== "false") {
		sendMessage(client, network, F.ERROR('Value must be true or false'));
		return;
	}

	config.filters[settingKey] = boolValue === "true";
	if (state.configManager.save(config)) {
		const statusText = config.filters[settingKey] ? `${C.SUCCESS}enabled${C.RESET}` : `${C.DISABLED}disabled${C.RESET}`;
		sendMessage(client, network, F.SUCCESS(`${displayName}: ${statusText}`));
	} else {
		sendMessage(client, network, F.ERROR('Failed to save configuration'));
	}
}

/**
 * Main /notify command handler
 * Provides subcommands for configuration and management
 */
const notifyCommand = {
	input: function(client, target, command, args) {
		const network = target.network;
		const realClient = client.client;

		if (!network) {
			sendMessage(realClient, network, F.ERROR('This command can only be used in a network context'));
			return;
		}

		const subcommand = args[0] ? args[0].toLowerCase() : "status";

		switch (subcommand) {
			case "enable":
				return handleEnable(realClient, network, args.slice(1));

			case "disable":
				return handleDisable(realClient, network, args.slice(1));

			case "status":
				return handleStatus(realClient, network);

			case "setup":
				return handleSetup(realClient, network, args.slice(1));

			case "config":
				return handleConfig(realClient, network, args.slice(1));

			case "test":
				return handleTest(realClient, network, args.slice(1));

			case "help":
				return handleHelp(realClient, network);

			default:
				sendMessage(realClient, network, F.ERROR(`Unknown subcommand: ${C.PINK}${subcommand}${C.RESET}. Use ${F.CMD('help')} for usage.`));
		}
	},
	allowDisconnected: false
};

/**
 * Enable notifications (globally or for a specific service)
 * Usage: /notify enable [service]
 */
function handleEnable(client, network, args) {
	const serviceName = args[0] ? args[0].toLowerCase() : null;

	// If no service specified, enable globally
	if (!serviceName) {
		const result = plugin.enableNotifications(client, network);
		let message;
		if (result.success) {
			message = F.SUCCESS(result.message);
		} else {
			message = F.ERROR(result.message);
		}
		sendMessage(client, network, [
			F.BREAK,
			message
		]);
		return;
	}

	// Enable specific service
	const state = plugin.getPluginState(client, network);
	const config = state.configManager.load();

	if (!config.services || !config.services[serviceName]) {
		sendMessage(client, network, F.ERROR(`Service ${C.ORANGE}${serviceName}${C.RESET} is not configured`));
		return;
	}

	// Validate service configuration before enabling
	const notifier = getNotifierMetadata(serviceName);
	if (!notifier) {
		sendMessage(client, network, F.ERROR(`Unknown service: ${C.ORANGE}${serviceName}${C.RESET}`));
		return;
	}

	// Create temporary notifier instance with current config to validate
	const tempNotifier = Object.create(notifier);
	tempNotifier.config = config.services[serviceName];

	if (!tempNotifier.validate()) {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR(`Cannot enable ${C.ORANGE}${serviceName}${C.RESET}: missing required configuration`),
			F.INFO(`Use ${F.CMD(`setup ${serviceName}`)} to see setup instructions`)
		]);
		return;
	}

	// Enable the service
	config.services[serviceName].enabled = true;

	if (state.configManager.save(config)) {
		sendMessage(client, network, [
			F.BREAK,
			F.SUCCESS(`${notifier.name} service enabled`)
		]);

		// If global notifications are already enabled, reinitialize notification manager
		if (state.enabled && state.notificationManager) {
			state.notificationManager = new (require('./notification-manager'))(config, plugin.getApi().Logger);
		}
	} else {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR('Failed to save configuration')
		]);
	}
}

/**
 * Disable notifications (globally or for a specific service)
 * Usage: /notify disable [service]
 */
function handleDisable(client, network, args) {
	const serviceName = args[0] ? args[0].toLowerCase() : null;

	// If no service specified, disable globally
	if (!serviceName) {
		const result = plugin.disableNotifications(client, network);
		sendMessage(client, network, [
			F.BREAK,
			F.SUCCESS(result.message)
		]);
		return;
	}

	// Disable specific service
	const state = plugin.getPluginState(client, network);
	const config = state.configManager.load();

	if (!config.services || !config.services[serviceName]) {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR(`Service ${C.PINK}${serviceName}${C.RESET} is not configured`)
		]);
		return;
	}

	// Get notifier to display proper name
	const notifier = getNotifierMetadata(serviceName);
	const displayName = notifier ? notifier.name : serviceName;

	// Disable the service
	config.services[serviceName].enabled = false;

	if (state.configManager.save(config)) {
		sendMessage(client, network, [
			F.BREAK,
			F.SUCCESS(`${displayName} service disabled`)
		]);

		// If global notifications are enabled, reinitialize notification manager
		if (state.enabled && state.notificationManager) {
			state.notificationManager = new (require('./notification-manager'))(config, plugin.getApi().Logger);
		}
	} else {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR('Failed to save configuration')
		]);
	}
}

/**
 * Show notification status and configuration
 */
function handleStatus(client, network) {
	const status = plugin.getStatus(client, network);

	// Status line
	const statusColor = status.enabled ? C.SUCCESS : C.DISABLED;
	const statusText = status.enabled ? "ENABLED" : "DISABLED";
	sendMessage(client, network, [
		F.BREAK,
		F.LABEL('Status', `${statusColor}${statusText}${C.RESET}`)
	]);

	// Services
	const servicesMsg = [F.SUBHEADER('Services:')];
	if (status.config && status.config.services && Object.keys(status.config.services).length > 0) {
		for (const [serviceName, serviceConfig] of Object.entries(status.config.services)) {
			// Get notifier to display proper name
			const notifier = getNotifierMetadata(serviceName);
			const displayName = notifier ? notifier.getColorName() : serviceName;

			// Check if service is enabled and configured
			const isEnabled = serviceConfig.enabled || false;

			// Validate config by creating temporary notifier instance
			let isConfigured = false;
			if (notifier) {
				const tempNotifier = Object.create(notifier);
				tempNotifier.config = serviceConfig;
				isConfigured = tempNotifier.validate();
			}

			let statusIndicator;
			let statusText;
			if (isEnabled && isConfigured) {
				statusIndicator = F.CHECK;
				statusText = `${C.SUCCESS}enabled${C.RESET}`;
			} else if (isEnabled && !isConfigured) {
				statusIndicator = F.CROSS;
				statusText = `${C.WARNING}enabled but missing config${C.RESET}`;
			} else if (!isEnabled && isConfigured) {
				statusIndicator = `${C.DISABLED}○${C.RESET}`;
				statusText = `${C.DISABLED}disabled${C.RESET}`;
			} else {
				statusIndicator = F.CROSS;
				statusText = `${C.DISABLED}disabled${C.RESET}`;
			}

			servicesMsg.push(F.INDENT(1) + `${displayName}: ${statusIndicator} ${statusText}`);
		}
	} else {
		servicesMsg.push(F.INDENT(1) + `${C.DISABLED}None configured${C.RESET}`);
	}
	sendMessage(client, network, servicesMsg);

	// Filters
	if (status.config && status.config.filters) {
		const filters = status.config.filters;

		let awayText = filters.onlyWhenAway ? 'Notify only when away' : 'Notify when away or present';
		let highlightsText = filters.highlights ? 'Notify on highlights' : 'Do not notify on highlights';

		if(!status.enabled)
		{
			awayText = F.LI_ERROR(`${awayText} (notifications are disabled)`);
			highlightsText = F.LI_ERROR(`${highlightsText} (notifications are disabled)`);
		}
		else 
		{
			awayText = F.LI_SUCCESS(awayText);
			highlightsText = filters.highlights ? F.LI_SUCCESS(highlightsText) : F.LI_WARN(highlightsText);
		}

		const filterMsg = [
			F.SUBHEADER('Filters:'),
			awayText,
			highlightsText
		];

		sendMessage(client, network, filterMsg);
	}

	sendMessage(client, network, [
		F.BREAK,
		F.INFO(`Configure highlight words in ${C.BOLD}TheLounge Settings > Highlights${C.RESET}`)
	]);
}

/**
 * Setup a notification service
 */
function handleSetup(client, network, args) {
	const serviceName = args[0] ? args[0].toLowerCase() : null;
	const availableServices = getAvailableNotifiers(true);

	if (!serviceName) {
		sendMessage(client, network, [
			F.BREAK,
			F.LABEL('Usage', F.CMD('setup <service>')),
			`Available services: ${availableServices.join(", ")}`
		]);
		return;
	}

	// Get notifier metadata
	const notifier = getNotifierMetadata(serviceName);
	if (!notifier) {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR(`Unknown service: ${C.PINK}${serviceName}${C.RESET}`),
			`Available services: ${availableServices.join(", ")}`
		]);
		return;
	}

	// Get setup instructions from notifier
	sendMessage(client, network, notifier.setupInstructions);
}

/**
 * Configure notification settings interactively
 */
function handleConfig(client, network, args) {
	const state = plugin.getPluginState(client, network);
	const config = state.configManager.load();

	if (args.length === 0) {
		const messages = [
			F.BREAK,
			F.LABEL('Usage', F.CMD('config <category> <setting> <value>')),
			F.BREAK,
			F.SUBHEADER('Filter:', 'Configure notification filters'),
			F.INDENT(1) + F.CMD('config filter onlyWhenAway <true|false>', 'Enable/Disable notifications only when away'),
			F.INDENT(1) + F.CMD('config filter highlights <true|false>', 'Enable/Disable notifications on highlights'),
			F.BREAK_LIGHT,
			F.SUBHEADER('Format:', 'Customize notification templates'),
			F.INDENT(1) + F.CMD('config format title "{{network}} - {{channel}}"', 'Set title format'),
			F.INDENT(1) + F.CMD('config format message "<{{nick}}> {{message}}"', 'Set message format'),
			F.INDENT(1) + F.CMD('config format actionMessage "* {{nick}} {{message}}"', 'Set action message format'),
			F.INDENT(1) + F.CMD('config format reset', 'Reset to defaults'),
			F.INFO('Available variables: {{network}}, {{channel}}, {{nick}}, {{message}}, {{date}}, {{time}}, {{type}}'),
			F.BREAK_LIGHT,
			F.SUBHEADER('Channel:', 'Manage virtual notification channel'),
			F.INDENT(1) + F.CMD('config channel external-notify', 'Set notification channel name')
		];

		// Show available notifier services
		const availableServices = getAvailableNotifiers();
		const availableServicesColored = getAvailableNotifiers(true);
		// Load config examples from notifiers
		for(let i = 0; i < availableServices.length; i++) {
			const serviceName = availableServices[i];
			const displayName = availableServicesColored[i];
			const notifier = getNotifierMetadata(serviceName);
			if (notifier && notifier.configExamples.length > 0) {
				messages.push(
					F.BREAK_LIGHT,
					F.SUBHEADER(displayName + ':'),
					...F.INDENT(1, notifier.configExamples)
				);
			}
		}

		sendMessage(client, network, messages);
		return;
	}

	const category = args[0].toLowerCase();
	const setting = args[1] ? args[1].toLowerCase() : null;
	const value = args.slice(2).join(" ");

	// Try to load a notifier for this category
	const notifier = getNotifierMetadata(category);

	// If it's a notifier service
	if (notifier) {
		if (!validateConfigArgs(client, network, setting, value)) {
			return;
		}

		const result = notifier.handleConfig(config, setting, value);
		sendMessage(client, network, result.messages);

		if (result.success) {
			if (!state.configManager.save(config)) {
				sendMessage(client, network, F.ERROR('Failed to save configuration'));
			}
		}
		return;
	}

	// Handle built-in categories
	switch (category) {
		case "filter":
			if (!validateConfigArgs(client, network, setting, value)) {
				return;
			}
			return handleConfigFilter(client, network, state, config, setting, value);

		case "format":
			if (!validateConfigArgs(client, network, setting, value)) {
				return;
			}
			return handleConfigFormat(client, network, state, config, setting, value);

		case "channel":
			// Setting is actually the value for channel name
			const channelName = setting;
			config.channelName = channelName;
			if (state.configManager.save(config)) {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Channel configured to: ${C.CYAN}${channelName}${C.RESET}`),
					F.INFO(`Restart TheLounge or reconnect for changes to take effect`)
				]);
			} else {
				sendMessage(client, network, [
					F.BREAK,
					F.ERROR('Failed to save configuration')
				]);
			}
			return;

		default:
			sendMessage(client, network, [
				F.BREAK,
				F.ERROR(`Unknown category: ${C.ORANGE}${category}${C.RESET}. Use ${F.CMD('config')} for usage.`)
			]);
	}
}

/**
 * Configure filter settings
 */
function handleConfigFilter(client, network, state, config, setting, value) {
	if (!config.filters) {
		config.filters = {
			onlyWhenAway: true,
			highlights: true
		};
	}

	switch (setting) {
		case "onlywhenaway":
			setBooleanFilterSetting(client, network, state, config, "onlyWhenAway", "Only notify when away", value);
			break;

		case "highlights":
			setBooleanFilterSetting(client, network, state, config, "highlights", "Notify on highlights", value);
			break;

		default:
			sendMessage(client, network, [
				F.BREAK,
				F.ERROR(`Unknown filter setting: ${C.ORANGE}${setting}${C.RESET}`),
				F.INDENT(1) + `Valid settings: ${C.CYAN}onlyWhenAway, highlights${C.RESET}`
			]);
	}
}

/**
 * Configure format templates
 */
function handleConfigFormat(client, network, state, config, setting, value) {
	const FormatTemplate = require('./format-template');

	if (!config.format) {
		config.format = FormatTemplate.getDefaults();
	}

	// Handle reset command
	if (setting === "reset") {
		config.format = FormatTemplate.getDefaults();
		if (state.configManager.save(config)) {
			sendMessage(client, network, [
				F.BREAK,
				F.SUCCESS('Format templates reset to defaults'),
				F.INDENT(1) + `Title: ${C.CYAN}${config.format.title}${C.RESET}`,
				F.INDENT(1) + `Message: ${C.CYAN}${config.format.message}${C.RESET}`,
				F.INDENT(1) + `Action: ${C.CYAN}${config.format.actionMessage}${C.RESET}`
			]);
		} else {
			sendMessage(client, network, F.ERROR('Failed to save configuration'));
		}
		return;
	}

	// Handle setting specific templates
	switch (setting) {
		case "title":
			config.format.title = value;
			if (state.configManager.save(config)) {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Title format updated to: ${C.CYAN}${value}${C.RESET}`)
				]);
			} else {
				sendMessage(client, network, F.ERROR('Failed to save configuration'));
			}
			break;

		case "message":
			config.format.message = value;
			if (state.configManager.save(config)) {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Message format updated to: ${C.CYAN}${value}${C.RESET}`)
				]);
			} else {
				sendMessage(client, network, F.ERROR('Failed to save configuration'));
			}
			break;

		case "actionmessage":
			config.format.actionMessage = value;
			if (state.configManager.save(config)) {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Action message format updated to: ${C.CYAN}${value}${C.RESET}`)
				]);
			} else {
				sendMessage(client, network, F.ERROR('Failed to save configuration'));
			}
			break;

		default:
			sendMessage(client, network, [
				F.BREAK,
				F.ERROR(`Unknown format setting: ${C.ORANGE}${setting}${C.RESET}`),
				F.INDENT(1) + `Valid settings: ${C.CYAN}title, message, actionMessage, reset${C.RESET}`
			]);
	}
}

/**
 * Send a test notification
 */
function handleTest(client, network, args) {
	const state = plugin.getPluginState(client, network);

	if (!state.enabled) {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR(`Notifications are not enabled. Use ${F.CMD('enable')} first.`)
		]);
		return;
	}

	if (!state.notificationManager) {
		sendMessage(client, network, [
			F.BREAK,
			F.ERROR('Notification manager not initialized.')
		]);
		return;
	}

	// Get optional service name parameter
	const serviceName = args[0] ? args[0].toLowerCase() : null;

	// Send test notification
	state.notificationManager.sendTestNotification(serviceName)
		.then(() => {
			if (serviceName) {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Test notification sent via ${C.ORANGE}${serviceName}${C.RESET}!`)
				]);
			} else {
				sendMessage(client, network, [
					F.BREAK,
					F.SUCCESS(`Test notification sent to all configured services!`)
				]);
			}
		})
		.catch(err => {
			sendMessage(client, network, [
				F.BREAK,
				F.ERROR(`Failed to send test notification: ${err.message}`)
			]);
		});
}

/**
 * Show help message
 * Dynamically builds help including notifier-specific quick start info
 */
function handleHelp(client, network) {
	const messages = [
		F.BREAK,
		F.SUBHEADER("Quick start:")
	];

	// Get quick start from first available notifier
	const availableServices = getAvailableNotifiers();
	if (availableServices.length > 0) {
		const firstService = availableServices[0];
		const notifier = getNotifierMetadata(firstService);

		if (notifier && notifier.quickStart.length > 0) {
			messages.push(...notifier.quickStart);
		} else {
			// Fallback if notifier can't be loaded or has no quick start
			messages.push(
				F.LI(1, F.CMD('setup <service>', 'Follow setup instructions')),
				F.LI(2, F.CMD('config <service> <setting> <value>', 'Configure the service')),
				F.LI(3, F.CMD('enable [service]', 'Enable notifications'))
			);
		}
	} else {
		messages.push(
			F.LI(1, 'No notification services available'),
			F.LI(2, 'Check that notifier files exist in lib/notifiers/')
		);
	}

	messages.push(
		F.BREAK,
		F.SUBHEADER("Highlight configuration:"),
		`  Configure highlight words in ${C.BOLD}TheLounge Settings > Highlights${C.RESET}`,
		`  The plugin will use your TheLounge highlight settings`,
		F.BREAK,
		F.SUBHEADER("Available commands:"),
		F.INDENT(1, F.CMD('status', 'Show current configuration')),
		F.INDENT(1, F.CMD('setup <service>', 'Show setup instructions for a service')),
		F.INDENT(1, F.CMD('enable [service]', 'Enable notifications globally or for a specific service')),
		F.INDENT(1, F.CMD('disable [service]', 'Disable notifications globally or for a specific service')),
		F.INDENT(1, F.CMD('config', 'Configure settings interactively')),
		F.INDENT(1, F.CMD('test [service]', 'Send test notification')),
		F.INDENT(1, F.CMD('help', 'Show this help message'))
	);

	// Add available services list
	if (availableServices.length > 0) {
		const availableServicesColored = getAvailableNotifiers(true);
		messages.push(
			F.BREAK,
			F.SUBHEADER("Available services:"),
			F.INDENT(1, availableServicesColored.join(", "))
		);
	}

	sendMessage(client, network, messages);
}

module.exports = {
	notifyCommand,
	handleHelp
};
