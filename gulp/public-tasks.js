/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var gulp = require('gulp');
var utils = require('./utils');
var chalk = require('chalk');
var provisioningProfiles = require('./app/list-provisioning-profiles');
var swagger = require('./spa/swagger');
var createconfig = require('./spa/createconfig');

var withSPABuildPrimitives = require('./spa/withSPABuildPrimitives');
var withSPABrowserSync = require('./spa/withSPABrowserSync');
var withAppBuildPrimitives = require('./app/withAppBuildPrimitives');
var withAppBrowserSync = require('./app/withAppBrowserSync');


function Builder() {
}

Builder.prototype.setDistDir = function(dir) {
	this.distDir = dir;
}

gulp.task('build-spa', function() {
	withSPABuildPrimitives.call(Builder.prototype);
	var builder = new Builder();

	return builder.clean().then(builder.build.bind(builder));
});


gulp.task('serve-spa', function() {
	withSPABuildPrimitives.call(Builder.prototype);
	withSPABrowserSync.call(Builder.prototype);
	var builder = new Builder();

	return builder.startBrowserSync();
});


gulp.task('serve-android', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'android');
	withAppBrowserSync.call(Builder.prototype);
	var builder = new Builder();

	return builder.startBrowserSync();
});


gulp.task('serve-ios', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'ios');
	withAppBrowserSync.call(Builder.prototype);
	var builder = new Builder();

	return builder.startBrowserSync();
});


gulp.task('build-android-nowww', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'android');
	var builder = new Builder();

	return builder.buildApp();
});


gulp.task('build-android', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'android');
	var builder = new Builder();

	return builder.clean().then(builder.build.bind(builder)).then(
		function() {
			return builder.buildApp();
		}
	);
});


gulp.task('build-ios-nowww', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'ios');
	var builder = new Builder();

	return builder.buildApp();
});


gulp.task('build-ios', function() {
	withAppBuildPrimitives.call(Builder.prototype, 'ios');
	var builder = new Builder();

	return builder.clean().then(builder.build.bind(builder)).then(
		function() {
			return builder.buildApp();
		}
	);
});


gulp.task('list-provisioning-profiles', provisioningProfiles.listProvisioningProfiles);

gulp.task('swagger', swagger.generateSwagger);

gulp.task('createconfig', createconfig.createconfig);

gulp.task('clean', function() {
	withSPABuildPrimitives.call(Builder.prototype);
	var builder = new Builder();

	return builder.clean();
});
