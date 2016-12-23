/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var $ = require('gulp-load-plugins')();
var utils = require('../utils');


function scripts() {
	var stream = gulp.src([
			path.join(conf.paths.src, '/app/**/*.js')
		])
		// eslint() attaches the lint output to the eslint property
		// of the file object so it can be used by other modules.
		.pipe($.eslint())
		// eslint.format() outputs the lint results to the console.
		.pipe($.eslint.format())
		// size() logs the total size of files in the stream.
		.pipe($.size());

	return utils.streamToPromise(stream);
}

exports.scripts = scripts;
