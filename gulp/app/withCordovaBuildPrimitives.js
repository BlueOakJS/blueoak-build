/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var gulp = require('gulp');
var utils = require('../utils');
var spawn = require('superspawn').spawn;
var fs = require('fs');
var path = require('path');
var os = require('os');
var chalk = require('chalk');
var iosUtils = require('./list-provisioning-profiles');
var rename = require('gulp-rename');
var setBundleId = require('./setBundleId');


function runPrepare(platform) {
	console.log(chalk.cyan('Launching cordova prepare...'));
	return spawn('cordova', ['prepare', platform], {
		printCommand: true,
		stdio: 'inherit',
		cwd: utils.getGeneratorConfig().cordovaDirectory
	});
}


function buildCordovaAndroid() {
	var generatorConfig = utils.getGeneratorConfig();

	if (utils.getBuildType() == 'release' && (!generatorConfig.androidkeystorename || !generatorConfig.androidkeyaliasname))
		console.log(chalk.red('WARNING: Android keystore not configured for release build.  Use yo blueoak:create-keystore to create and configure one.'));

	var keystorePassword = process.env.KEYSTORE_PASSWORD;
	var keyPassword = process.env.KEY_PASSWORD;
	var cliOptions = utils.getCommandLineOptions();
	if (cliOptions.storepass)
		keystorePassword = cliOptions.storepass;
	if (cliOptions.keypass)
		keyPassword = cliOptions.keypass;

	var sign = generatorConfig.androidkeystorename && generatorConfig.androidkeyaliasname;
	var release = utils.getBuildType() == 'release' || sign;

	if (sign) {
		var data = [];

		// Add all the options related to key signing to the array to be added to 'release-signing.properties'
		data.push('storeFile=' + generatorConfig.androidkeystorename);
		data.push('keyAlias=' + generatorConfig.androidkeyaliasname);
		if (keystorePassword)
			data.push('storePassword=' + keystorePassword);
		if (keyPassword)
			data.push('keyPassword=' + keyPassword);

		// Write the release-signing.properties file
		fs.writeFileSync(path.join(generatorConfig.cordovaDirectory, 'release-signing.properties'), data.join(os.EOL));
	}

	return runPrepare('android').then(compileApp.bind(null, 'android')).then(
		function() {
			var base = path.join(generatorConfig.cordovaDirectory, 'platforms/android/build/outputs/apk');

			var filePath;
			if (release) {
				if (sign)
					filePath = path.join(base, 'android-release.apk');
				else
					filePath = path.join(base, 'android-release-unsigned.apk');
			} else {
				filePath = path.join(base, 'android-debug.apk');
			}

			var stream = gulp.src(filePath)
				.pipe(gulp.dest('apk'));

			return utils.streamToPromise(stream);
		}
	);
}


function buildCordovaIOS() {
	var generatorConfig = utils.getGeneratorConfig();

	return runPrepare('ios').then(compileApp.bind(null, 'ios')).then(
		function() {
			var stream = gulp.src(path.join(generatorConfig.cordovaDirectory, 'platforms/ios/build/device/*.ipa'))
				// Rename the IPA to add a "debug"/"release" suffix to it.
				.pipe(rename(generatorConfig.cordovaProjectName + "-" + utils.getBuildType() + ".ipa"))
				.pipe(gulp.dest('ipa'));
			return utils.streamToPromise(stream);
		}
	);
}


function cordovaRun(platform) {
	console.log(chalk.cyan('Deploying and running app...'));

	if (platform == 'ios' && utils.getCommandLineOptions().device) {
		// Special case deploying to an iOS device.  We pass the -L switch to ios-deploy so that
		// lldb will exit after it launches the app.  If we don't do this, we can get zombie
		// lldbs running in the background, or the terminal detached from gulp such that
		// CTRL-C doesn't work, which requires killall from another window to kill them.
		return spawn('ios-deploy', ['-L', '-b', path.join(utils.getGeneratorConfig().cordovaDirectory, 'platforms/ios/build/device', utils.getGeneratorConfig().cordovaProjectName) + ".app"], {
			printCommand: true,
			stdio: 'inherit'
		});
	}

	var device;
	if (utils.getCommandLineOptions().device)
		device = '--device';
	else
		device = '--emulator';

	return spawn('.' + path.sep + 'run', ['--nobuild', device], {
		printCommand: true,
		stdio: 'inherit',
		cwd: path.join(utils.getGeneratorConfig().cordovaDirectory, '/platforms/' + platform + '/cordova/')
	});
}


function compileApp(platform) {
	var generatorConfig = utils.getGeneratorConfig();
	var envConfig = utils.getEnvConfig();

	if (platform == 'ios' && "bundleId" in envConfig.appConfig)
		setBundleId(generatorConfig.cordovaDirectory, generatorConfig.cordovaProjectName, envConfig.appConfig.bundleId);

	var args = ['compile', platform, '--' + utils.getBuildType()];

	var device;
	if (utils.getCommandLineOptions().device)
		device = '--device';
	else
		device = '--emulator';
	args.push(device);

	if (platform == 'ios') {
		// Get the provisioning profile from the config.
		var provisioningProfile = envConfig.appConfig.provisioningProfile;

		// Allow the user to override it via CLI.
		if (utils.getCommandLineOptions().profile)
			provisioningProfile = utils.getCommandLineOptions().profile;

		if (provisioningProfile) {
			var UUID;

			if (iosUtils.isUUID(provisioningProfile)) {
				UUID = provisioningProfile;
			} else {
				var installedProvisioningProfiles = iosUtils.getInstalledProvisioningProfiles();
				UUID = installedProvisioningProfiles.byName[provisioningProfile];
				if (!UUID) {
					console.log(chalk.red.bold('Provisioning profile ' + provisioningProfile + ' not found'));
					console.log(chalk.cyan('Use \'gulp list-provisioning-profiles\' to show the installed provisioning profiles.'));
					throw new Error('Provisioning profile ' + provisioningProfile + ' not found');
				}
				if (UUID.length != 1) {
					console.log(chalk.red.bold('Provisioning profile ' + provisioningProfile + ' is not unique'));
					console.log(chalk.cyan('Use \'gulp list-provisioning-profiles\' to show the installed provisioning profiles.'));
					throw new Error('Provisioning profile ' + provisioningProfile + ' is not unique');
				}
				console.log(chalk.cyan('Using provisioning profile ' + UUID));
			}

			args.push('--', '--provisioningProfile', UUID);
		}
	}

	console.log(chalk.cyan('Building app...'));
	return spawn('cordova', args, {
		printCommand: true,
		stdio: 'inherit',
		cwd: generatorConfig.cordovaDirectory
	});
}


function withCordovaBuildPrimitives(platform) {
	if (platform == 'ios')
		this.buildApp = buildCordovaIOS;
	else
		this.buildApp = buildCordovaAndroid;
	this.runPrepare = runPrepare;
	this.runApp = cordovaRun;
	this.compileApp = compileApp;
	this.platformType = 'cordova';
}

module.exports = withCordovaBuildPrimitives;
