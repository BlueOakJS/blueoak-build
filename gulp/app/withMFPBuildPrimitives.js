/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var utils = require('../utils');
var spawn = require('superspawn').spawn;
var del = require('del');
var propertiesParser = require('properties-parser');
var chalk = require('chalk');
var Q = require('q');
var iosUtils = require('./list-provisioning-profiles');
var setBundleId = require('./setBundleId');
var setMFPiOSPush = require('./setMFPiOSPush');
var setMFPAndroidPush = require('./setMFPAndroidPush');


function runPrepare() {
	try {
		setMFPAndroidPush();
		setMFPiOSPush();
	} catch(err) {
		console.log("error ", err, err.stack)
		throw err;
	}

	var envConfig = utils.getEnvConfig();

	var args = ['push'];

	var mfpServerName = envConfig.appConfig.mfpServerName;
	if (mfpServerName) {
		args.push(mfpServerName);

		var mfpContextRoot = envConfig.appConfig.mfpContextRoot;
		if (mfpContextRoot)
			args.push(mfpContextRoot);
	}

	args.push('-n');

	return spawn('mfp', args, {
		printCommand: true,
		stdio: 'inherit',
		cwd: utils.getGeneratorConfig().cordovaDirectory
	});
}


function buildMFPAndroidWithPrepare() {
	return runPrepare().then(buildMFPAndroid);
}


function extractProjectNameFromManifest(projectPath) {
    var manifestPath = path.join(projectPath, 'AndroidManifest.xml');
    var manifestData = fs.readFileSync(manifestPath, 'utf8');
    var m = /<activity[\s\S]*?android:name\s*=\s*"(.*?)"/i.exec(manifestData);
    if (!m) {
        throw new Error('Could not find activity name in ' + manifestPath);
    }
    return m[1];
}


function extractSubProjectPaths(androidDir) {
    var data = fs.readFileSync(path.join(androidDir, 'project.properties'), 'utf8');
    var ret = {};
    var r = /^\s*android\.library\.reference\.\d+=(.*)(?:\s|$)/mg
    var m;
    while (m = r.exec(data)) {
        ret[m[1]] = 1;
    }
    return Object.keys(ret);
}


function createBuildXml(androidDir) {
	console.log(chalk.cyan('Creating build.xml...'));

    var sdkDir = process.env['ANDROID_HOME'];
    var buildTemplate = fs.readFileSync(path.join(sdkDir, 'tools', 'lib', 'build.template'), 'utf8');
    function writeBuildXml(projectPath) {
        var newData = buildTemplate.replace('PROJECT_NAME', extractProjectNameFromManifest(androidDir));
        fs.writeFileSync(path.join(projectPath, 'build.xml'), newData);
    }
    var subProjects = extractSubProjectPaths(androidDir);
    writeBuildXml(androidDir);
    for (var i = 0; i < subProjects.length; ++i) {
        writeBuildXml(path.join(androidDir, subProjects[i]));
    }
}


