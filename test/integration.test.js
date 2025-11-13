"use strict";

const { expect } = require("chai");
const ConfigManager = require("../lib/config-manager");
const NotificationManager = require("../lib/notification-manager");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

// Mock notifier for testing
class MockNotifier {
	constructor(config, logger) {
		this.config = config;
		this.logger = logger;
		this.sentNotifications = [];
		this._name = "mock";
		this._isSetup = true; // Mock is always setup
	}

	async send(notification) {
		this.sentNotifications.push(notification);
		return Promise.resolve();
	}

	validate() {
		return true;
	}

	get name() {
		return this._name;
	}

	get isMetadataMode() {
		return !this._isSetup;
	}
}

describe("Integration Tests", function() {
	let mockClient;
	let storageDir;
	let configManager;

	beforeEach(function() {
		// Create temporary storage directory
		storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "thelounge-test-"));

		mockClient = {
			id: "test-client-id",
			name: "testuser",
			user: { away: false },
			manager: {
				saveUser: function(client) {
					// Mock save function
				}
			}
		};

		configManager = new ConfigManager(mockClient, storageDir);
	});

	afterEach(function() {
		// Clean up temporary directory
		if (fs.existsSync(storageDir)) {
			fs.rmSync(storageDir, { recursive: true, force: true });
		}
	});

	describe("End-to-end notification flow", function() {
		it("should process and send notification for valid message", async function() {
			// Setup configuration
			const config = {
				enabled: true,
				services: {
					mock: {
						apiKey: "test-key"
					}
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			configManager.save(config);

			// Create notification manager with mock notifier
			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier = new MockNotifier(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			// Simulate a highlighted message
			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true,
				timestamp: new Date()
			};

			const result = await notificationManager.processMessage(messageData, mockClient);

			expect(mockNotifier.sentNotifications).to.have.length(1);
			expect(result.services).to.include("mock");
		});

		it("should not send notification when disabled", async function() {
			const config = {
				enabled: false,
				services: {
					mock: {
						apiKey: "test-key"
					}
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			configManager.save(config);

			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier = new MockNotifier(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			// Even with a highlight, onlyWhenAway filter will block
			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true,
				timestamp: new Date()
			};

			// Test with away=false and onlyWhenAway=true
			config.filters.onlyWhenAway = true;
			const notificationManagerAway = new NotificationManager(config, mockLogger);
			notificationManagerAway.notifiers.mock = mockNotifier;

			const result = await notificationManagerAway.processMessage(messageData, mockClient);

			expect(result).to.equal(null);
			expect(mockNotifier.sentNotifications).to.have.length(0);
		});
	});

	describe("Highlight filtering", function() {
		it("should send notifications for highlights only", async function() {
			const config = {
				enabled: true,
				services: {
					mock: { enabled: true, apiKey: "test" }
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier = new MockNotifier(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			// Highlighted message
			await notificationManager.processMessage({
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true,
				timestamp: new Date()
			}, mockClient);

			// Non-highlighted message
			await notificationManager.processMessage({
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "regular message",
				highlight: false,
				timestamp: new Date()
			}, mockClient);

			// Another highlighted message
			await notificationManager.processMessage({
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "alice",
				message: "testuser are you there?",
				highlight: true,
				timestamp: new Date()
			}, mockClient);

			// Should only send for the 2 highlights
			expect(mockNotifier.sentNotifications).to.have.length(2);
		});
	});

	describe("Message deduplication", function() {
		it("should not send duplicate notifications", async function() {
			const config = {
				enabled: true,
				services: {
					mock: { enabled: true, apiKey: "test" }
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier = new MockNotifier(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true,
				timestamp: new Date()
			};

			// Send same message twice
			await notificationManager.processMessage(messageData, mockClient);
			await notificationManager.processMessage(messageData, mockClient);

			// Should only send once
			expect(mockNotifier.sentNotifications).to.have.length(1);
		});

		it("should send different messages separately", async function() {
			const config = {
				enabled: true,
				services: {
					mock: { enabled: true, apiKey: "test" }
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier = new MockNotifier(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			// Send two different messages
			await notificationManager.processMessage({
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "first message testuser",
				highlight: true,
				timestamp: new Date()
			}, mockClient);

			await notificationManager.processMessage({
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "second message testuser",
				highlight: true,
				timestamp: new Date()
			}, mockClient);

			expect(mockNotifier.sentNotifications).to.have.length(2);
		});
	});

	describe("Configuration persistence", function() {
		it("should persist and reload configuration", function() {
			const testConfig = {
				enabled: true,
				channelName: "test-channel",
				services: {
					pushover: {
						userKey: "test-user-key",
						apiToken: "test-api-token",
						priority: 1,
						sound: "cosmic"
					}
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: ["#test"],
						blacklist: ["#spam"]
					}
				}
			};

			// Save config
			configManager.save(testConfig);

			// Create new config manager to test persistence
			const newConfigManager = new ConfigManager(mockClient, storageDir);
			const loaded = newConfigManager.load();

			expect(loaded.enabled).to.equal(true);
			expect(loaded.channelName).to.equal("test-channel");
			expect(loaded.services.pushover.userKey).to.equal("test-user-key");
			expect(loaded.filters.onlyWhenAway).to.equal(false);
		});
	});

	describe("Multiple notifiers", function() {
		it("should send to all configured notifiers", async function() {
			const config = {
				enabled: true,
				services: {
					mock1: { apiKey: "test1" },
					mock2: { apiKey: "test2" }
				},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			const notificationManager = new NotificationManager(config, mockLogger);
			const mockNotifier1 = new MockNotifier(config, mockLogger);
			const mockNotifier2 = new MockNotifier(config, mockLogger);

			notificationManager.notifiers.mock1 = mockNotifier1;
			notificationManager.notifiers.mock2 = mockNotifier2;

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true,
				timestamp: new Date()
			};

			await notificationManager.processMessage(messageData, mockClient);

			expect(mockNotifier1.sentNotifications).to.have.length(1);
			expect(mockNotifier2.sentNotifications).to.have.length(1);
		});
	});
});
