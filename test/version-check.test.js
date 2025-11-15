"use strict";

const { expect } = require("chai");
const { compareVersions, checkForUpdate } = require("../lib/version-check");

describe("Version Check", function() {
	describe("compareVersions()", function() {
		it("should return -1 when current < latest", function() {
			expect(compareVersions("1.0.0", "1.0.1")).to.equal(-1);
			expect(compareVersions("1.0.0", "1.1.0")).to.equal(-1);
			expect(compareVersions("1.0.0", "2.0.0")).to.equal(-1);
			expect(compareVersions("1.2.3", "1.2.4")).to.equal(-1);
		});

		it("should return 0 when versions are equal", function() {
			expect(compareVersions("1.0.0", "1.0.0")).to.equal(0);
			expect(compareVersions("2.5.3", "2.5.3")).to.equal(0);
		});

		it("should return 1 when current > latest", function() {
			expect(compareVersions("1.0.1", "1.0.0")).to.equal(1);
			expect(compareVersions("1.1.0", "1.0.0")).to.equal(1);
			expect(compareVersions("2.0.0", "1.0.0")).to.equal(1);
			expect(compareVersions("1.2.4", "1.2.3")).to.equal(1);
		});

		it("should handle versions with 'v' prefix", function() {
			expect(compareVersions("v1.0.0", "v1.0.1")).to.equal(-1);
			expect(compareVersions("v1.0.0", "1.0.0")).to.equal(0);
			expect(compareVersions("1.0.0", "v1.0.0")).to.equal(0);
		});

		it("should handle versions with missing parts", function() {
			expect(compareVersions("1.0", "1.0.0")).to.equal(0);
			expect(compareVersions("1", "1.0.0")).to.equal(0);
			expect(compareVersions("1.0", "1.0.1")).to.equal(-1);
		});

		it("should compare major versions correctly", function() {
			expect(compareVersions("1.9.9", "2.0.0")).to.equal(-1);
			expect(compareVersions("2.0.0", "1.9.9")).to.equal(1);
		});

		it("should compare minor versions correctly", function() {
			expect(compareVersions("1.1.9", "1.2.0")).to.equal(-1);
			expect(compareVersions("1.2.0", "1.1.9")).to.equal(1);
		});

		it("should compare patch versions correctly", function() {
			expect(compareVersions("1.0.1", "1.0.2")).to.equal(-1);
			expect(compareVersions("1.0.2", "1.0.1")).to.equal(1);
		});
	});

	describe("checkForUpdate()", function() {
		// Note: We can't easily test the actual network request without mocking
		// or hitting the real GitHub API. These tests verify the structure.

		it("should export checkForUpdate function", function() {
			expect(checkForUpdate).to.be.a('function');
		});

		it("should return a promise", function() {
			const result = checkForUpdate("1.0.0", "https://github.com/user/repo");
			expect(result).to.be.instanceOf(Promise);
		});

		it("should handle invalid repository URL gracefully", async function() {
			this.timeout(10000); // Allow time for network timeout

			const result = await checkForUpdate("1.0.0", "not-a-valid-url");
			expect(result).to.have.property('updateAvailable', false);
			expect(result).to.have.property('error');
		});

		it("should return proper structure on error", async function() {
			this.timeout(10000);

			const result = await checkForUpdate("1.0.0", "https://github.com/nonexistent/fakerepo123456789");
			expect(result).to.have.property('updateAvailable');
			expect(result).to.have.property('currentVersion', '1.0.0');
			expect(result).to.have.property('latestVersion');
		});
	});

	describe("version check utility file", function() {
		it("should have version-check.js file", function() {
			const fs = require("fs");
			const path = require("path");
			const versionCheckPath = path.join(__dirname, '../lib/version-check.js');
			expect(fs.existsSync(versionCheckPath)).to.be.true;
		});

		it("should export required functions", function() {
			const versionCheck = require("../lib/version-check");
			expect(versionCheck).to.have.property('compareVersions');
			expect(versionCheck).to.have.property('checkForUpdate');
			expect(versionCheck).to.have.property('fetchRemotePackageJson');
		});
	});
});
