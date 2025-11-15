"use strict";

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

describe('External Notify Plugin Basic Tests', function() {
	it('should have all required files', function() {
		const files = [
			'package.json',
			'index.js',
			'README.md',
			'LICENSE',
			'config.example.json',
			'TESTING.md',
			'verify-plugin.js'
		];
		files.forEach(file => {
			const filePath = path.join(__dirname, '..', file);
			expect(fs.existsSync(filePath), `${file} should exist`).to.be.true;
		});
	});

	it('should have all required library files', function() {
		const files = [
			'lib/commands.js',
			'lib/config-manager.js',
			'lib/notification-manager.js',
			'lib/version-check.js',
			'lib/notifiers/base.js',
			'lib/notifiers/pushover.js'
		];
		files.forEach(file => {
			const filePath = path.join(__dirname, '..', file);
			expect(fs.existsSync(filePath), `${file} should exist`).to.be.true;
		});
	});

	it('should have valid package.json', function() {
		const packagePath = path.join(__dirname, '../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

		// Check required fields
		expect(packageJson).to.have.property('name', 'thelounge-plugin-external-notify');
		expect(packageJson).to.have.property('main', 'index.js');
		expect(packageJson).to.have.property('thelounge');
		expect(packageJson.thelounge).to.have.property('supports');
		expect(packageJson.thelounge).to.have.property('type', 'plugin');

		// Check keywords include thelounge-plugin
		expect(packageJson.keywords).to.include('thelounge-plugin');
		expect(packageJson.keywords).to.include('notifications');
		expect(packageJson.keywords).to.include('pushover');

		// Check dependencies
		expect(packageJson.dependencies).to.have.property('pushover-notifications');
	});

	it('should have valid main entry point', function() {
		const indexPath = path.join(__dirname, '../index.js');
		expect(fs.existsSync(indexPath)).to.be.true;

		// Check that the file is not empty
		const content = fs.readFileSync(indexPath, 'utf8');
		expect(content.length).to.be.greaterThan(0);
		expect(content).to.include('module.exports');
	});

	it('should export correct plugin structure', function() {
		const indexPath = path.join(__dirname, '../index.js');
		const content = fs.readFileSync(indexPath, 'utf8');

		// Check for required exports and structure
		expect(content).to.include('onServerStart');
		expect(content).to.include('module.exports');
		expect(content).to.include('api.Commands.add');
		expect(content).to.include('notify');
	});

	it('should have proper command structure', function() {
		const commandsPath = path.join(__dirname, '../lib/commands.js');
		const content = fs.readFileSync(commandsPath, 'utf8');

		// Check for command structure
		expect(content).to.include('notifyCommand');
		expect(content).to.include('input: function');
		expect(content).to.include('allowDisconnected');
	});

	it('should have version command', function() {
		const commandsPath = path.join(__dirname, '../lib/commands.js');
		const content = fs.readFileSync(commandsPath, 'utf8');

		// Check for version command
		expect(content).to.include('case "version":');
		expect(content).to.include('handleVersion');
		expect(content).to.include('function handleVersion');
		expect(content).to.include('package.json');
	});

	it('should include version in virtual channel topic', function() {
		const indexPath = path.join(__dirname, '../index.js');
		const content = fs.readFileSync(indexPath, 'utf8');

		// Check that channel topic includes version
		expect(content).to.include('package.json');
		expect(content).to.include('External Notify - Settings & Status');
		expect(content).to.match(/v\$\{version\}/);
	});

	it('should store config in network objects', function() {
		const indexPath = path.join(__dirname, '../index.js');
		const content = fs.readFileSync(indexPath, 'utf8');

		// Check that plugin uses network objects for config storage
		expect(content).to.include('ConfigManager');
		expect(content).to.include('network');
	});

	it('should have proper README documentation', function() {
		const readmePath = path.join(__dirname, '../README.md');
		const content = fs.readFileSync(readmePath, 'utf8');

		// Check for essential documentation sections
		expect(content).to.include('# TheLounge External Notify Plugin');
		expect(content).to.include('## Installation');
		expect(content).to.include('## Usage');
		expect(content).to.include('## Configuration');
		expect(content).to.include('/notify');
		expect(content).to.include('Pushover');
	});

	it('should have example configuration', function() {
		const examplePath = path.join(__dirname, '../config.example.json');
		expect(fs.existsSync(examplePath)).to.be.true;

		const content = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

		// Check structure
		expect(content).to.have.property('enabled');
		expect(content).to.have.property('services');
		expect(content).to.have.property('filters');
		expect(content.services).to.have.property('pushover');
	});

	it('should have config manager class', function() {
		const configPath = path.join(__dirname, '../lib/config-manager.js');
		const content = fs.readFileSync(configPath, 'utf8');

		expect(content).to.include('class ConfigManager');
		expect(content).to.include('load()');
		expect(content).to.include('save(');
		expect(content).to.include('validateConfig');
	});

	it('should have notification manager class', function() {
		const notificationPath = path.join(__dirname, '../lib/notification-manager.js');
		const content = fs.readFileSync(notificationPath, 'utf8');

		expect(content).to.include('class NotificationManager');
		expect(content).to.include('processMessage');
		expect(content).to.include('shouldNotify');
		expect(content).to.include('formatNotification');
	});

	it('should have base notifier class', function() {
		const basePath = path.join(__dirname, '../lib/notifiers/base.js');
		const content = fs.readFileSync(basePath, 'utf8');

		expect(content).to.include('class BaseNotifier');
		expect(content).to.include('send(');
		expect(content).to.include('validate');
		expect(content).to.include('get name');
	});

	it('should have pushover notifier implementation', function() {
		const pushoverPath = path.join(__dirname, '../lib/notifiers/pushover.js');
		const content = fs.readFileSync(pushoverPath, 'utf8');

		expect(content).to.include('class PushoverNotifier');
		expect(content).to.include('extends BaseNotifier');
		expect(content).to.include('pushover-notifications');
	});

	it('should have comprehensive testing documentation', function() {
		const testingPath = path.join(__dirname, '../TESTING.md');
		const content = fs.readFileSync(testingPath, 'utf8');

		// Check for essential sections
		expect(content).to.include('# Testing Guide');
		expect(content).to.include('## Automated Tests');
		expect(content).to.include('## Manual Testing');
		expect(content).to.include('### Test Scenarios');
		expect(content).to.include('### Troubleshooting');
	});

	it('should have plugin verification script', function() {
		const verifyPath = path.join(__dirname, '../verify-plugin.js');
		const content = fs.readFileSync(verifyPath, 'utf8');

		expect(content).to.include('#!/usr/bin/env node');
		expect(content).to.include('Plugin Verification Script');
		expect(content).to.include('checks');
	});

	it('should have test directory with test files', function() {
		const testDir = path.join(__dirname, '..');
		expect(fs.existsSync(path.join(testDir, 'test'))).to.be.true;

		const testFiles = [
			'test/simple.test.js',
			'test/config-manager.test.js',
			'test/notification-manager.test.js',
			'test/pushover.test.js',
			'test/integration.test.js',
			'test/version-check.test.js'
		];

		testFiles.forEach(file => {
			const filePath = path.join(testDir, file);
			expect(fs.existsSync(filePath), `${file} should exist`).to.be.true;
		});
	});
});
