"use strict";

const BaseNotifier = require("./base");
const https = require("https");
const http = require("http");
const { C, F } = require("../format");

/**
 * Generic Webhook Notifier
 * Sends notifications to any webhook endpoint with customizable templates
 */
class WebhookNotifier extends BaseNotifier {
	constructor(config, logger) {
		super(config, logger);

		this.name = "webhook";
		this.url = "https://example.com/webhook";
		this.registerUrl = "https://example.com/webhook";
		this.color = `\x0373`; // purple
		this.registerVariables = {
			url: {
				default: "",
				example: "https://example.com/webhook",
				description: "Webhook URL to POST notifications to",
				required: true,
				validationError: "URL must be a valid HTTPS or HTTP URL",
				validate: (value) => {
					if (typeof value !== 'string') return false;
					try {
						const url = new URL(value);
						return url.protocol === 'https:' || url.protocol === 'http:';
					} catch {
						return false;
					}
				}
			},
			method: {
				default: "POST",
				example: "POST",
				description: "HTTP method (GET, POST, PUT, PATCH)",
				required: false,
				validationError: "Method must be GET, POST, PUT, or PATCH",
				validate: (value) => {
					if (typeof value !== 'string') return false;
					const method = value.toUpperCase();
					return ['GET', 'POST', 'PUT', 'PATCH'].includes(method);
				}
			},
			contentType: {
				default: "application/json",
				example: "application/json",
				description: "Content-Type header",
				required: false,
				validationError: "Content-Type must be a string",
				validate: (value) => typeof value === 'string' && value.length > 0
			},
			headers: {
				default: "{}",
				example: '{"Authorization": "Bearer YOUR_TOKEN"}',
				description: "Custom headers as JSON string",
				required: false,
				validationError: "Headers must be valid JSON object",
				validate: (value) => {
					if (typeof value !== 'string') return false;
					try {
						const parsed = JSON.parse(value);
						return typeof parsed === 'object' && !Array.isArray(parsed);
					} catch {
						return false;
					}
				}
			},
			bodyTemplate: {
				default: '{"title": "{{title}}", "message": "{{message}}", "timestamp": "{{timestamp}}"}',
				example: '{"title": "{{title}}", "message": "{{message}}", "timestamp": "{{timestamp}}"}',
				description: "JSON template for request body. Use {{title}}, {{message}}, {{timestamp}} as placeholders",
				required: false,
				validationError: "Body template must be valid JSON",
				validate: (value) => {
					if (typeof value !== 'string' || value.length === 0) return false;
					try {
						// Try to parse it as JSON (with placeholders replaced by test strings)
						// Replace {{placeholder}} with a test value (unquoted to avoid double quotes)
						const testValue = value.replace(/\{\{[^}]+\}\}/g, 'test');
						JSON.parse(testValue);
						return true;
					} catch {
						return false;
					}
				}
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
		} else {
			// Debug: log why setup failed
			if (!this.config.enabled) {
				this.logger.debug(`${this.name} not enabled in config`);
			} else {
				this.logger.debug(`${this.name} validation failed`);
			}
		}
		// If validation fails or disabled, _isSetup remains false (metadata mode)
	}

	/**
	 * Replace template placeholders with actual values
	 * @param {string} template - Template string with {{placeholder}} markers
	 * @param {Object} values - Object with values to replace
	 * @returns {string} Processed template
	 */
	processTemplate(template, values) {
		let result = template;
		for (const [key, value] of Object.entries(values)) {
			const placeholder = `{{${key}}}`;
			result = result.replace(new RegExp(placeholder, 'g'), value);
		}
		return result;
	}

