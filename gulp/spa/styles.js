/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var utils = require('../utils');
var $ = require('gulp-load-plugins')({
	pattern: ['gulp-*', 'main-bower-files']
});


function compileSass(minify) {
	var sassOptions = {
		style: 'expanded'
	};

	var injectFileName = $.mainBowerFiles('**/*.scss').concat(
		path.join(conf.paths.src, '/**/*.scss'),
		path.join('!' + conf.paths.src, '/app/index.scss')
	);

	var sortFileNames = [ path.join('../bower_components/**/*.scss'),
		// Make sure the SASS files in /assets are included first
		path.join('assets/scss/**/*.scss'),
		path.join('**/*.scss')
	];

	var injectFiles = gulp.src(injectFileName, { base: conf.paths.src, read: false })
		.pipe($.order(sortFileNames));

	var injectOptions = {
		transform: function(filePath) {
			filePath = filePath.replace(conf.paths.src + '/app/', '');
			return '@import "' + filePath + '";';
		},
		starttag: '// injector',
		endtag: '// endinjector',
		addRootSlash: false
	};

	return gulp.src([ path.join(conf.paths.src, '/app/index.scss') ], { base: conf.paths.src })
		.pipe($.inject(injectFiles, injectOptions))
		.pipe($.sourcemaps.init())
		.pipe($.sass(sassOptions)).on('error', conf.errorHandler('Sass'))
		.pipe($.rename('styles/app.css'))
		.pipe($.autoprefixer(utils.getGeneratorConfig().autoprefixerConfig)).on('error', conf.errorHandler('Autoprefixer'))
		.pipe($.sourcemaps.write());
};


exports.compileSass = compileSass;
