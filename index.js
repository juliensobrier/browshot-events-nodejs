'use strict';

const browshot = require('browshot');
const events = require('events');


var defaults = {
	timeout: 60 * 5,
	interval: 1,
};

var client;


function info(/**/) {
	var args = Array.prototype.slice.call(arguments);

	if (client.debug) {
		console.log(args.join(''));
	};
}


/**
 * This is an event-driven version of the brwoshot Node.js library. This module shoul make it easier to use the asynchronous API.
 * This module gives access to the underlying browshot modules through this.browshot.
 * 
 * The source code is available on github at https://github.com/juliensobrier/browshot-nodejs-events.
 * 
 * Constructor for the Nodejs BrowshotEvents client. You can find code samples at http://browshot.com/api/documentation
 * @link http://browshot.com/api/documentation
 * @param  {String}   key   Your API key. Required.
 * @param  {Boolean}  debug Turn on debugging messages. optional
 */
function BrowshotEvents(key, debug = false) {
	this.browshot = new browshot(key, debug);
	
	client = this.browshot;
}

/**
 * Change the default settings:
 * timeout: number of seconds before giving up
 * interval: number of seconds to wait before calling screenshotInfo
 * @param  {Object}   args   List of new setting values
 */
BrowshotEvents.prototype.setDefaults = function(args) {
	defaults = Object.assign(defaults, args);
}


/**
 * Request a screenshot. Fires the following events:
 *   in_queue: the screenshot was added to the queue
 *   in_process: the screenshot is being processed
 *   finished: the screenshot is finished
 *   failed: the screenshot failed
 *   timeout: the screenshot took too long to finish based on the default timeout
 * @link http://browshot.com/api/documentation#screenshot_create
 * @param  {Object}   args   List of screenshots details
 */
BrowshotEvents.prototype.screenshotCreate =  function(args = { }) {
	var eventEmitter = new events.EventEmitter();
	
	var start = new Date();
	
	function checkStatus(id) {
// 	console.log(`Checking status for screenshot ${id}`);
		
		client.screenshotInfo(id, { details: args.details || 0 }, function(screenshot) {
			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);
			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				eventEmitter.removeAllListeners();
			}	
			else if (checkTimeout(screenshot)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, defaults.interval * 1000, screenshot.id);
			}
		});
	}
	
	function checkTimeout(screenshot) {
		var now = new Date();
			
		var elapsed = now - start; //in ms
		if (elapsed >= defaults.timeout * 1000) {
			eventEmitter.emit('timeout', screenshot);
			eventEmitter.removeAllListeners();
			
			return true;
		}
		
		return false;
	}
	
	client.screenshotCreate(args, (screenshot) => {
		if (screenshot.status == 'error')
			eventEmitter.emit('failed', screenshot);
		else
			eventEmitter.emit(screenshot.status, screenshot);
		
		if (screenshot.status == 'finished' || screenshot.status == 'error') {
			eventEmitter.removeAllListeners();
		}
		else if (checkTimeout(screenshot)) {
			// nothing to do
		}
		else {
			// Keep checking
			setTimeout(checkStatus, defaults.interval * 1000, screenshot.id);
		}
	});
	
	return eventEmitter;
}

/**
 * Request multiple screenshots. This function makes multiple call to screenshot/create and does not use screenshot/multiple. 
 * This means it is not subject to the limitations of screenshot/multiple: more than 1 URLs is possible, all screenshots can have different settings, etc.
 * Fires the following events:
 *   in_queue: a screenshot was added to the queue
 *   in_process: a screenshot is being processed
 *   finished: a screenshot is finished
 *   failed: a screenshot failed
 *   timeout: at least one screenshot took too long to finish based on the default timeout (fired once)
 *   complete: all screenshots are done (finished, failed or timeout)  (fired once)
 * @link http://browshot.com/api/documentation#screenshot_create
 * @param  {Array}   args   List of screenshots requests
 * @param  {Object}  common Common properties of all screenshot requests
 */
