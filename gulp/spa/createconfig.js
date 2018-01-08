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


function createconfig(platformType) {
	var selectedConfig = utils.getEnvConfig();

	selectedConfig.appConfig.platformType = platformType;
	var stream = $.ngConstant({
			templatePath: path.join(__dirname, '../../templates/app.config.ejs'),
			constants: selectedConfig,
			stream: true
		})
		.pipe(gulp.dest(path.join(conf.paths.src, 'generated')));

	return utils.streamToPromise(stream);
}

exports.createconfig = createconfig;
