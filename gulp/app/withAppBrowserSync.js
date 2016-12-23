/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var utils = require('../utils');
var chalk = require('chalk');
var startBrowserSyncForApp = require('./startBrowserSyncForApp');
var cordovaBrowserSync = require('cordova-browsersync-primitives');


function buildSPA() {
	console.log(chalk.cyan('Building the SPA...'));
	return this.build().then(
		function() {
			console.log(chalk.cyan('Turning on the watch...'));
			this.watch();
		}.bind(this)
	);
}


var bsInstance;
function startBrowserSync() {
	this.setDistDir(this.distDirs.platform);

	return startBrowserSyncForApp(this.platform,
									utils.getGeneratorConfig().cordovaDirectory,
									utils.getGeneratorConfig().cordovaProjectName,
									this.runPrepare,
									this.compileApp,
									this.runApp,
									buildSPA.bind(this),
									!utils.getCommandLineOptions().noshell)
	.then(
		function(startBrowserSyncForAppValue) {
			bsInstance = startBrowserSyncForAppValue;
		}
	);
}


function afterSPABuildComplete() {
	cordovaBrowserSync.addCSP(path.join(utils.getGeneratorConfig().cordovaDirectory, cordovaBrowserSync.getWWWFolder(this.platform), 'index.html'));
	bsInstance.reload();
}


function withSPABrowserSync() {
	this.startBrowserSync = startBrowserSync;
	this.afterSPABuildComplete = afterSPABuildComplete;
}

module.exports = withSPABrowserSync;
