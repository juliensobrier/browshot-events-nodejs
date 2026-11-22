var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');

function checkFormat(data, format) {
	assert.ok(Buffer.isBuffer(data));
	assert.ok(data.length > 32);
	if (format == 'pdf') assert.equal(data.slice(0, 5).toString(), '%PDF-');
	if (format == 'webm') assert.equal(data.slice(0, 4).toString('hex'), '1a45dfa3');
	if (format == 'mp4') assert.equal(data.slice(4, 8).toString(), 'ftyp');
	if (format == 'gif') assert.ok(['GIF87a', 'GIF89a'].includes(data.slice(0, 6).toString()));
}

var BrowshotEvents = require('../index.js');
var live = process.env.BROWSHOT_LIVE_TESTS == '1' && process.env.BROWSHOT_API_KEY;

(live ? describe : describe.skip)('API 1.32 live promises', function () {
	this.timeout(60000);
	var client, directory;
	before(function () {
		client = new BrowshotEvents(process.env.BROWSHOT_API_KEY);
		client.browshot.error = function () {};
		directory = fs.mkdtempSync(path.join(os.tmpdir(), 'browshot-events-live-'));
	});
	after(function () {
		fs.readdirSync(directory).forEach(function (file) { fs.unlinkSync(path.join(directory, file)); });
		fs.rmdirSync(directory);
	});
	['pdf', 'webm', 'mp4', 'gif'].forEach(function (format) {
		var id = process.env['BROWSHOT_' + format.toUpperCase() + '_ID'];
		var kind = format == 'pdf' ? 'Pdf' : 'Video';
		(id ? it : it.skip)('resolves a real ' + format + ' artifact', function () {
			return client['screenshot' + kind](id, {}).then(function (data) { checkFormat(data, format); });
		});
		(id ? it : it.skip)('saves the real ' + format + ' bytes through a Promise', function () {
			var file = path.join(directory, 'capture.' + format);
			return client['screenshot' + kind](id, {}).then(function (data) {
				checkFormat(data, format);
				return client['save' + kind](id, file, {}).then(function (saved) { assert.equal(saved, file); assert.deepStrictEqual(fs.readFileSync(file), data); });
			});
		});
	});
	['Pdf', 'Video'].forEach(function (kind) {
		it('rejects an unavailable ' + kind + ' download', function () {
			return client['screenshot' + kind](1, {}).then(function () { assert.fail('Expected rejection'); }, function (error) { assert.strictEqual(error, ''); });
		});
		it('rejects an unavailable ' + kind + ' file with the requested filename', function () {
			var file = path.join(directory, 'missing-' + kind);
			return client['save' + kind](1, file, {}).then(function () { assert.fail('Expected rejection'); }, function (error) { assert.equal(error, file); assert.ok(!fs.existsSync(file)); });
		});
	});
});
