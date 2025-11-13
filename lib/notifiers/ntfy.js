"use strict";

const BaseNotifier = require("./base");
const https = require("https");
const http = require("http");
const { C, F } = require("../format");

/**
 * ntfy.sh Notifier
 * Sends notifications via ntfy.sh or self-hosted ntfy servers
 */
class NtfyNotifier extends BaseNotifier {
	constructor(config, logger) {
		super(config, logger);

		this.name = "ntfy";
		this.url = "https://ntfy.sh/";
		this.registerUrl = "https://ntfy.sh/";
		this.color = `\x0357`; // teal
		this.registerVariables = {
			server: {
				default: "https://ntfy.sh",
				example: "https://ntfy.sh",
				description: "ntfy server URL",
				required: false,
				validationError: "Server must be a valid URL",
				validate: (value) => {
					if (typeof value !== 'string') return false;
					try {
						new URL(value);
						return true;
					} catch {
						return false;
					}
				}
			},
			topic: {
				default: "",
				example: "thelounge-notifications",
				description: "ntfy topic name",
				required: true,
				validationError: "Topic must be a non-empty string",
				validate: (value) => typeof value === 'string' && value.length > 0
			},
			priority: {
				default: 3,
				example: 3,
				description: "Notification priority (1=min, 3=default, 5=max)",
				required: false,
				validationError: "Priority must be an integer between 1 and 5",
				validate: (value) => Number.isInteger(value) && value >= 1 && value <= 5
			},
			tags: {
				default: "",
				example: "irc,thelounge",
				description: "Comma-separated tags",
				required: false,
				validationError: "Tags must be a string",
				validate: (value) => typeof value === 'string'
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
	 * Send notification via ntfy
	 */
	async send(notification) {
		if (!this._isSetup) {
			throw new Error(`${this.name} notifier is not properly configured`);
		}

		return new Promise((resolve, reject) => {
			const serverUrl = new URL(this.config.server);
			const postUrl = new URL(`${serverUrl.origin}/${this.config.topic}`);

			const payload = {
				message: notification.message,
				title: notification.title,
				priority: this.config.priority
			};

			// Add tags if configured
			if (this.config.tags && this.config.tags.length > 0) {
				payload.tags = Array.isArray(this.config.tags)
					? this.config.tags
					: this.config.tags.split(',').map(t => t.trim());
			}

			const postData = JSON.stringify(payload);

			const options = {
				hostname: postUrl.hostname,
				port: postUrl.port || (postUrl.protocol === 'https:' ? 443 : 80),
				path: postUrl.pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData)
				}
			};

			const httpLib = postUrl.protocol === 'https:' ? https : http;
			const req = httpLib.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode >= 200 && res.statusCode < 300) {
						this.logger.debug(`${this.name} notification sent: ${data}`);
						resolve(data);
					} else {
						const err = new Error(`ntfy API error: ${res.statusCode} ${data}`);
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
	 * Get setup instructions for ntfy
	 * @returns {string[]} Array of setup instruction messages
	 */
	get setupInstructions() {
		return [
			F.HEADER(`${this.name} Setup Instructions`),
			F.LI(1, `Choose a unique topic name (e.g., ${C.CYAN}thelounge-yourname${C.RESET})`),
			F.LI(2, `Optional: Set up your own ntfy server at ${C.CYAN}https://docs.ntfy.sh/install/${C.RESET}`),
			F.LI(3, `Configure using commands:`),
			F.INDENT(3) + F.CMD('config ntfy topic YOUR_TOPIC_NAME'),
			F.INDENT(3) + F.CMD('config ntfy server https://ntfy.sh', 'optional, default'),
			F.INDENT(3) + F.CMD('config ntfy priority 3', 'optional, 1-5'),
			F.INDENT(3) + F.CMD('config ntfy tags irc,thelounge', 'optional'),
			F.LI(4, `Enable notifications: ${F.CMD('enable')}`),
			F.LI(5, `Install the ntfy app on your device:`),
			F.INDENT(3) + `Android: ${C.CYAN}https://play.google.com/store/apps/details?id=io.heckel.ntfy${C.RESET}`,
			F.INDENT(3) + `iOS: ${C.CYAN}https://apps.apple.com/us/app/ntfy/id1625396347${C.RESET}`,
			F.INDENT(3) + `Web: ${C.CYAN}https://ntfy.sh/app${C.RESET}`,
			F.LI(6, `Subscribe to your topic in the ntfy app`),
			F.LI(7, `Test it: ${F.CMD('test')}`),
			F.BREAK,
			F.INFO(`${C.BOLD}Note:${C.RESET} Topics on the public ntfy.sh server are not password-protected by default.`),
			F.INFO(`Anyone who knows your topic name can send notifications to it or subscribe.`),
			F.INFO(`For private notifications, consider self-hosting or using ntfy.sh's paid tier.`)
		];
	}
}

module.exports = NtfyNotifier;
