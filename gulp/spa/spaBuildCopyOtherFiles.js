/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var utils = require('../utils');
var $ = require('gulp-load-plugins')();


function spaBuildCopyOtherFiles() {
	var fileFilter = $.filter(function(file) {
		return file.stat.isFile();
	});

	var stream = gulp.src([
		path.join(conf.paths.src, '/**/*'),
		path.join('!' + conf.paths.src, '/**/*.{html,css,js,scss,jpg,png,gif,svg}')
	])
		.pipe(fileFilter)
		.pipe(gulp.dest(path.join(this.distDir, '/')));

	return utils.streamToPromise(stream);
}


module.exports = spaBuildCopyOtherFiles;
