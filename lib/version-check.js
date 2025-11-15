"use strict";

const https = require("https");

/**
 * Version Check Utility
 * Checks for updates by comparing local version with GitHub repository
 */

/**
 * Compare two semver version strings
 * @param {string} current - Current version (e.g., "1.0.0")
 * @param {string} latest - Latest version (e.g., "1.1.0")
 * @returns {number} -1 if current < latest, 0 if equal, 1 if current > latest
 */
function compareVersions(current, latest) {
	// Remove 'v' prefix if present
	const cleanCurrent = current.replace(/^v/, '');
	const cleanLatest = latest.replace(/^v/, '');

	const currentParts = cleanCurrent.split('.').map(Number);
	const latestParts = cleanLatest.split('.').map(Number);

	for (let i = 0; i < 3; i++) {
		const currentPart = currentParts[i] || 0;
		const latestPart = latestParts[i] || 0;

		if (currentPart < latestPart) return -1;
		if (currentPart > latestPart) return 1;
	}

	return 0;
}

/**
 * Fetch package.json from GitHub repository
 * @param {string} repoUrl - GitHub repository URL
 * @returns {Promise<Object>} Package.json contents
 */
function fetchRemotePackageJson(repoUrl) {
	return new Promise((resolve, reject) => {
		// Extract owner and repo from GitHub URL
		// Handles: https://github.com/user/repo or https://github.com/user/repo.git
		const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
		if (!match) {
			return reject(new Error('Invalid GitHub repository URL'));
		}

		const owner = match[1];
		const repo = match[2];

		// Fetch package.json from main/master branch
		const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`;

		const request = https.get(url, { timeout: 5000 }, (res) => {
			let data = '';

			if (res.statusCode === 404) {
				// Try master branch if main doesn't exist
				const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/package.json`;
				https.get(masterUrl, { timeout: 5000 }, (masterRes) => {
					let masterData = '';

					if (masterRes.statusCode !== 200) {
						return reject(new Error(`Failed to fetch package.json: ${masterRes.statusCode}`));
					}

					masterRes.on('data', chunk => masterData += chunk);
					masterRes.on('end', () => {
						try {
							resolve(JSON.parse(masterData));
						} catch (err) {
							reject(new Error('Invalid JSON in remote package.json'));
						}
					});
				}).on('error', reject);
				return;
			}

			if (res.statusCode !== 200) {
				return reject(new Error(`Failed to fetch package.json: ${res.statusCode}`));
			}

			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					resolve(JSON.parse(data));
				} catch (err) {
					reject(new Error('Invalid JSON in remote package.json'));
				}
			});
		});

		request.on('error', reject);
		request.on('timeout', () => {
			request.destroy();
			reject(new Error('Request timeout'));
		});
	});
}

/**
 * Check if a newer version is available
 * @param {string} currentVersion - Current version
 * @param {string} repoUrl - GitHub repository URL
 * @returns {Promise<Object>} Update information
 */
async function checkForUpdate(currentVersion, repoUrl) {
	try {
		const remotePackage = await fetchRemotePackageJson(repoUrl);
		const latestVersion = remotePackage.version;

		const comparison = compareVersions(currentVersion, latestVersion);

		return {
			updateAvailable: comparison < 0,
			currentVersion: currentVersion,
			latestVersion: latestVersion,
			repoUrl: repoUrl
		};
	} catch (err) {
		// Silently fail - don't bother user with network errors
		return {
			updateAvailable: false,
			currentVersion: currentVersion,
			latestVersion: null,
			error: err.message
		};
	}
}

module.exports = {
	checkForUpdate,
	compareVersions,
	fetchRemotePackageJson
};
