"use strict";

const BaseNotifier = require("./base");
const https = require("https");
const { C, F } = require("../format");

/**
 * Prowl Notifier
 * Sends notifications via Prowl API (iOS push notifications compatible with Growl)
 */
class ProwlNotifier extends BaseNotifier {
	constructor(config, logger) {
		super(config, logger);

		this.name = "Prowl";
		this.url = "https://www.prowlapp.com/";
		this.registerUrl = "https://www.prowlapp.com/api_settings.php";
		this.color = `\x0344`; // green
		this.registerVariables = {
			apiKey: {
				default: "",
				example: "YOUR_40_CHARACTER_API_KEY",
				description: "Your Prowl API key (40 characters)",
				required: true,
				validationError: "API key must be 40 characters",
				validate: (value) => typeof value === 'string' && value.length === 40
			},
			priority: {
				default: 0,
				example: 0,
				description: "Notification priority (-2 to 2)",
				required: false,
				validationError: "Priority must be an integer between -2 and 2",
				validate: (value) => Number.isInteger(value) && value >= -2 && value <= 2
			},
			application: {
				default: "TheLounge",
				example: "TheLounge",
				description: "Application name shown in notification",
				required: false,
				validationError: "Application name must be a non-empty string (max 256 chars)",
				validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 256
			}
		};

		// Apply defaults for optional fields that are not set
		for (const [key, variable] of Object.entries(this.registerVariables)) {
			if (!variable.required && this.config[key] === undefined) {
				this.config[key] = variable.default;
			}
		}

		// Only validate and initialize if we have real config and service is enabled
		if (this.config.enabled && this.validateWithLogging()) {
			this._isSetup = true;
		}
		// If validation fails or disabled, _isSetup remains false (metadata mode)
	}

	/**
	 * Send notification via Prowl
	 */
	async send(notification) {
		if (!this._isSetup) {
			throw new Error(`${this.name} notifier is not properly configured`);
		}

		return new Promise((resolve, reject) => {
			// Prepare POST data
			const params = new URLSearchParams({
				apikey: this.config.apiKey,
				application: this.config.application,
				event: notification.title,
				description: notification.message,
				priority: this.config.priority.toString()
			});

			const postData = params.toString();

			const options = {
				hostname: 'api.prowlapp.com',
				port: 443,
				path: '/publicapi/add',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': Buffer.byteLength(postData)
				}
			};

			const req = https.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode === 200) {
						this.logger.debug(`${this.name} notification sent successfully`);
						resolve(data);
					} else {
						const err = new Error(`Prowl API error: ${res.statusCode} ${data}`);
						this.logger.error(`${this.name} error: ${err.message}`);
						reject(err);
					}
				});
			});

			req.on('error', (err) => {
				this.logger.error(`${this.name} error: ${err.message}`);
				reject(err);
			});

			req.write(postData);
			req.end();
		});
	}

	/**
	 * Get setup instructions for Prowl
	 * @returns {string[]} Array of setup instruction messages
	 */
	get setupInstructions() {
		return [
			F.HEADER(`${this.name} Setup Instructions`),
			F.LI(1, `Download Prowl from the App Store: ${C.CYAN}https://apps.apple.com/app/prowl-easy-push-notifications/id320876271${C.RESET}`),
			F.LI(2, `Create an account or sign in to the Prowl app`),
			F.LI(3, `Get your API key from ${C.CYAN}https://www.prowlapp.com/api_settings.php${C.RESET}`),
			F.LI(4, `Configure using commands:`),
			F.INDENT(3) + F.CMD('config prowl apiKey YOUR_40_CHARACTER_API_KEY'),
			F.INDENT(3) + F.CMD('config prowl priority 0', 'optional, -2 to 2'),
			F.INDENT(3) + F.CMD('config prowl application TheLounge', 'optional'),
			F.LI(5, `Enable notifications: ${F.CMD('enable')}`),
			F.LI(6, `Test it: ${F.CMD('test')}`),
			F.BREAK,
			F.INFO(`${C.BOLD}Priority Levels:${C.RESET}`),
			F.INDENT(1) + `-2: Very Low`,
			F.INDENT(1) + `-1: Moderate`,
			F.INDENT(1) + `0: Normal (default)`,
			F.INDENT(1) + `1: High`,
			F.INDENT(1) + `2: Emergency`
		];
	}
}

module.exports = ProwlNotifier;