BrowshotEvents.prototype.screenshotCreateMultiple =  function(args = [], common = { }) {
	var eventEmitter = new events.EventEmitter();
	var start = new Date();
	var screenshots = [];
	
	var details = common.details || 0;
	
	// Make list of screenshos requests
	args.forEach((request) => {
		request = Object.assign(Object.assign({}, common), request);
		
		if (request.details && request.details > details) {
				details = request.details;
		}
		
		client.screenshotCreate(request, (screenshot) => {
			screenshots.push(screenshot);
			
			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);
			
// 			for(var i in screenshots) {
// 				if (screenshots[i].id == screenshot.id) {
// 						screenshots[i] = Object.assign(screenshots[i], screenshot);
// 						screenshots[i] = Object.assign(screenshots[i], { alerted: screenshot.status });
// 				}
// 			}
			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				checkCompleted();
			}
			else if (checkTimeout(screenshot)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, defaults.interval * 1000, screenshot.id);
			}
		});
	});
	
	function checkStatus(id) {		
		client.screenshotInfo(id, { details: details }, function(screenshot) {
			for(var i in screenshots) {
				if (screenshots[i].id == screenshot.id) {
						screenshots[i] = Object.assign(screenshots[i], screenshot);
				}
			}
			
			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);
			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				checkCompleted();
			}	
			else if (checkTimeout(screenshot)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, defaults.interval * 1000, screenshot.id);
			}
		});
	}
	
	function checkCompleted() {
		var complete = true;
		
		screenshots.forEach((screenshot) => {
			if (screenshot.status != "finished" &&  screenshot.status != "error") {
					complete = false;
					info(`Screenshot ${screenshot.id} is not finished: ${screenshot.status} `); 
			}
		});
		
		if (complete) {
// 			console.log(`Number of requests: ${screenshots.length} / ${args.length}`);
// 			
// 			// make sure an alert was sent for all of them
// 			for(var i in screenshots) {
// 				if (! screenshots[i].alerted || (screenshots[i].alerted != 'finished' && screenshots[i].alerted != 'error')) {
// 					console.log("Missing notification for screenshot " + screenshots[i].id);
// 					
// 					if (screenshots[i].status == 'error')
// 						eventEmitter.emit('failed', screenshots[i]);
// 					else
// 						eventEmitter.emit(screenshot.status, screenshots[i]);
// 					}
// 			}
			
			// required if all screenshots already in cache
			if (screenshots.length == args.length) {
				eventEmitter.emit('complete', screenshots);
				info("All screenshots are complete");
				eventEmitter.removeAllListeners();
			}
		}
		
		return complete;
	}
	
	function checkTimeout(screenshot) {
		var now = new Date();
			
		var elapsed = now - start; //in ms
		if (elapsed >= defaults.timeout * 1000) {
			eventEmitter.emit('timeout', screenshots);
			eventEmitter.removeAllListeners();
			
			return true;
		}
		
		return false;
	}
	
	
	
	return eventEmitter;
}

/**
 * Retrieve the screenshot, or a thumbnail, and save it to a file.
 * @link http://browshot.com/api/documentation#thumbnails
 * @param  {Number}   id          Screenshot ID. Required. 
 * @param  {String}   file        Local file name to write the thumbnail to. Required. 
 * @param  {Object}   args        arguments. Optional.
 * @return {Object}   Return a Promise with the file name as argument.
 */
BrowshotEvents.prototype.saveThumbnail = function(id = 0, file = '', args = { }, resolve, reject) {
	return new Promise(function(resolve, reject){
		client.screenshotThumbnailFile(id, file, args, function(newFile) {
			if (newFile == '') {
				reject(file);
			}
			else {
					resolve(newFile);
			}
		});
	});	
}

/**
 * Retrieve the screenshot or a thumbnail
 * @link http://browshot.com/api/documentation#thumbnails
 * @param  {Number}   id          Screenshot ID. Required. 
 * @param  {Object}   args        arguments. Optional.
 * @return {Object}   Return a Promise with the image as argument.
 */
BrowshotEvents.prototype.screenshotThumbnail = function(id = 0, args = { }, resolve, reject) {
	return new Promise(function(resolve, reject){
		client.screenshotThumbnail(id, args, function(image) {
			if (image == '') {
				reject(image);
			}
			else {
					resolve(image);
			}
		});
	});	
}





module.exports = BrowshotEvents;