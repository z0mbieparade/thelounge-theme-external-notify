"use strict";

const { expect } = require("chai");
const NtfyNotifier = require("../lib/notifiers/ntfy");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

describe("NtfyNotifier", function() {
	describe("constructor", function() {
		it("should create notifier with valid config", function() {
			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: "test-topic",
				priority: 3,
				tags: "irc,thelounge"
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier).to.be.an.instanceof(NtfyNotifier);
			expect(notifier.config.server).to.equal("https://ntfy.sh");
			expect(notifier.config.topic).to.equal("test-topic");
			expect(notifier.config.priority).to.equal(3);
			expect(notifier.config.tags).to.equal("irc,thelounge");
			expect(notifier.isMetadataMode).to.equal(false);
		});

		it("should not initialize with invalid config", function() {
			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: "" // Missing required topic
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			// Should remain in metadata mode (not set up)
			expect(notifier.isMetadataMode).to.equal(true);
		});

		it("should use default server and priority", function() {
			const config = {
				enabled: true,
				topic: "test-topic"
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.config.server).to.equal("https://ntfy.sh");
			expect(notifier.config.priority).to.equal(3);
			expect(notifier.config.tags).to.equal("");
		});

		it("should validate server URL", function() {
			const config = {
				enabled: true,
				server: "invalid-url",
				topic: "test-topic"
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			// Should remain in metadata mode due to invalid URL
			expect(notifier.isMetadataMode).to.equal(true);
		});
	});

	describe("validate()", function() {
		it("should return true for valid config", function() {
			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: "test-topic",
				priority: 3,
				tags: "test"
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(true);
		});

		it("should return false for missing topic", function() {
			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: "",
				priority: 3
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should return false for invalid priority", function() {
			const config = {
				enabled: false,
				server: "https://ntfy.sh",
				topic: "test-topic",
				priority: 10 // Out of range (1-5)
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should warn for invalid config", function() {
			const errors = [];
			const errorLogger = {
				info: () => {},
				warn: () => {},
				error: (msg) => errors.push(msg),
				debug: () => {}
			};

			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: ""
			};

			const notifier = new NtfyNotifier(config, errorLogger);

			// validateWithLogging should log errors
			const result = notifier.validateWithLogging();

			expect(result).to.equal(false);
			expect(errors.length).to.be.greaterThan(0);
		});
	});

	describe("name", function() {
		it("should return ntfy", function() {
			const config = {
				enabled: true,
				server: "https://ntfy.sh",
				topic: "test-topic"
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.name).to.equal("ntfy");
		});
	});

	describe("send()", function() {
		it("should throw error if not setup", function() {
			const config = {
				enabled: false,
				topic: ""
			};

			const notifier = new NtfyNotifier(config, mockLogger);

			return notifier.send({
				title: "Test",
				message: "Test",
				timestamp: new Date()
			}).then(() => {
				throw new Error("Should have thrown");
			}).catch((err) => {
				expect(err.message).to.include("not properly configured");
			});
		});
	});

	describe("registerVariables", function() {
		it("should define all required fields", function() {
			const config = {};
			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.registerVariables).to.have.property("server");
			expect(notifier.registerVariables).to.have.property("topic");
			expect(notifier.registerVariables).to.have.property("priority");
			expect(notifier.registerVariables).to.have.property("tags");

			expect(notifier.registerVariables.topic.required).to.equal(true);
			expect(notifier.registerVariables.server.required).to.equal(false);
			expect(notifier.registerVariables.priority.required).to.equal(false);
			expect(notifier.registerVariables.tags.required).to.equal(false);
		});

		it("should have correct defaults", function() {
			const config = {};
			const notifier = new NtfyNotifier(config, mockLogger);

			expect(notifier.registerVariables.server.default).to.equal("https://ntfy.sh");
			expect(notifier.registerVariables.priority.default).to.equal(3);
			expect(notifier.registerVariables.tags.default).to.equal("");
		});
	});
});
