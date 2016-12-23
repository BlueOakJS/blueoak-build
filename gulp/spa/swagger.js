/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var gulpSwagger = require('./gulp-swagger');
var utils = require('../utils');
var $ = require('gulp-load-plugins')();

var swaggerDir = path.join('../common/swagger');


function generateSwagger(swaggerPath) {
	var swaggerFiles = [ path.join(swaggerDir, '*') ];

	var stream = gulp.src(swaggerFiles, { read: false, base: swaggerDir, nodir: true })
		.pipe($.order(swaggerFiles))
		.pipe(gulpSwagger({
			template: {
				class: fs.readFileSync(path.join(__dirname, 'swagger-templates/angular-class.mustache'), 'utf-8'),
				method: fs.readFileSync(path.join(__dirname, 'swagger-templates/method.mustache'), 'utf-8'),
				request: fs.readFileSync(path.join(__dirname, 'swagger-templates/angular-request.mustache'), 'utf-8')
			}
		}))
		.pipe(gulp.dest(path.join(conf.paths.src, 'generated')));

	return utils.streamToPromise(stream);
}

exports.generateSwagger = generateSwagger;
