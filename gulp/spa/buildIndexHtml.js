/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var rename = require('gulp-rename');
var wiredep = require('wiredep').stream;
var _ = require('lodash');
var $ = require('gulp-load-plugins')();

function buildIndexHtml(stylesStream, distdir, platformFilesToInject) {
	var scriptFiles = [
		path.join(conf.paths.src, '/app/index.module.js'),
		path.join(conf.paths.src, '/app/**/*.module.js'),
		path.join(conf.paths.src, '/**/*.js'),
		path.join('!' + conf.paths.src, '/app/**/*.spec.js'),
		path.join('!' + conf.paths.src, '/assets/**/*.js')
	];

	var scriptOrder = [
		path.join('index.module.js'),
		path.join('**/*.module.js'),
		path.join('**/*.js')
	];

	var scriptsStream = gulp.src(scriptFiles)
		.pipe($.order(scriptOrder))
		.pipe($.angularFilesort()).on('error', conf.errorHandler('AngularFilesort'));

	var injectOptions = {
		ignorePath: [ conf.paths.src, distdir ],
		addRootSlash: false
	};

	var platformStream = $.file(platformFilesToInject, { src: true });

	return gulp.src(path.join(conf.paths.src, '/*.html'), { base: '.' })
		.pipe($.inject(stylesStream, injectOptions))
		.pipe($.inject(scriptsStream, injectOptions))
		.pipe($.inject(platformStream, { name: 'platformspecific', addRootSlash: false }))
		// Pretend that index.html came from client/ instead of client/src to
		// make the dependencies injected by wiredep have the correct path
		.pipe(rename(function(path) {
			path.dirname = "";
		}))
		.pipe(wiredep(_.extend({}, conf.wiredep)));
}

exports.buildIndexHtml = buildIndexHtml;
