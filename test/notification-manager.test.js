"use strict";

const { expect } = require("chai");
const NotificationManager = require("../lib/notification-manager");

// Mock logger
const mockLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};

// Mock notifier
class MockNotifier {
	constructor() {
		this.sentNotifications = [];
	}

	async send(notification) {
		this.sentNotifications.push(notification);
		return Promise.resolve();
	}

	getName() {
		return "mock";
	}
}

describe("NotificationManager", function() {
	let notificationManager;
	let mockNotifier;

	beforeEach(function() {
		mockNotifier = new MockNotifier();
	});

	describe("shouldNotify()", function() {
		it("should notify on highlight when highlights enabled", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser, how are you?",
				highlight: true // TheLounge sets this
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(true);
		});

		it("should not notify on non-highlight when only highlights enabled", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "just a regular message",
				highlight: false
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(false);
		});

		it("should not notify when highlights disabled", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: false,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(false);
		});

		it("should allow whitelisted channels", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: ["#allowed"],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#allowed",
				nick: "bob",
				message: "hey testuser",
				highlight: true
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(true);
		});

		it("should allow non-blacklisted channels", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: ["#blocked"]
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#allowed",
				nick: "bob",
				message: "hey testuser",
				highlight: true
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(true);
		});

		it("should respect onlyWhenAway filter", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: true,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true
			};

			// User is not away
			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(false);
		});

		it("should notify when away if onlyWhenAway enabled", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: true,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hey testuser",
				highlight: true
			};

			// User is away
			const client = {
				name: "testuser",
				user: { away: true }
			};

			const result = notificationManager.shouldNotify(messageData, client);
			expect(result).to.equal(true);
		});
	});

	describe("formatNotification()", function() {
		it("should format regular messages", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hello world",
				timestamp: new Date()
			};

			const notification = notificationManager.formatNotification(messageData);

			expect(notification.title).to.equal("freenode - #test");
			expect(notification.message).to.equal("<bob> hello world");
		});

		it("should format action messages", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "action",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "waves hello",
				timestamp: new Date()
			};

			const notification = notificationManager.formatNotification(messageData);

			expect(notification.title).to.equal("freenode - #test");
			expect(notification.message).to.equal("* bob waves hello");
		});

		it("should format private messages without channel", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "bob", // PM uses nick as channel
				nick: "bob",
				message: "private message",
				timestamp: new Date()
			};

			const notification = notificationManager.formatNotification(messageData);

			expect(notification.title).to.equal("freenode");
			expect(notification.message).to.equal("<bob> private message");
		});
	});

	describe("getDeduplicationKey()", function() {
		it("should generate consistent keys for same message", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData = {
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hello world"
			};

			const key1 = notificationManager.getDeduplicationKey(messageData);
			const key2 = notificationManager.getDeduplicationKey(messageData);

			expect(key1).to.equal(key2);
		});

		it("should generate different keys for different messages", function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);

			const messageData1 = {
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "hello world"
			};

			const messageData2 = {
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "goodbye world"
			};

			const key1 = notificationManager.getDeduplicationKey(messageData1);
			const key2 = notificationManager.getDeduplicationKey(messageData2);

			expect(key1).to.not.equal(key2);
		});
	});

	describe("processMessage()", function() {
		it("should send notification for valid message", async function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);
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

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = await notificationManager.processMessage(messageData, client);

			expect(mockNotifier.sentNotifications).to.have.length(1);
			expect(result.services).to.include("mock");
		});

		it("should not send notification for filtered message", async function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);
			notificationManager.notifiers.mock = mockNotifier;

			const messageData = {
				type: "message",
				network: "freenode",
				channel: "#test",
				nick: "bob",
				message: "regular message",
				highlight: false,
				timestamp: new Date()
			};

			const client = {
				name: "testuser",
				user: { away: false }
			};

			const result = await notificationManager.processMessage(messageData, client);

			expect(result).to.equal(null);
			expect(mockNotifier.sentNotifications).to.have.length(0);
		});

		it("should deduplicate identical messages", async function() {
			const config = {
				services: {},
				filters: {
					onlyWhenAway: false,
					highlights: true,
					channels: { whitelist: [], blacklist: [] }
				}
			};

			notificationManager = new NotificationManager(config, mockLogger);
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

			const client = {
				name: "testuser",
				user: { away: false }
			};

			// Send first message
			await notificationManager.processMessage(messageData, client);

			// Try to send same message again
			await notificationManager.processMessage(messageData, client);

			// Should only send once
			expect(mockNotifier.sentNotifications).to.have.length(1);
		});
	});
});
