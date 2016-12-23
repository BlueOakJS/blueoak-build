/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var conf = require('../conf');
var browserSync = require('browser-sync');
var browserSyncSpa = require('browser-sync-spa');
var devIp = require("dev-ip");

var bsInstance;

function browserSyncInit() {
	return this.clean().then(this.build.bind(this)).then(
		function() {
			this.watch();

			var server = {
				baseDir: this.distDir,
				routes: null
			};

			bsInstance = browserSync.create('spa');
			bsInstance.init({
				startPath: '/',
				server: server,
				online: devIp().length != 0
			});

			bsInstance.use(browserSyncSpa({
				selector: '[ng-app]'// Only needed for angular apps
			}));
		}.bind(this)
	);
}


function afterSPABuildComplete() {
	if (bsInstance)
		bsInstance.reload();
}


function withSPABrowserSync() {
	this.startBrowserSync = browserSyncInit;
	this.afterSPABuildComplete = afterSPABuildComplete;
}

module.exports = withSPABrowserSync;
