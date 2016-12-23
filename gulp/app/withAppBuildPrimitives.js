/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var utils = require('../utils');
var cordovaBrowserSync = require('cordova-browsersync-primitives');
var withSPABuildPrimitives = require('../spa/withSPABuildPrimitives');
var withMFPBuildPrimitives = require('./withMFPBuildPrimitives');
var withCordovaBuildPrimitives = require('./withCordovaBuildPrimitives');
var chalk = require('chalk');


function errorIfNotCordovaOrMFPProject() {
	if (utils.getGeneratorConfig().appType != utils.appTypeChoices.cordova &&
		utils.getGeneratorConfig().appType != utils.appTypeChoices.mfp) {
		console.log(chalk.red.bold('This project is not configured to build apps.'));
		throw new Error('This project is not configured to build apps.');
	}
}


function withAppBuildPrimitives(platform) {
	errorIfNotCordovaOrMFPProject();

	if (platform == 'ios' && !utils.getGeneratorConfig().isCordovaIOS) {
		console.log(chalk.red.bold('The iOS environment hasn\'t been added to the project.'));
		throw new Error('The iOS environment hasn\'t been added to the project.');
	}
	if (platform == 'android' && !utils.getGeneratorConfig().isCordovaAndroid) {
		console.log(chalk.red.bold('The Android environment hasn\'t been added to the project.'));
		throw new Error('The Android environment hasn\'t been added to the project.');
	}

	withSPABuildPrimitives.call(this);

	this.platform = platform;
	if (!this.distDirs)
		this.distDirs = {};
	this.distDirs.app = path.join(utils.getGeneratorConfig().cordovaDirectory, 'www');
	this.distDirs.platform = path.join(utils.getGeneratorConfig().cordovaDirectory, cordovaBrowserSync.getWWWFolder(platform));
	this.setDistDir(this.distDirs.app);
	this.platformFilesToInject = [{
		name: 'cordova.js',
		source: ''
	}];

	if (utils.getGeneratorConfig().appType == utils.appTypeChoices.cordova) {
		withCordovaBuildPrimitives.call(this, platform);
	} else if (utils.getGeneratorConfig().appType == utils.appTypeChoices.mfp) {
		withMFPBuildPrimitives.call(this, platform);
	}
}

module.exports = withAppBuildPrimitives;
