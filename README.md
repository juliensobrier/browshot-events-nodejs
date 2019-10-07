browshot-events
================================

Browshot ( https://browshot.com/ ) is a web service to easily make screenshots of web pages in any screen size, as any device: iPhone, iPad, Android, PC, etc. Browshot has full Flash, JavaScript, CSS, & HTML5 support.

The latest API version is detailed at https://browshot.com/api/documentation. This module works on top of the browshot library (https://www.npmjs.com/package/browshot) to provide an event interface. It makes it much easier to follow the stages of a screenshot: in_queue, in_process, finished or failed:

    'use strict';
    var browshot = require('browshot-events');

    var client = new browshot('my_key');
    client.setDefaults({ timeout: 60 * 60, interval: 10 });

    client.screenshotCreate({ 'url': 'https://www.google.com/', 'instance_id': 12 })
	    .once('in_queue', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is in queue`);
	    })
	    .once('in_process', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is in process`);
	    })
	    .on('finished', (screenshot) => {
		     console.log(`Screenshot ${screenshot.id} is finished`);
		
 		     client.saveThumbnail(screenshot.id, 'google.png')
 			    .then((file) => { console.log(`Screenshot saved to ${file}`); })
 			    .catch((file) => { console.log(`Failed to save to ${file}`); });
	    })
	    .on('failed', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} failed`);
	    })
	    .on('timeout', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is taking too long`);
	    });

This module implements only some of the API functions, those that fit the event model. You can access the underlying browshot module with client.browhot.


You can install the library from npm: https://www.npmjs.com/package/browshot-events

The source code can be found on github at https://github.com/juliensobrier/browshot-events-nodejs



INSTALLATION

    npm build && npm install


DEPENDENCIES

The following npm modules are required to run browshot-events

    browshot
    events
