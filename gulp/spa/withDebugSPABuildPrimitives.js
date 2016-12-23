/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var rename = require("gulp-rename");
var wiredep = require('wiredep').stream;
var Q = require('q');
var _ = require('lodash');
var utils = require('../utils');
var swagger = require('./swagger');
var createconfig = require('./createconfig');
var scripts = require('./scripts');
var styles = require('./styles');
var buildIndexHtml = require('./buildIndexHtml');
var spaBuildCopyOtherFiles = require('./spaBuildCopyOtherFiles');


var $ = require('gulp-load-plugins')({
	pattern: ['gulp-*', 'main-bower-files', 'uglify-save-license', 'del']
});


function stylesNoMin() {
	return styles.compileSass(false)
		.pipe($.cssUseref({ pathTransform: function(newAssetFile, cssFilePathRel, urlMatch, options) {
			// Anything that gets pulled in from bower has ../bower_components on the front of it.
			// Remove that .., so that all files get put into the dist dir.
			var pathComponents = newAssetFile.split(path.sep);
			if (pathComponents[0] == '..')
				return path.join.apply(path, pathComponents.slice(1));
			else
				return newAssetFile;
		}}))
		.pipe(gulp.dest(this.distDir));
}


function htmlNoMin() {
	var swaggerPromise = swagger.generateSwagger();
	var createConfigPromise = createconfig.createconfig(this.platformType);
	var scriptsPromise = scripts.scripts();

	return Q.all([swaggerPromise, createConfigPromise, scriptsPromise]).then(
		function() {
			var stream = buildIndexHtml.buildIndexHtml(this._stylesNoMin(), this.distDir, this.platformFilesToInject)
				.pipe($.useref({ noconcat: true	}))
				.pipe($.cssUseref({ pathTransform: function(newAssetFile, cssFilePathRel, urlMatch, options) {
					// This case covers any assets specified in CSS files referenced through bower main.
					// According to the bower spec, this is deprecated.
					// Add bower_components/foo back to the generated path.
					var pathComponents = cssFilePathRel.split(path.sep);
					return path.join(pathComponents[0], pathComponents[1], newAssetFile);
				}}))
				.pipe(rename(function(filename) {
					var dirArray = filename.dirname.split(path.sep);
					if (dirArray[0] == 'src')
						filename.dirname = dirArray.slice(1).join(path.sep);
				}))
				.pipe(gulp.dest(this.distDir));

			return utils.streamToPromise(stream);
		}.bind(this)
	);
}


function copyPartials() {
	return gulp.src(path.join(conf.paths.src, '/app/**/*.html'), { base: 'src' })
		.pipe(gulp.dest(this.distDir));
}


function copyImages() {
	return gulp.src(path.join(conf.paths.src, '/assets/images/**/*'))
		.pipe(gulp.dest(path.join(this.distDir, '/assets/images/')));
}


function build() {
	var htmlPromise = this._htmlNoMin();
	var partialsPromise = this._copyPartials();
	var imagesPromise = this._copyImages();
	var otherPromise = this._spaBuildCopyOtherFiles();

	return Q.all([htmlPromise, partialsPromise, imagesPromise, otherPromise]);
}

////////////

function isOnlyChange(event) {
	return event.type === 'changed';
}

function copyFile(filename) {
	var stream = gulp.src(filename, { base: 'src' })
		.pipe(gulp.dest(this.distDir))
		.pipe($.size({ title: this.distDir, showFiles: true }));

	utils.streamToPromise(stream).then(
		function() {
			return this.afterSPABuildComplete();
		}.bind(this)
	);
}


function rebuildHTML() {
	return this._htmlNoMin().then(this.afterSPABuildComplete.bind(this));
}


function rebuildSass() {
	return utils.streamToPromise(this._stylesNoMin()).then(this.afterSPABuildComplete.bind(this));
}


function watch() {
	gulp.watch(['bower.json', path.join(conf.paths.src, '/*.html')], rebuildHTML.bind(this));

	gulp.watch(path.join(conf.paths.src, '/**/*.scss'), rebuildSass.bind(this));

	gulp.watch([
		path.join(conf.paths.src, '/app/**/*.css'),
		path.join(conf.paths.src, '/app/**/*.js'),
		path.join(conf.paths.src, '/generated/**/*.js')
	], function(event) {
		if (isOnlyChange(event)) {
			this._copyFile(event.path);
		} else {
			this._rebuildHTML();
		}
	}.bind(this));

	gulp.watch(path.join(conf.paths.src, 'app.config.json'), function(event) {
		createconfig.createconfig();
	});

	gulp.watch(path.join('../common/swagger/**'), function(event) {
		swagger.generateSwagger();
	});

	gulp.watch([
		path.join(conf.paths.src, '/**/*'),
		path.join('!' + conf.paths.src, '/**/*.{html,css,js,scss,jpg,png,gif,svg}'),
		path.join(conf.paths.src, '/app/**/*.html'),
		path.join(conf.paths.src, '/assets/images/**/*')
	], function(event) {
		this._copyFile(event.path);
	}.bind(this));
};

///////

function withDebugSPABuildPrimitives() {
	this._stylesNoMin = stylesNoMin;
	this._htmlNoMin = htmlNoMin;
	this._copyPartials = copyPartials;
	this._copyImages = copyImages;
	this._spaBuildCopyOtherFiles = spaBuildCopyOtherFiles;
	this._copyFile = copyFile;
	this._rebuildHTML = rebuildHTML;

	this.build = build;
	this.watch = watch;
}

module.exports = withDebugSPABuildPrimitives;
