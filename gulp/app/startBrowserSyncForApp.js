/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var fs = require('fs');
var path = require('path');
var del = require('del');
var Q = require('q');
var cordovaBrowserSync = require('cordova-browsersync-primitives');
var devIp = require("dev-ip");


function buildShellAppAndStartBrowserSync(platform, cordovaDir, projectName, runPrepare, buildApp, deployAndRunApp, buildSPA) {
	var bsInstance;

	var delPromise;
	delPromise = del(path.join(cordovaDir, 'www'));

	var browserSyncPromise = Q.nfcall(cordovaBrowserSync.startBrowserSync, cordovaDir, [platform], {
		online: devIp().length != 0
	});

	return Q.all([delPromise, browserSyncPromise]).spread(
		function(delValue, browserSyncValue) {
			bsInstance = browserSyncValue.bsInstance;
			fs.mkdirSync(path.join(cordovaDir, 'www'));
			cordovaBrowserSync.createIndexHtml(browserSyncValue.servers, platform, cordovaDir);
			return runPrepare(platform);
		}
	).then(
		function() {
			if (platform == 'ios')
				cordovaBrowserSync.fixATS(cordovaDir, projectName);

            cordovaBrowserSync.updateConfigXml(cordovaDir, platform, projectName, 'index.html');

			var buildAppPromise = buildApp(platform);
			var buildDeployAndRunAppPromise = buildAppPromise.then(
				function() {
					return deployAndRunApp(platform);
				}
			);

			var buildSPAPromise = buildAppPromise.then(
				function() {
					return buildSPA();
				}
			).then(
				function() {
					cordovaBrowserSync.addCSP(path.join(cordovaDir, cordovaBrowserSync.getWWWFolder(platform), 'index.html'));
				}
			);

			return Q.all([buildSPAPromise, buildDeployAndRunAppPromise]);
		}
	).then(
		function() {
			bsInstance.reload();
			return bsInstance;
		}
	).then(
		null,

		function(e) {
			console.log("error ", e, e.stack)
		}
	);
}


function buildSPAAndStartBrowserSync(platform, cordovaDir, runPrepare, buildSPA) {
	var bsInstance;

	var delPromise;
	delPromise = del(path.join(cordovaDir, 'www'));

	var browserSyncPromise = Q.nfcall(cordovaBrowserSync.startBrowserSync, cordovaDir, [platform], {
		online: devIp().length != 0
	});

	return Q.all([delPromise, browserSyncPromise]).spread(
		function(delValue, browserSyncValue) {
			bsInstance = browserSyncValue.bsInstance;
			fs.mkdirSync(path.join(cordovaDir, 'www'));
			return runPrepare(platform);
		}
	).then(
		function() {
			return buildSPA();
		}
	).then(
		function() {
			cordovaBrowserSync.addCSP(path.join(cordovaDir, cordovaBrowserSync.getWWWFolder(platform), 'index.html'));
			bsInstance.reload();
			return bsInstance;
		}
	).then(
		null,

		function(e) {
			console.log("error ", e, e.stack)
		}
	);
}


function startBrowserSync(platform, cordovaDir, projectName, runPrepare, buildApp, deployAndRunApp, buildSPA, buildShell) {
	// Only rebuild the shell app if requested.
	if (buildShell)
		return buildShellAppAndStartBrowserSync(platform, cordovaDir, projectName, runPrepare, buildApp, deployAndRunApp, buildSPA);
	else
		return buildSPAAndStartBrowserSync(platform, cordovaDir, runPrepare, buildSPA);
}




module.exports = startBrowserSync;
