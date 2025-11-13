"use strict";

/**
 * Format Template Processor
 * Handles template string processing for notification formatting
 */
class FormatTemplate {
	/**
	 * Process a template string with variables
	 * @param {string} template - Template string with {{variable}} placeholders
	 * @param {Object} variables - Object with variable values
	 * @returns {string} Processed template string
	 */
	static process(template, variables) {
		if (!template || typeof template !== 'string') {
			return '';
		}

		let result = template;

		// Replace all {{variable}} placeholders
		for (const [key, value] of Object.entries(variables)) {
			const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			result = result.replace(placeholder, value || '');
		}

		return result;
	}

	/**
	 * Get available template variables from message data
	 * @param {Object} messageData - Message data from IRC
	 * @returns {Object} Variables for template processing
	 */
	static getVariables(messageData) {
		const timestamp = messageData.timestamp || new Date();

		// Format date in readable format
		const dateFormatted = timestamp.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});

		// Detect if this is a private message (channel doesn't start with #)
		const isPrivateMessage = !messageData.channel || !messageData.channel.startsWith('#');
		const channelDisplay = isPrivateMessage ? 'PM' : messageData.channel;

		return {
			// Date/time variables
			date: dateFormatted,
			timestamp: timestamp.toISOString(),
			time: timestamp.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			}),

			// User variables
			nick: messageData.nick || '',
			user: messageData.nick || '',

			// Message variables
			message: messageData.message || '',
			text: messageData.message || '',

			// Channel/network variables
			channel: channelDisplay,
			network: messageData.network || '',
			server: messageData.network || '',

			// Message type
			type: messageData.type || 'message'
		};
	}

	/**
	 * Get default format templates
	 * @returns {Object} Default templates
	 */
	static getDefaults() {
		return {
			title: '{{network}}',
			titleWithChannel: '{{network}} - {{channel}}',
			message: '<{{nick}}> {{message}}',
			actionMessage: '* {{nick}} {{message}}'
		};
	}
}

module.exports = FormatTemplate;