function buildMFPAndroid() {
	var generatorConfig = utils.getGeneratorConfig();

	console.log(chalk.cyan('Building app...'));

	try {
		fs.accessSync(path.join(generatorConfig.cordovaDirectory, '/platforms/android/build.xml'), fs.R_OK);
	} catch(err) {
		// build.xml file missing, create it.
		createBuildXml(path.join(generatorConfig.cordovaDirectory, '/platforms/android'));
	}

	if (utils.getBuildType() == 'release' && (!generatorConfig.androidkeystorename || !generatorConfig.androidkeyaliasname))
		console.log(chalk.red('WARNING: Android keystore not configured for release build.  Use yo blueoak:create-keystore to create and configure one.'));

	if (generatorConfig.androidkeystorename) {
		var antProperties;
		try {
			antProperties = propertiesParser.createEditor(path.join(generatorConfig.cordovaDirectory, '/platforms/android/ant.properties'));
		} catch(err) {
			if (err.code != 'ENOENT')
				throw err;

			antProperties = propertiesParser.createEditor();
		}

		antProperties.set('key.store', generatorConfig.androidkeystorename);
		antProperties.set('key.alias', generatorConfig.androidkeyaliasname);

		var keystorePassword = process.env.KEYSTORE_PASSWORD;
		var keyPassword = process.env.KEY_PASSWORD;
		var cliOptions = utils.getCommandLineOptions();
		if (cliOptions.storepass)
			keystorePassword = cliOptions.storepass;
		if (cliOptions.keypass)
			keyPassword = cliOptions.keypass;

		antProperties.set('key.store.password', keystorePassword);
		antProperties.set('key.alias.password', keyPassword);

		antProperties.save(path.join(generatorConfig.cordovaDirectory, '/platforms/android/ant.properties'));
	}

	return spawn('ant', [utils.getBuildType(), '-Dout.dir=ant-build', '-Dgen.absolute.dir=ant-gen'], {
		printCommand: true,
		stdio: 'inherit',
		cwd: path.join(generatorConfig.cordovaDirectory, '/platforms/android')
	}).then(
		function() {
			var stream = gulp.src(path.join(generatorConfig.cordovaDirectory, '/platforms/android/ant-build/CordovaApp-' + utils.getBuildType() + '.apk'))
				.pipe(gulp.dest('apk'));
			return utils.streamToPromise(stream);
		}
	).then(
		null,

		function(e) {
			console.log("error ", e, e.stack)
		}
	)
}


