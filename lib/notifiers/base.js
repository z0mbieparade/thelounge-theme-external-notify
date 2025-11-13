"use strict";

const { C, F } = require("../format");

/**
 * Base Notifier Class
 * Abstract interface for notification services
 */
class BaseNotifier {
	constructor(config, logger) {
		this.config = config || {};
		this.logger = logger || { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };

		this._isSetup = false;
		this._name = "BaseNotifier";
		this._color = C.PINK;
		this._url = "https://api.example.com";
		this._registerUrl = "https://api.example.com/register";
		this._registerVariables = {
			userKey: {
				default: "",
				example: "YOUR_USER_KEY",
				description: "Your user key for the service",
				required: true,
				validationError: "User key must be a non-empty string",
				validate: (value) => typeof value === 'string' && value.length > 0
			},
			apiToken: {
				default: "",
				example: "YOUR_API_TOKEN",
				description: "Your API token for the service",
				required: true,
				validationError: "API token must be a non-empty string",
				validate: (value) => typeof value === 'string' && value.length > 0
			}
		};
		this._defaultServiceConfig = {};
		this._quickStart = [];
		this._setupInstructions = [];
		this._configExamples = [];
	}

	/**
	 * Check if notifier is in metadata mode (not fully configured)
	 * @returns {boolean}
	 */
	get isMetadataMode() {
		return !this._isSetup;
	}

	/**
	 * Send a notification
	 * @param {Object} notification - Notification data
	 * @param {string} notification.title - Notification title
	 * @param {string} notification.message - Notification message body
	 * @param {Date} notification.timestamp - Message timestamp
	 * @returns {Promise<void>}
	 */
	async send(notification) {
		if (!this._isSetup) {
			throw new Error(`${this.name} notifier is not properly configured`);
		}
		throw new Error("send() must be implemented by subclass");
	}

	/**
	 * Send a test notification
	 * @returns {Promise<void>}
	 */
	async test() {
		return this.send({
			title: "Test Notification",
			message: "This is a test notification from TheLounge External Notify",
			timestamp: new Date()
		});
	}

