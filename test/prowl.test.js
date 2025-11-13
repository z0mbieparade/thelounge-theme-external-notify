"use strict";

const { expect } = require("chai");
const ProwlNotifier = require("../lib/notifiers/prowl");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

describe("ProwlNotifier", function() {
	describe("constructor", function() {
		it("should create notifier with valid config", function() {
			const config = {
				enabled: true,
				apiKey: "a".repeat(40),
				priority: 0,
				application: "TheLounge"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier).to.be.an.instanceof(ProwlNotifier);
			expect(notifier.config.apiKey).to.equal("a".repeat(40));
			expect(notifier.config.priority).to.equal(0);
			expect(notifier.config.application).to.equal("TheLounge");
			expect(notifier.isMetadataMode).to.equal(false);
		});

		it("should not initialize with invalid config", function() {
			const config = {
				enabled: true,
				apiKey: "short-key"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			// Should remain in metadata mode (not set up)
			expect(notifier.isMetadataMode).to.equal(true);
		});

		it("should use default priority and application", function() {
			const config = {
				enabled: true,
				apiKey: "a".repeat(40)
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.config.priority).to.equal(0);
			expect(notifier.config.application).to.equal("TheLounge");
		});
	});

	describe("validate()", function() {
		it("should return true for valid config", function() {
			const config = {
				enabled: true,
				apiKey: "a".repeat(40),
				priority: 0,
				application: "TheLounge"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(true);
		});

		it("should return false for missing apiKey", function() {
			const config = {
				enabled: true,
				apiKey: "",
				priority: 0,
				application: "TheLounge"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should return false for incorrect apiKey length", function() {
			const config = {
				enabled: false,
				apiKey: "a".repeat(30),
				priority: 0,
				application: "TheLounge"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should return false for invalid priority", function() {
			const config = {
				enabled: false,
				apiKey: "a".repeat(40),
				priority: 10,
				application: "TheLounge"
			};

			const notifier = new ProwlNotifier(config, mockLogger);

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
				apiKey: "short"
			};

			const notifier = new ProwlNotifier(config, errorLogger);

			// validateWithLogging should log errors
			const result = notifier.validateWithLogging();

			expect(result).to.equal(false);
			expect(errors.length).to.be.greaterThan(0);
		});
	});

	describe("name", function() {
		it("should return Prowl", function() {
			const config = {
				enabled: true,
				apiKey: "a".repeat(40)
			};

			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.name).to.equal("Prowl");
		});
	});

	describe("send()", function() {
		it("should throw error if not setup", function() {
			const config = {
				enabled: false,
				apiKey: ""
			};

			const notifier = new ProwlNotifier(config, mockLogger);

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
			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.registerVariables).to.have.property("apiKey");
			expect(notifier.registerVariables).to.have.property("priority");
			expect(notifier.registerVariables).to.have.property("application");

			expect(notifier.registerVariables.apiKey.required).to.equal(true);
			expect(notifier.registerVariables.priority.required).to.equal(false);
			expect(notifier.registerVariables.application.required).to.equal(false);
		});

		it("should have correct defaults", function() {
			const config = {};
			const notifier = new ProwlNotifier(config, mockLogger);

			expect(notifier.registerVariables.priority.default).to.equal(0);
			expect(notifier.registerVariables.application.default).to.equal("TheLounge");
		});
	});
});
