"use strict";

const { expect } = require("chai");
const PushoverNotifier = require("../lib/notifiers/pushover");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

describe("PushoverNotifier", function() {
	describe("constructor", function() {
		it("should create notifier with valid config", function() {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier).to.be.an.instanceof(PushoverNotifier);
			expect(notifier.config.priority).to.equal(0);
			expect(notifier.config.sound).to.equal("pushover");
			expect(notifier.isMetadataMode).to.equal(false);
		});

		it("should not initialize with invalid config", function() {
			const config = {
				enabled: true,
				userKey: "short",
				apiToken: ""
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			// Should remain in metadata mode (not set up)
			expect(notifier.isMetadataMode).to.equal(true);
		});

		it("should use default priority and sound", function() {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30)
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier.config.priority).to.be.a('number');
			expect(notifier.config.sound).to.be.a('string');
		});
	});

	describe("validate()", function() {
		it("should return true for valid config", function() {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(true);
		});

		it("should return false for missing userKey", function() {
			const config = {
				enabled: true,
				userKey: "",
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			// Create instance in metadata mode
			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should return false for missing apiToken", function() {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "",
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier.validate()).to.equal(false);
		});

		it("should warn for incorrect key lengths", function() {
			const errors = [];
			const errorLogger = {
				info: () => {},
				warn: () => {},
				error: (msg) => errors.push(msg),
				debug: () => {}
			};

			const config = {
				enabled: true,
				userKey: "short-key",
				apiToken: "short-token",
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, errorLogger);

			// validateWithLogging should log errors
			const result = notifier.validateWithLogging();

			expect(result).to.equal(false);
			expect(errors.length).to.be.greaterThan(0);
		});
	});

	describe("name", function() {
		it("should return Pushover", function() {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			expect(notifier.name).to.equal("Pushover");
		});
	});

	describe("handleConfig() - case sensitivity", function() {
		it("should accept lowercase setting names", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			// Test with lowercase "userkey" instead of "userKey"
			const result = notifier.handleConfig(config, "userkey", "a".repeat(30));

			expect(result.success).to.equal(true);
			expect(config.services.Pushover.userKey).to.equal("a".repeat(30));
			// Should NOT create a lowercase key
			expect(config.services.Pushover.userkey).to.be.undefined;
		});

		it("should accept correct camelCase setting names", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			const result = notifier.handleConfig(config, "userKey", "a".repeat(30));

			expect(result.success).to.equal(true);
			expect(config.services.Pushover.userKey).to.equal("a".repeat(30));
		});

		it("should accept uppercase setting names", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			const result = notifier.handleConfig(config, "USERKEY", "a".repeat(30));

			expect(result.success).to.equal(true);
			expect(config.services.Pushover.userKey).to.equal("a".repeat(30));
			// Should NOT create an uppercase key
			expect(config.services.Pushover.USERKEY).to.be.undefined;
		});

		it("should accept mixed case setting names", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			const result = notifier.handleConfig(config, "UsErKeY", "a".repeat(30));

			expect(result.success).to.equal(true);
			expect(config.services.Pushover.userKey).to.equal("a".repeat(30));
			// Should NOT create a mixed case key
			expect(config.services.Pushover.UsErKeY).to.be.undefined;
		});

		it("should return correct camelCase key in success message", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			// Test with lowercase input
			const result = notifier.handleConfig(config, "apitoken", "b".repeat(30));

			expect(result.success).to.equal(true);
			expect(result.messages).to.be.an('array');
			// The success message should contain the correct camelCase "apiToken", not "apitoken"
			const successMessage = result.messages[0];
			expect(successMessage).to.include("apiToken");
			expect(successMessage).to.not.include("apitoken");
		});

		it("should reject unknown settings regardless of case", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			const result = notifier.handleConfig(config, "invalidkey", "value");

			expect(result.success).to.equal(false);
			expect(result.messages).to.be.an('array');
			expect(result.messages[0]).to.include("Unknown");
		});

		it("should work for optional settings with different cases", function() {
			const config = {
				services: {
					Pushover: {
						userKey: "a".repeat(30),
						apiToken: "b".repeat(30)
					}
				}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			// Test "priority" with lowercase
			const result1 = notifier.handleConfig(config, "priority", "1");
			expect(result1.success).to.equal(true);
			expect(config.services.Pushover.priority).to.equal(1);

			// Test "sound" with mixed case
			const result2 = notifier.handleConfig(config, "SoUnD", "cosmic");
			expect(result2.success).to.equal(true);
			expect(config.services.Pushover.sound).to.equal("cosmic");
		});

		it("should auto-enable when all required fields set via any case", function() {
			const config = {
				services: {}
			};
			const notifier = new PushoverNotifier({}, mockLogger);

			// Set userKey with lowercase
			notifier.handleConfig(config, "userkey", "a".repeat(30));
			expect(config.services.Pushover.enabled).to.equal(false);

			// Set apiToken with mixed case - should auto-enable
			const result = notifier.handleConfig(config, "APITOKEN", "b".repeat(30));
			expect(result.success).to.equal(true);
			expect(result.autoEnabled).to.equal(true);
			expect(config.services.Pushover.enabled).to.equal(true);
		});
	});

	describe("send()", function() {
		it("should format notification correctly", function(done) {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 1,
				sound: "cosmic"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			// Mock the Pushover client
			notifier.client.send = function(msg, callback) {
				expect(msg.message).to.equal("Test message");
				expect(msg.title).to.equal("Test title");
				expect(msg.priority).to.equal(1);
				expect(msg.sound).to.equal("cosmic");
				expect(msg.timestamp).to.be.a("number");

				callback(null, "success");
			};

			const notification = {
				title: "Test title",
				message: "Test message",
				timestamp: new Date()
			};

			notifier.send(notification).then(() => {
				done();
			}).catch(done);
		});

		it("should convert timestamp to unix timestamp", function(done) {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			const testDate = new Date("2025-01-01T00:00:00Z");
			const expectedTimestamp = Math.floor(testDate.getTime() / 1000);

			notifier.client.send = function(msg, callback) {
				expect(msg.timestamp).to.equal(expectedTimestamp);
				callback(null, "success");
			};

			const notification = {
				title: "Test",
				message: "Test",
				timestamp: testDate
			};

			notifier.send(notification).then(() => {
				done();
			}).catch(done);
		});

		it("should reject on error", function(done) {
			const config = {
				enabled: true,
				userKey: "a".repeat(30),
				apiToken: "b".repeat(30),
				priority: 0,
				sound: "pushover"
			};

			const notifier = new PushoverNotifier(config, mockLogger);

			notifier.client.send = function(msg, callback) {
				callback(new Error("API error"), null);
			};

			const notification = {
				title: "Test",
				message: "Test",
				timestamp: new Date()
			};

			notifier.send(notification).then(() => {
				done(new Error("Should have rejected"));
			}).catch((err) => {
				expect(err.message).to.equal("API error");
				done();
			});
		});
	});
});