function mfpRun(platform) {
	console.log(chalk.cyan('Deploying and running app...'));

	if (platform == 'ios') {
		if (utils.getCommandLineOptions().device) {
			// Special case deploying to an iOS device.  We pass the -L switch to ios-deploy so that
			// lldb will exit after it launches the app.  If we don't do this, we can get zombie
			// lldbs running in the background, or the terminal detached from gulp such that
			// CTRL-C doesn't work, which requires killall from another window to kill them.
			return spawn('ios-deploy', ['-L', '-b', path.join(utils.getGeneratorConfig().cordovaDirectory, 'platforms/ios/build/device', utils.getGeneratorConfig().cordovaProjectName) + ".app"], {
				printCommand: true,
				stdio: 'inherit'
			});
		} else {
			// Special case deploying to the iOS emulator.  cordova/run for *iOS* doesn't support a --nobuild option.
			return spawn('ios-sim', ['launch', path.join(utils.getGeneratorConfig().cordovaDirectory, 'platforms/ios/build/emulator', utils.getGeneratorConfig().cordovaProjectName) + ".app",
				'--devicetypeid', 'com.apple.CoreSimulator.SimDeviceType.iPhone-6',
				'--exit'], {
				printCommand: true,
				stdio: 'inherit'
			});
		}
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


function buildMFPIOSWithPrepare() {
	return runPrepare().then(buildMFPIOS);
}


function buildMFPIOSForSimulator() {
	var generatorConfig = utils.getGeneratorConfig();

	var archivePath = path.join('build/' + generatorConfig.cordovaProjectName + '.xcarchive');

	var buildType = utils.getBuildType() == 'debug' ? 'Debug' : 'Release';

	var envConfig = utils.getEnvConfig();

	// Get the provisioning profile from the config.
	var provisioningProfile = envConfig.appConfig.provisioningProfile;
	// Allow the user to override it via CLI.
	if (utils.getCommandLineOptions().profile)
		provisioningProfile = utils.getCommandLineOptions().profile;

	var args = [
		'-scheme', generatorConfig.cordovaProjectName,
		'-configuration', buildType,
		'-project', generatorConfig.cordovaProjectName + '.xcodeproj',
		'CONFIGURATION_BUILD_DIR=' + path.resolve(generatorConfig.cordovaDirectory, 'platforms/ios/build/emulator'),
		'SHARED_PRECOMPS_DIR=' + path.resolve(generatorConfig.cordovaDirectory, 'platforms/ios/build/sharedpch'),
		'-arch', 'i386',
		'VALID_ARCHS=i386',
		'-sdk', 'iphonesimulator',
		'build'
	];

	return spawn('xcodebuild', args, {
		printCommand: true,
		stdio: 'inherit',
		cwd: path.join(generatorConfig.cordovaDirectory, 'platforms/ios')
	}).then(
		null,

		function(err) {
			console.log("error ", err, err.stack);
			throw err;
		}
	);
}


function buildMFPIOS() {
	var generatorConfig = utils.getGeneratorConfig();
	var envConfig = utils.getEnvConfig();

	if ("bundleId" in envConfig.appConfig)
		setBundleId(generatorConfig.cordovaDirectory, generatorConfig.cordovaProjectName, envConfig.appConfig.bundleId);

	if (!utils.getCommandLineOptions().device)
		return buildMFPIOSForSimulator();

	var archivePath = path.join('build/' + generatorConfig.cordovaProjectName + '.xcarchive');

	var buildType = utils.getBuildType() == 'debug' ? 'Debug' : 'Release';

	var args = [
		'-scheme', generatorConfig.cordovaProjectName,
		'-archivePath', archivePath,
		'-configuration', buildType,
		'-project', generatorConfig.cordovaProjectName + '.xcodeproj',
		'archive'
	];

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
	}

	args.push('CODE_SIGN_IDENTITY=' + 'iPhone Developer');
	args.push('DEVELOPMENT_TEAM=' + envConfig.appConfig.developmentTeam);

	return spawn('xcodebuild', args, {
		printCommand: true,
		stdio: 'inherit',
		cwd: path.join(generatorConfig.cordovaDirectory, '/platforms/ios')
	}).then(
		function() {
			del.sync(path.join(generatorConfig.cordovaDirectory, '/platforms/ios/build', generatorConfig.cordovaProjectName + '-' + utils.getBuildType() + '.ipa'));

			var args = [
				'-exportArchive', '-exportFormat', 'IPA',
				'-archivePath', archivePath,
				'-exportPath', path.join('build', generatorConfig.cordovaProjectName + '-' + utils.getBuildType() + '.ipa'),
				'-configuration', buildType
			];

			if (provisioningProfile)
                args.push('-exportProvisioningProfile', provisioningProfile);

			return spawn('xcodebuild', args, {
				printCommand: true,
				stdio: 'inherit',
				cwd: path.join(generatorConfig.cordovaDirectory, '/platforms/ios')
			});
		}
	).then(
		function() {
			try {
				fs.mkdirSync(path.join(generatorConfig.cordovaDirectory, '/platforms/ios/build/device'));
			} catch (err) {
				if (err.code != 'EEXIST')
					throw err;
			}

			del.sync(path.join(generatorConfig.cordovaDirectory, '/platforms/ios/build/device', generatorConfig.cordovaProjectName + '.app'));

			var args = [
				'-exportArchive', '-exportFormat', 'APP',
				'-archivePath', archivePath,
				'-exportPath', path.join('build/device/', generatorConfig.cordovaProjectName + '.app'),
				'-configuration', buildType
			];

			if (provisioningProfile)
                args.push('-exportProvisioningProfile', provisioningProfile);

			return spawn('xcodebuild', args, {
				printCommand: true,
				stdio: 'inherit',
				cwd: path.join(generatorConfig.cordovaDirectory, '/platforms/ios')
			});
		}
	).then(
		function() {
			var stream = gulp.src(path.join(generatorConfig.cordovaDirectory, '/platforms/ios/build/', generatorConfig.cordovaProjectName + '-' + utils.getBuildType() + '.ipa'))
				.pipe(gulp.dest('ipa'));
			return utils.streamToPromise(stream);
		}
	).then(
		null,

		function(e) {
			console.log("error ", e, e.stack)
		}
	);
}


function compileApp(platform) {
	console.log(chalk.cyan('Building the app...'));
	if (platform == 'android')
		return buildMFPAndroid();
	else
		return buildMFPIOS();
}


function withMFPBuildPrimitives(platform) {
	if (platform == 'ios')
		this.buildApp = buildMFPIOSWithPrepare;
	else
		this.buildApp = buildMFPAndroidWithPrepare;
	this.runPrepare = runPrepare;
	this.runApp = mfpRun;
	this.compileApp = compileApp;
	this.platformType = 'mfp';
}

module.exports = withMFPBuildPrimitives;
