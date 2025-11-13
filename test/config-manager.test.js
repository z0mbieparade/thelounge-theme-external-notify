"use strict";

const { expect } = require("chai");
const ConfigManager = require("../lib/config-manager");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("ConfigManager", function() {
	let mockClient;
	let storageDir;
	let configManager;

	beforeEach(function() {
		// Create temporary storage directory
		storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "thelounge-test-"));

		mockClient = {
			id: "test-client-id",
			name: "testuser",
			manager: {
				saveUser: function(client) {
					// Mock save function - in real TheLounge this would persist to disk
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

	describe("load()", function() {
		it("should return default config when file does not exist", function() {
			const config = configManager.load();

			expect(config).to.be.an("object");
			expect(config.enabled).to.equal(false);
			expect(config.channelName).to.equal("external-notify");
			expect(config.services).to.be.an("object").that.is.empty;
			expect(config.filters).to.be.an("object");
			expect(config.filters.onlyWhenAway).to.equal(true);
			expect(config.filters.highlights).to.equal(true);
		});

		it("should load existing config from disk", function() {
			// First save a config
			const testConfig = {
				enabled: true,
				channelName: "external-notify",
				services: {
					pushover: {
						userKey: "test-user-key",
						apiToken: "test-api-token",
						priority: 0,
						sound: "pushover"
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

			configManager.save(testConfig);

			// Now load it
			const config = configManager.load();

			expect(config.enabled).to.equal(true);
			expect(config.services.pushover.userKey).to.equal("test-user-key");
		});

		it("should merge incomplete config with defaults", function() {
			// Save incomplete config
			const incompleteConfig = {
				enabled: true,
				services: {},
				filters: {}
			};

			configManager.save(incompleteConfig);

			const config = configManager.load();

			expect(config.enabled).to.equal(true);
			expect(config.channelName).to.equal("external-notify");
			expect(config.filters.onlyWhenAway).to.equal(true);
			expect(config.filters.highlights).to.equal(true);
		});

		it("should handle malformed JSON gracefully", function() {
			// Write malformed JSON to the config file
			fs.writeFileSync(configManager.configPath, "{invalid json", "utf8");

			const config = configManager.load();

			// Should return defaults when config is invalid
			expect(config.enabled).to.equal(false);
			expect(config.services).to.be.an("object").that.is.empty;
		});
	});

	describe("save()", function() {
		it("should save config to disk", function() {
			const testConfig = {
				enabled: true,
				channelName: "external-notify",
				services: {
					pushover: {
						userKey: "new-user-key",
						apiToken: "new-api-token",
						priority: 0,
						sound: "pushover"
					}
				},
				filters: {
					onlyWhenAway: true,
					highlights: true,
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			const result = configManager.save(testConfig);

			expect(result).to.equal(true);

			// Verify file exists
			expect(fs.existsSync(configManager.configPath)).to.equal(true);

			// Load and verify content
			const saved = JSON.parse(fs.readFileSync(configManager.configPath, "utf8"));
			expect(saved.enabled).to.equal(true);
			expect(saved.services.pushover.userKey).to.equal("new-user-key");
		});

		it("should validate config before saving", function() {
			const incompleteConfig = {
				enabled: true,
				services: {},
				filters: {}
			};

			const result = configManager.save(incompleteConfig);

			expect(result).to.equal(true);

			// Load and verify defaults were applied
			const saved = JSON.parse(fs.readFileSync(configManager.configPath, "utf8"));
			expect(saved.channelName).to.equal("external-notify");
			expect(saved.filters.onlyWhenAway).to.equal(true);
			expect(saved.filters.highlights).to.equal(true);
		});
	});

	describe("validateConfig()", function() {
		it("should validate boolean fields", function() {
			const config = {
				enabled: "true", // String instead of boolean
				services: {},
				filters: {
					onlyWhenAway: 1,
					highlights: "yes",
					channels: {
						whitelist: [],
						blacklist: []
					}
				}
			};

			const validated = configManager.validateConfig(config);

			expect(validated.enabled).to.equal(false); // Defaults to false
			expect(validated.filters.onlyWhenAway).to.equal(true); // Defaults to true
			expect(validated.filters.highlights).to.equal(true); // Defaults to true
		});
	});

	describe("isValid()", function() {
		it("should return false for empty services", function() {
			const isValid = configManager.isValid();
			expect(isValid).to.equal(false);
		});
	});

	describe("getConfigPath()", function() {
		it("should return correct config file path", function() {
			const expectedPath = path.join(storageDir, "testuser-config.json");
			expect(configManager.configPath).to.equal(expectedPath);
		});
	});

	describe("getDefaultConfig()", function() {
		it("should return valid default configuration", function() {
			const defaults = configManager.getDefaultConfig();

			expect(defaults.enabled).to.equal(false);
			expect(defaults.channelName).to.equal("external-notify");
			expect(defaults.services).to.be.an("object").that.is.empty;
			expect(defaults.filters.onlyWhenAway).to.equal(true);
			expect(defaults.filters.highlights).to.equal(true);
		});
	});
});