	/**
	 * Send notification via webhook
	 */
	async send(notification) {
		if (!this._isSetup) {
			throw new Error(`${this.name} notifier is not properly configured`);
		}

		return new Promise((resolve, reject) => {
			const webhookUrl = new URL(this.config.url);

			// Process body template
			const templateValues = {
				title: notification.title,
				message: notification.message,
				timestamp: notification.timestamp.toISOString()
			};

			const body = this.processTemplate(this.config.bodyTemplate, templateValues);

			// Parse custom headers
			let customHeaders = {};
			try {
				customHeaders = JSON.parse(this.config.headers);
			} catch (err) {
				this.logger.warn(`${this.name} failed to parse custom headers: ${err.message}`);
			}

			const postData = body;
			const method = this.config.method.toUpperCase();

			const options = {
				hostname: webhookUrl.hostname,
				port: webhookUrl.port || (webhookUrl.protocol === 'https:' ? 443 : 80),
				path: webhookUrl.pathname + webhookUrl.search,
				method: method,
				headers: {
					'Content-Type': this.config.contentType,
					'User-Agent': 'TheLounge-External-Notify/1.0',
					...customHeaders
				}
			};

			// Only add Content-Length for methods that send a body
			if (['POST', 'PUT', 'PATCH'].includes(method)) {
				options.headers['Content-Length'] = Buffer.byteLength(postData);
			}

			const httpLib = webhookUrl.protocol === 'https:' ? https : http;
			const req = httpLib.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode >= 200 && res.statusCode < 300) {
						this.logger.debug(`${this.name} notification sent: ${res.statusCode}`);
						resolve(data);
					} else {
						const err = new Error(`Webhook error: ${res.statusCode} ${data}`);
						this.logger.error(`${this.name} error: ${err.message}`);
						reject(err);
					}
				});
			});

			req.on('error', (err) => {
				this.logger.error(`${this.name} error: ${err.message}`);
				reject(err);
			});

			// Write body for POST/PUT/PATCH
			if (['POST', 'PUT', 'PATCH'].includes(method)) {
				req.write(postData);
			}
			req.end();
		});
	}

	/**
	 * Get setup instructions for webhook
	 * @returns {string[]} Array of setup instruction messages
	 */
	get setupInstructions() {
		return [
			F.HEADER(`${this.name} Setup Instructions`),
			F.LI(1, `Get your webhook URL from your service (Discord, Slack, Mattermost, etc.)`),
			F.LI(2, `Configure the webhook URL:`),
			F.INDENT(3) + F.CMD('config webhook url https://example.com/webhook'),
			F.LI(3, `Optional: Customize the request method (default: POST):`),
			F.INDENT(3) + F.CMD('config webhook method POST'),
			F.LI(4, `Optional: Add custom headers (as JSON string):`),
			F.INDENT(3) + F.CMD('config webhook headers \'{"Authorization": "Bearer YOUR_TOKEN"}\''),
			F.LI(5, `Optional: Customize Content-Type (default: application/json):`),
			F.INDENT(3) + F.CMD('config webhook contentType application/json'),
			F.LI(6, `Optional: Customize body template (use {{title}}, {{message}}, {{timestamp}}):`),
			F.INDENT(3) + F.CMD('config webhook bodyTemplate \'{"text": "{{title}}: {{message}}"}\''),
			F.LI(7, `Enable notifications: ${F.CMD('enable')}`),
			F.LI(8, `Test it: ${F.CMD('test')}`),
			F.BREAK,
			F.INFO(`${C.BOLD}Common Templates:${C.RESET}`),
			F.INDENT(1) + `Discord: ${C.CYAN}{"content": "**{{title}}**\\n{{message}}"}${C.RESET}`,
			F.INDENT(1) + `Slack: ${C.CYAN}{"text": "{{title}}", "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "{{message}}"}}]}${C.RESET}`,
			F.INDENT(1) + `Mattermost: ${C.CYAN}{"text": "**{{title}}**\\n{{message}}"}${C.RESET}`,
			F.BREAK,
			F.INFO(`For services requiring authentication, use the ${C.CYAN}headers${C.RESET} option.`)
		];
	}
}

module.exports = WebhookNotifier;
