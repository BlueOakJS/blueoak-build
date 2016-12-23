/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var fs = require('fs');
var et = require('elementtree');
var utils = require('../utils');


function setMFPAndroidPush() {
	var envConfig = utils.getEnvConfig();
	var generatorConfig = utils.getGeneratorConfig();

	var androidPushKey = envConfig.appConfig.androidPushKey;
	var androidPushSenderId = envConfig.appConfig.androidPushSenderId;

	if (!androidPushKey || !androidPushSenderId)
		return;

	// Add the password to application-descriptor.xml
	var applicationDescriptorFilename = path.join(generatorConfig.cordovaDirectory, 'application-descriptor.xml');
	var appDescriptorXml = new et.ElementTree(et.XML(fs.readFileSync(applicationDescriptorFilename, "utf-8").replace(/^\uFEFF/, "")));

	var pushSenderTag = appDescriptorXml.find('android/pushSender');
	if (!pushSenderTag)
		pushSenderTag = et.SubElement(appDescriptorXml.find('android'), 'pushSender');

	pushSenderTag.set('key', androidPushKey);
	pushSenderTag.set('senderId', androidPushSenderId);

	fs.writeFileSync(applicationDescriptorFilename, appDescriptorXml.write({
		indent: 4
	}), "utf-8");
}


module.exports = setMFPAndroidPush;
