var assert = require('assert');
var BrowshotEvents = require('../index.js');

describe('API 1.32 events and promises', function () {
	var client;
	beforeEach(function () {
		client = new BrowshotEvents('test-key');
		client.defaults = { timeout: 1, interval: 0.001 };
	});

	['Pdf', 'Video'].forEach(function (kind) {
		var method = 'screenshot' + kind;
		var save = 'save' + kind;
		it(method + ' resolves with the binary Buffer and forwards arguments', function () {
			var data = Buffer.from([0, 128, 255]); var args = { details: 1 };
			client.browshot[method] = function (id, options, callback) {
				assert.equal(id, 123); assert.strictEqual(options, args);
				setImmediate(function () { callback(data); });
			};
			return client[method](123, args).then(function (body) { assert.strictEqual(body, data); });
		});
		it(method + ' rejects with an empty string when the download fails', function () {
			client.browshot[method] = function (id, args, callback) { setImmediate(function () { callback(''); }); };
			return client[method](123, {}).then(function () { assert.fail('Expected rejection'); }, function (error) { assert.strictEqual(error, ''); });
		});
		it(method + ' supplies default arguments', function () {
			client.browshot[method] = function (id, args, callback) { assert.equal(id, 0); assert.deepStrictEqual(args, {}); callback(''); };
			return client[method]().then(function () { assert.fail('Expected rejection'); }, function (error) { assert.strictEqual(error, ''); });
		});
		it(save + ' resolves with the filename and forwards arguments', function () {
			var args = { details: 1 };
			client.browshot[method + 'File'] = function (id, file, options, callback) {
				assert.equal(id, 123); assert.equal(file, 'capture.bin'); assert.strictEqual(options, args);
				setImmediate(function () { callback(file); });
			};
			return client[save](123, 'capture.bin', args).then(function (file) { assert.equal(file, 'capture.bin'); });
		});
		it(save + ' rejects with the requested filename on failure', function () {
			client.browshot[method + 'File'] = function (id, file, args, callback) { callback(''); };
			return client[save](123, 'capture.bin').then(function () { assert.fail('Expected rejection'); }, function (file) { assert.equal(file, 'capture.bin'); });
		});
		it(save + ' supplies default arguments', function () {
			client.browshot[method + 'File'] = function (id, file, args, callback) {
				assert.equal(id, 0); assert.equal(file, ''); assert.deepStrictEqual(args, {}); callback('');
			};
			return client[save]().then(function () { assert.fail('Expected rejection'); }, function (file) { assert.equal(file, ''); });
		});
	});

	it('keeps existing thumbnail promises working', function () {
		var data = Buffer.from('thumbnail');
		client.browshot.screenshotThumbnail = function (id, args, callback) { callback(data); };
		client.browshot.screenshotThumbnailFile = function (id, file, args, callback) { callback(file); };
		return Promise.all([client.screenshotThumbnail(123, {}), client.saveThumbnail(123, 'image.png', {})]).then(function (results) {
			assert.strictEqual(results[0], data); assert.equal(results[1], 'image.png');
		});
	});

	var options = { pdf: 1, pdf_format: 'a4', pdf_background: 1, pdf_one_page: 1, pdf_landscape: 1,
		pdf_margin: '1cm', pdf_margin_top: '2px', pdf_margin_bottom: '3mm', pdf_margin_left: '0in', pdf_margin_right: '0px',
		video: 1, video_format: 'gif', video_duration: 5, video_quality: 30, video_fps: 20, video_scale: 0.5,
		device_scale: 2, hide_ads: 1 };
	Object.keys(options).forEach(function (name) {
		it('forwards ' + name + ' without altering the event interface', function (done) {
			var args = { url: 'https://example.com/', instance_id: 377 }; args[name] = options[name];
			client.browshot.screenshotCreate = function (request, callback) {
				assert.strictEqual(request, args); assert.equal(request[name], options[name]);
				setImmediate(function () { callback({ id: 123, status: 'finished' }); });
			};
			client.screenshotCreate(args).once('finished', function (screenshot) {
				assert.equal(screenshot.original_url, args.url); done();
			});
		});
	});

	it('polls queued and processing captures through the underlying Browshot client', function (done) {
		var states = [];
		client.browshot.screenshotCreate = function (args, callback) { setImmediate(function () { callback({ id: 123, status: 'in_queue' }); }); };
		var polls = 0;
		client.browshot.screenshotInfo = function (id, args, callback) {
			assert.equal(id, 123); assert.equal(args.details, 1);
			setImmediate(function () { callback({ id: 123, status: ++polls == 1 ? 'in_process' : 'finished', pdf: 1 }); });
		};
		var emitter = client.screenshotCreate({ url: 'https://example.com/', instance_id: 373, pdf: 1, details: 1 });
		emitter.on('in_queue', function () { states.push('in_queue'); });
		emitter.on('in_process', function () { states.push('in_process'); });
		emitter.on('finished', function (screenshot) {
			assert.deepStrictEqual(states, ['in_queue', 'in_process']); assert.equal(polls, 2);
			assert.equal(screenshot.original_url, 'https://example.com/'); assert.equal(screenshot.pdf, 1);
			setImmediate(function () { assert.equal(emitter.eventNames().length, 0); done(); });
		});
	});
	['create', 'poll'].forEach(function (stage) {
		it('emits failed on an API error at ' + stage, function (done) {
			client.browshot.screenshotCreate = function (args, callback) { setImmediate(function () { callback({ id: 123, status: stage == 'create' ? 'error' : 'in_queue' }); }); };
			client.browshot.screenshotInfo = function (id, args, callback) { setImmediate(function () { callback({ id: 123, status: 'error' }); }); };
			var emitter = client.screenshotCreate({ url: 'https://example.com/', instance_id: 373, video: 1 });
			emitter.on('failed', function (screenshot) {
				assert.equal(screenshot.status, 'error');
				setImmediate(function () { assert.equal(emitter.eventNames().length, 0); done(); });
			});
		});
		it('emits timeout for an unfinished capture at ' + stage, function (done) {
			client.browshot.screenshotCreate = function (args, callback) {
				setImmediate(function () { if (stage == 'create') { client.defaults.timeout = 0; } callback({ id: 123, status: 'in_queue' }); });
			};
			client.browshot.screenshotInfo = function (id, args, callback) {
				client.defaults.timeout = 0; setImmediate(function () { callback({ id: 123, status: 'in_process' }); });
			};
			var emitter = client.screenshotCreate({ url: 'https://example.com/', instance_id: 373 });
			emitter.on('timeout', function (screenshot) {
				assert.equal(screenshot.id, 123);
				setImmediate(function () { assert.equal(emitter.eventNames().length, 0); done(); });
			});
		});
	});
	it('forwards common and per-capture options in screenshotCreateMultiple', function (done) {
		var seen = [];
		client.browshot.screenshotCreate = function (args, callback) {
			seen.push(args); var id = seen.length;
			setImmediate(function () { callback({ id: id, status: 'in_queue' }); });
		};
		client.browshot.screenshotInfo = function (id, args, callback) { setImmediate(function () { callback({ id: id, status: 'finished' }); }); };
		client.screenshotCreateMultiple([
			{ url: 'https://example.com/pdf', pdf: 1 },
			{ url: 'https://example.com/video', video: 1, video_format: 'mp4', hide_ads: 0 }
		], { instance_id: 373, hide_ads: 1 }).on('complete', function (screenshots) {
			assert.equal(seen[0].pdf, 1); assert.equal(seen[0].hide_ads, 1);
			assert.equal(seen[1].video_format, 'mp4'); assert.equal(seen[1].hide_ads, 0);
			assert.equal(seen[1].instance_id, 373); assert.equal(screenshots.length, 2);
			assert.equal(screenshots[0].original_url, 'https://example.com/pdf'); done();
		});
	});
});
