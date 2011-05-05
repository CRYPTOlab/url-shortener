var sys = require('sys'), 
    fs = require('fs'), 
	querystring = require('querystring'),
    http = require('http');
var parse = require('url').parse;         

var mongodb = require('./mongodb');
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : mongodb.Connection.DEFAULT_PORT;
var db = new mongodb.Db('short_url', new mongodb.Server(host, port, {}), {native_parser:true});

db.open(function(err, db)
{
	http.createServer(function (req, res) {
		// work out which file is being requested
		var path = parse(req.url).pathname;
		if(path.match(/\/$/)) {
			// assume index.html
			path += "index.html";
		}

		// make path relative to "."
		path = "."+path;

		/* Click 'Shorten' button. */
		if (req.method == 'POST') {
			/* Save url map info. */
			post_handler(req, function(req_data)
				{
					db.collection('urlmaps', function(error, collection) 
						{
							collection.find({'short' : req_data.short_url, 'long': req_data.long_url}).toArray(function(err, docs) 
								{
									/* Not exist. */
									if (docs.length == 0) {
										/* Save url map info in db.  */
										collection.insert({'short': req_data.short_url, 'long' : req_data.long_url}, {safe:true}, 
											function(err, objects) { if (err) console.warn(err.message); });
									} else {
										collection.update({'short':req_data.short_url}, {'short': req_data.short_url, 'long' : req_data.long_url}, {safe:true}, 
											function(err, objects) { if (err) console.warn(err.message); });

									}
								});
						});
				});
		}

		// load the file
		fs.readFile(path, function (err, data) {
			if(!err) {     
				// extract file type
				var filetype=path.match(/\.[a-zA-Z]+$/)[0];

				// work out the mime type
				var ct;
				switch(filetype) {
					case ".htm": 
					case ".html": ct="text/html"; break;
					case ".js": ct="text/javascript"; break;
					case ".css": ct="text/css"; break;
					case ".png": ct="image/png"; break;
					case ".jpg": ct="image/jpg"; break;
					case ".gif": ct="image/gif"; break;
					default: ct = "text/plain";
				}
				// HTTP 200 header
				res.writeHead(200, {'Content-Type': ct});

				// and end the connection with the contents of the static file
				return res.end(data);
			} else {
				db.collection('urlmaps', function(error, collection) 
						{
							collection.find({'short' : path.substr(2)}).toArray(function(err, docs) 
								{
									if (docs.length != 0) {
										res.writeHead(200, {'Content-Type': 'text/html'});
										res.write( 
											'<html><head><script type="text/javascript">' +
											'window.location = "' + docs[0].long + '";' +
											'</script></head><body><body></html>'
											);
										return res.end();
									} else {
										// sorry 404
										res.writeHead(404, {'Content-Type': 'text/plain'});
										return res.end('URL not found\n');          
									}
								});
						});

			}
		});
	}).listen(8000);
});

function post_handler(request, callback)
{
	var _REQUEST = { };
	var _CONTENT = '';

	if (request.method == 'POST')
	{
		request.addListener('data', function(chunk)
				{
					_CONTENT+= chunk;
				});

		request.addListener('end', function()
				{
					_REQUEST = querystring.parse(_CONTENT);
					callback(_REQUEST);
				});
	};
};
