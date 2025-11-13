"use strict";

const { expect } = require("chai");
const WebhookNotifier = require("../lib/notifiers/webhook");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

describe("WebhookNotifier", function() {
	describe("constructor", function() {
		it("should create notifier with valid config", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook",
				method: "POST",
				contentType: "application/json",
				headers: "{}",
				bodyTemplate: '{"title": "{{title}}", "message": "{{message}}"}'
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier).to.be.an.instanceof(WebhookNotifier);
			expect(notifier.config.url).to.equal("https://example.com/webhook");
			expect(notifier.config.method).to.equal("POST");
			expect(notifier.config.contentType).to.equal("application/json");
			expect(notifier.isMetadataMode).to.equal(false);
		});

		it("should not initialize with invalid config", function() {
			const config = {
				enabled: true,
				url: "" // Missing required URL
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			// Should remain in metadata mode (not set up)
			expect(notifier.isMetadataMode).to.equal(true);
		});

		it("should use default method and contentType", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.config.method).to.equal("POST");
			expect(notifier.config.contentType).to.equal("application/json");
			expect(notifier.config.headers).to.equal("{}");
		});

		it("should validate webhook URL", function() {
			const config = {
				enabled: true,
				url: "not-a-url"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			// Should remain in metadata mode due to invalid URL
			expect(notifier.isMetadataMode).to.equal(true);
		});

		it("should accept both http and https URLs", function() {
			const httpsConfig = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const httpConfig = {
				enabled: true,
				url: "http://localhost:8080/webhook"
			};

			const httpsNotifier = new WebhookNotifier(httpsConfig, mockLogger);
			const httpNotifier = new WebhookNotifier(httpConfig, mockLogger);

			expect(httpsNotifier.isMetadataMode).to.equal(false);
			expect(httpNotifier.isMetadataMode).to.equal(false);
		});
	});

	describe("validate()", function() {
		it("should return true for valid config", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook",
				method: "POST",
				contentType: "application/json"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(true);
		});

		it("should return false for missing URL", function() {
			const config = {
				enabled: true,
				url: "",
				method: "POST"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should return false for invalid method", function() {
			const config = {
				enabled: false,
				url: "https://example.com/webhook",
				method: "DELETE" // Not supported
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should validate JSON headers", function() {
			const validConfig = {
				enabled: false,
				url: "https://example.com/webhook",
				headers: '{"Authorization": "Bearer token"}'
			};

			const invalidConfig = {
				enabled: false,
				url: "https://example.com/webhook",
				headers: 'not valid json'
			};

			const validNotifier = new WebhookNotifier(validConfig, mockLogger);
			const invalidNotifier = new WebhookNotifier(invalidConfig, mockLogger);

			expect(validNotifier.validate()).to.equal(true);
			expect(invalidNotifier.validate()).to.equal(false);
		});

		it("should validate bodyTemplate JSON structure", function() {
			const validConfig = {
				enabled: false,
				url: "https://example.com/webhook",
				bodyTemplate: '{"text": "{{message}}"}'
			};

			const invalidConfig = {
				enabled: false,
				url: "https://example.com/webhook",
				bodyTemplate: 'not valid json'
			};

			const validNotifier = new WebhookNotifier(validConfig, mockLogger);
			const invalidNotifier = new WebhookNotifier(invalidConfig, mockLogger);

			expect(validNotifier.validate()).to.equal(true);
			expect(invalidNotifier.validate()).to.equal(false);
		});
	});

	describe("name", function() {
		it("should return webhook", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.name).to.equal("webhook");
		});
	});

	describe("processTemplate()", function() {
		it("should replace template placeholders", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			const template = '{"title": "{{title}}", "message": "{{message}}"}';
			const values = {
				title: "Test Title",
				message: "Test Message"
			};

			const result = notifier.processTemplate(template, values);
			const parsed = JSON.parse(result);

			expect(parsed.title).to.equal("Test Title");
			expect(parsed.message).to.equal("Test Message");
		});

		it("should handle timestamp placeholder", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			const template = '{"ts": "{{timestamp}}"}';
			const values = {
				timestamp: "2025-01-01T00:00:00.000Z"
			};

			const result = notifier.processTemplate(template, values);
			const parsed = JSON.parse(result);

			expect(parsed.ts).to.equal("2025-01-01T00:00:00.000Z");
		});

		it("should handle multiple occurrences of same placeholder", function() {
			const config = {
				enabled: true,
				url: "https://example.com/webhook"
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			const template = '{"a": "{{value}}", "b": "{{value}}"}';
			const values = {
				value: "test"
			};

			const result = notifier.processTemplate(template, values);
			const parsed = JSON.parse(result);

			expect(parsed.a).to.equal("test");
			expect(parsed.b).to.equal("test");
		});
	});

	describe("send()", function() {
		it("should throw error if not setup", function() {
			const config = {
				enabled: false,
				url: ""
			};

			const notifier = new WebhookNotifier(config, mockLogger);

			return notifier.send({
				title: "Test",
				message: "Test",
				timestamp: new Date()
			}).then(() => {
				throw new Error("Should have thrown");
			}).catch((err) => {
				expect(err.message).to.match(/not properly configured|Invalid URL/);
			});
		});
	});

	describe("registerVariables", function() {
		it("should define all required fields", function() {
			const config = {};
			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.registerVariables).to.have.property("url");
			expect(notifier.registerVariables).to.have.property("method");
			expect(notifier.registerVariables).to.have.property("contentType");
			expect(notifier.registerVariables).to.have.property("headers");
			expect(notifier.registerVariables).to.have.property("bodyTemplate");

			expect(notifier.registerVariables.url.required).to.equal(true);
			expect(notifier.registerVariables.method.required).to.equal(false);
			expect(notifier.registerVariables.contentType.required).to.equal(false);
			expect(notifier.registerVariables.headers.required).to.equal(false);
			expect(notifier.registerVariables.bodyTemplate.required).to.equal(false);
		});

		it("should have correct defaults", function() {
			const config = {};
			const notifier = new WebhookNotifier(config, mockLogger);

			expect(notifier.registerVariables.method.default).to.equal("POST");
			expect(notifier.registerVariables.contentType.default).to.equal("application/json");
			expect(notifier.registerVariables.headers.default).to.equal("{}");
			expect(notifier.registerVariables.bodyTemplate.default).to.be.a('string');
		});
	});
});