	/**
	 * Validate configuration (silent, for checking if config is complete)
	 * @returns {boolean}
	 */
	validate() {
		for (const [key, variable] of Object.entries(this.registerVariables)) {
			const value = this.config[key];
			if (variable.required && (value === undefined || value === null || value === '')) {
				return false;
			}
			if (variable.validate && !variable.validate(value)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Validate configuration with error logging
	 * @returns {boolean}
	 */
	validateWithLogging() {
		for (const [key, variable] of Object.entries(this.registerVariables)) {
			const value = this.config[key];
			const validationError = variable.validationError || `Configuration error: ${key} is required for ${this.name}`;
			if (variable.required && (value === undefined || value === null || value === '')) {
				this.logger.error(validationError);
				return false;
			}
			if (variable.validate && !variable.validate(value)) {
				this.logger.error(validationError);
				return false;
			}
		}
		return true;
	}

	/**
	 * Get service name
	 * @returns {string}
	 */
	get name() {
		return this._name;
	}

	/**
	 * Set service name
	 * @param {string} value
	 */
	set name(value) {
		this._name = value;
	}

	/**
	 * Get service color
	 * @returns {string}
	 */
	get color() {
		return this._color;
	}

	/**
	 * Set service color
	 * @param {string} value
	 */
	set color(value) {
		this._color = value;
	}

	/**
	 * Get colored service name for console output
	 * @returns {string}
	 */
	getColorName() {
		return `${this._color}${this.name}${C.RESET}`;
	}

	/**
	 * Get API URL
	 * @returns {string}
	 */
	get url() {
		return this._url;
	}

	/**
	 * Set API URL
	 * @param {string} value
	 */
	set url(value) {
		this._url = value;
	}

	/**
	 * Get registration URL
	 * @returns {string}
	 */
	get registerUrl() {
		return this._registerUrl;
	}

	/**
	 * Set registration URL
	 * @param {string} value
	 */
	set registerUrl(value) {
		this._registerUrl = value;
	}

	/**
	 * Get registration variables
	 * @returns {Object} Registration variables
	 */
	get registerVariables() {
		return this._registerVariables;
	}

	/**
	 * Set registration variables
	 * @param {Object} value
	 */
	set registerVariables(value) {
		for(const key in value) 
		{
			if(!value[key].hasOwnProperty('required')) {
				value[key].required = false;
			}

			if(!value[key].hasOwnProperty('example') && value[key].hasOwnProperty('default')) {
				value[key].example = value[key].default;
			}

			if(!value[key].hasOwnProperty('validationError')) {
				value[key].validationError = `Invalid value for ${key}`;
			}

			if(!value[key].hasOwnProperty('validate')) {
				value[key].validate = () => true;
			}
		}

		this._registerVariables = value;
	}

	/**
	 * Get quick start instructions for the notifier
	 * @returns {string[]} Array of quick start messages
	 */
	get quickStart() {
		if(this._quickStart.length === 0) {
			const defaultQuickStart = [];
			let i = 1;
			for(const key in this.registerVariables) {
				const variable = this.registerVariables[key];
				if(variable.required) {
					defaultQuickStart.push(F.LI(i, F.CMD(`config ${this.name.toLowerCase()} ${key} ${variable.example}`)));
					i++;
				}
			}
			defaultQuickStart.push(F.LI(i, F.CMD('enable')));
			defaultQuickStart.push(F.LI(i + 1, F.CMD(`test ${this.name.toLowerCase()}`)));
			return defaultQuickStart;
		}

		return this._quickStart;
	}

	/**
	 * Set quick start instructions for the notifier
	 * @param {string[]} value
	 */
	set quickStart(value) 
	{
		this._quickStart = value;
	}

	/**
	 * Get setup instructions for the notifier
	 * @returns {string[]} Array of setup instruction messages
	 */
	get setupInstructions() {
		return this._setupInstructions;
	}

	/**
	 * Set setup instructions for the notifier
	 * @param {string[]} value
	 */
	set setupInstructions(value) {
		this._setupInstructions = value;
	}

	/**
	 * Get configuration examples for the notifier
	 * @returns {string[]} Array of example commands
	 */
	get configExamples() {
		if(this._configExamples.length === 0) {
			const defaultExamples = [];
			for(const key in this.registerVariables) {
				const variable = this.registerVariables[key];
				let comment = variable.required ? '' : 'optional';
				if(variable.description) {
					comment += comment ? ', ' + variable.description : variable.description;
				}
				defaultExamples.push(F.CMD(`config ${this.name.toLowerCase()} ${key} ${variable.example}`, comment));
			}
			return defaultExamples;
		}

		return this._configExamples;
	}

	/**
	 * Set configuration examples for the notifier
	 * @param {string[]} value
	 */
	set configExamples(value) {
		this._configExamples = value;
	}

	/**
	 * Get default service configuration
	 * @returns {Object} Default configuration object
	 */
	get defaultServiceConfig() {
		if(Object.keys(this._defaultServiceConfig).length > 0) {
			return this._defaultServiceConfig;
		}

		const defaultConfig = {
			enabled: false // Services are disabled by default until all required fields are set
		};

		for (const [key, variable] of Object.entries(this.registerVariables)) {
			const typeOf = variable.example !== undefined ? typeof variable.example : typeof variable.default;
			let defaultValue;
			if(variable.default !== undefined) {
				defaultValue = variable.default;
			} else if(variable.example !== undefined) {
				defaultValue = variable.example;
			} else {
				switch(typeOf) {
					case 'string':
						defaultValue = '';
						break;
					case 'number':
						defaultValue = 0;
						break;
					case 'boolean':
						defaultValue = false;
						break;
					default:
						defaultValue = null;
				}
			}

			defaultConfig[key] = defaultValue;
		}
		return defaultConfig;
	}

	/**
	 * Set default service configuration
	 * @param {Object} value Default configuration object
	 */
	set defaultServiceConfig(value) {
		this._defaultServiceConfig = value;
	}

	/**
	 * Handle configuration for service settings
	 * @param {Object} config - The full config object
	 * @param {string} setting - The setting name to configure
	 * @param {string} value - The value to set
	 * @returns {Object} Result object with messages array and autoEnabled flag
	 */
	handleConfig(config, setting, value) {
		// Initialize config structure
		if (!config.services) {
			config.services = {};
		}
		if (!config.services[this.name]) {
			config.services[this.name] = this.defaultServiceConfig;
		}

		// Find the actual key in registerVariables (case-insensitive lookup)
		// Commands are lowercased, but registerVariables uses camelCase
		const actualKey = Object.keys(this.registerVariables).find(
			key => key.toLowerCase() === setting.toLowerCase()
		);

		if(!actualKey) {
			return {
				success: false,
				messages: [
					F.ERROR(`Unknown ${this.name} setting: ${C.ORANGE}${setting}${C.RESET}`),
					F.INDENT(1) + `Valid settings: ${C.CYAN}${Object.keys(this.registerVariables).join(', ')}${C.RESET}`
				]
			};
		}

		const variable = this.registerVariables[actualKey];
		let parsedValue = value;

		// Basic type parsing
		const typeOf = variable.example !== undefined ? typeof variable.example : typeof variable.default;
		if(typeOf) {
			const exampleType = typeof variable.example;
			switch(exampleType) {
				case 'number':
					parsedValue = parseFloat(value);
					if(isNaN(parsedValue)) {
						return {
							success: false,
							messages: [F.ERROR(`Invalid value for ${setting}: expected a number`)]
						};
					}
					break;
				case 'boolean':
					parsedValue = value.toLowerCase();
					if(parsedValue === 'true' || parsedValue === '1') {
						parsedValue = true;
					} else if(parsedValue === 'false' || parsedValue === '0') {
						parsedValue = false;
					} else {
						return {
							success: false,
							messages: [F.ERROR(`Invalid value for ${setting}: expected a boolean (true/false)`)]
						};
					}
					break;
				case 'string':
				default:
					parsedValue = value;
			}
		}

		// Validate value
		if(variable.validate && !variable.validate(parsedValue)) {
			return {
				success: false,
				messages: [F.ERROR(variable.validationError)]
			};
		}

		// Set the configuration value using the actual key (camelCase)
		config.services[this.name][actualKey] = parsedValue;

		const messages = [F.SUCCESS(`${this.name} setting ${C.CYAN}${actualKey}${C.RESET} updated`)];
		let autoEnabled = false;

		// Auto-enable service if all required fields are now set
		// Create a temporary notifier instance to validate the updated config
		const tempNotifier = Object.create(this);
		tempNotifier.config = config.services[this.name];

		if (!config.services[this.name].enabled && tempNotifier.validate()) {
			config.services[this.name].enabled = true;
			messages.push(F.SUCCESS(`${this.name} service auto-enabled (all required fields are set)`));
			autoEnabled = true;
		}

		return {
			success: true,
			messages: messages,
			autoEnabled: autoEnabled
		};
	}
}

module.exports = BaseNotifier;
