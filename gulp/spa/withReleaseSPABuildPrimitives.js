/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gulp = require('gulp');
var conf = require('../conf');
var utils = require('../utils');
var Q = require('q');
var rename = require('gulp-rename');
var styles = require('./styles');
var buildIndexHtml = require('./buildIndexHtml');
var wiredep = require('wiredep').stream;
var _ = require('lodash');
var swagger = require('./swagger');
var createconfig = require('./createconfig');
var scripts = require('./scripts');
var spaBuildCopyOtherFiles = require('./spaBuildCopyOtherFiles');
var PassThrough = require("stream").PassThrough;

var $ = require('gulp-load-plugins')({
	pattern: ['gulp-*', 'main-bower-files', 'uglify-save-license', 'del']
});


function partials() {
	var stream = gulp.src([
		path.join(conf.paths.src, '/app/**/*.html')
	])
		.pipe($.minifyHtml({
			empty: true,
			spare: true,
			quotes: true
		}))
		.pipe($.angularTemplatecache('templateCacheHtml.js', {
			module: 'app',
			root: 'app'
		}))
		.pipe(gulp.dest(path.join(conf.paths.src, 'generated')));

	return utils.streamToPromise(stream);
}


function stylesMin() {
	var cssFilter = $.filter('**/*.css', { restore: true });

	return styles.compileSass(true)
		.pipe($.cssUseref({ pathTransform: function(newAssetFile, cssFilePathRel, urlMatch, options) {
			// Anything that gets pulled in from bower has ../bower_components on the front of it.
			// Remove that .., so that all files get put into the dist dir.
			var pathComponents = newAssetFile.split(path.sep);
			if (pathComponents[0] == '..')
				return path.join.apply(path, pathComponents.slice(1));
			else
				return newAssetFile;
		}}))
		.pipe(cssFilter)
		.pipe($.rev())
		.pipe($.sourcemaps.init())
		.pipe($.minifyCss({ processImport: false }))
		.pipe($.sourcemaps.write('maps'))
		.pipe($.revReplace())
		.pipe(cssFilter.restore)
		.pipe(gulp.dest(this.distDir))
		.pipe($.size({ title: this.distDir, showFiles: true }));
}


function html() {
	var swaggerPromise = swagger.generateSwagger();
	var createConfigPromise = createconfig.createconfig(this.platformType);
	var scriptsPromise = scripts.scripts();
	var partialsPromise = this._partials();

	return Q.all([swaggerPromise, createConfigPromise, scriptsPromise, partialsPromise]).spread(
		function() {
			var injectStream = buildIndexHtml.buildIndexHtml(this._stylesMin(), this.distDir, this.platformFilesToInject);

			var htmlFilter = $.filter('*.html', { restore: true });
			var uglifyFilter = $.filter(['**/*.js', '!**/vendor-*.js'], { restore: true });
			var cssFilter = $.filter('**/*.css', { restore: true });
			var notIndexHtmlFilter = $.filter(['**/*', '!**/index.html'], { restore: true });

			var stream = injectStream
				.pipe($.useref({}, function(name) {
					if (path.basename(name) == 'vendor.css')
						return $.concatCss(name);
					else
						return new PassThrough({ objectMode: true });
				}))
				.pipe(notIndexHtmlFilter)
				.pipe($.rev())
				.pipe(notIndexHtmlFilter.restore)
				.pipe($.cssUseref())
				.pipe(uglifyFilter)
				.pipe($.sourcemaps.init())
				.pipe($.uglify({ preserveComments: $.uglifySaveLicense })).on('error', conf.errorHandler('Uglify'))
				.pipe($.sourcemaps.write('maps'))
				.pipe(uglifyFilter.restore)
				.pipe(cssFilter)
				.pipe($.sourcemaps.init())
				.pipe($.minifyCss({ processImport: false }))
				.pipe($.sourcemaps.write('maps'))
				.pipe(cssFilter.restore)
				.pipe($.revReplace())
				.pipe(htmlFilter)
				.pipe($.minifyHtml({
					empty: true,
					spare: true,
					quotes: true,
					conditionals: true
				}))
				.pipe(htmlFilter.restore)
				.pipe(gulp.dest(this.distDir))
				.pipe($.size({ title: this.distDir, showFiles: true }));

			return utils.streamToPromise(stream);
		}.bind(this)
	);
}


function images() {
	var stream = gulp.src(path.join(conf.paths.src, '/assets/images/**/*'))
		.pipe($.imagemin({
			optimizationLevel: 3,
			progressive: true,
			interlaced: true
		}))
		.pipe(gulp.dest(path.join(this.distDir, '/assets/images/')));

	return utils.streamToPromise(stream);
}


function build() {
	var htmlPromise = this._html();
	var imagesPromise = this._images();
	var otherPromise = this._spaBuildCopyOtherFiles();

	return Q.all([htmlPromise, imagesPromise, otherPromise]);
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
	return this._html().then(this.afterSPABuildComplete.bind(this));
}


function rebuildSass() {
	return utils.streamToPromise(this._stylesMin()).then(this.afterSPABuildComplete.bind(this));
}


function watch() {
	gulp.watch([
		'bower.json',
		path.join(conf.paths.src, '/*.html'),
		path.join(conf.paths.src, '/app/**/*.html'),
		path.join(conf.paths.src, '/app/**/*.js')
	], rebuildHTML.bind(this));

	gulp.watch(path.join(conf.paths.src, '/**/*.scss'), rebuildSass.bind(this));

	gulp.watch(path.join(conf.paths.src, '/app/**/*.css'), function(event) {
		if (isOnlyChange(event)) {
			this._copyFile(event.path);
		} else {
			this._rebuildHTML();
		}
	}.bind(this));

	gulp.watch(path.join(conf.paths.src, 'app.config.json'), function(event) {
		createconfig.createconfig();
		this._rebuildHTML();
	}.bind(this));

	gulp.watch(path.join('../common/swagger/**'), function(event) {
		swagger.generateSwagger();
	});

	gulp.watch(path.join(conf.paths.src, '/assets/images/**/*'), images.bind(this));

	gulp.watch([
		path.join(conf.paths.src, '/**/*'),
		path.join('!' + conf.paths.src, '/**/*.{html,css,js,scss,jpg,png,gif,svg}')
	], function(event) {
		this._copyFile(event.path);
	}.bind(this));
};

///////


function withReleaseSPABuildPrimitives() {
	this._partials = partials;
	this._stylesMin = stylesMin;
	this._html = html;
	this._rebuildHTML = rebuildHTML;
	this._images = images;
	this._spaBuildCopyOtherFiles = spaBuildCopyOtherFiles;
	this._copyFile = copyFile;

	this.build = build;
	this.watch = watch;
}

module.exports = withReleaseSPABuildPrimitives;
