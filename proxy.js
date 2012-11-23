var http = require('http');
var url  = require('url');
var util = require('util'); 
var zlib = require('zlib');
var nc  = require('ncurses'); 
//var StringDecoder = require('StringDecoder');

var spaces_b200 = new Buffer(200); spaces_b200.fill(" ");
var spaces_200 = spaces_b200.toString();
		
var requests_data = {}; 
var request_id_next = 1; 

var server = http.createServer(function(request, response) {
	var request_url = url.parse(request.url); 

	var proxy_options = {}; 
	proxy_options.headers = request.headers; 
	proxy_options.path = request_url.path;
	proxy_options.method = request.method ; 
	proxy_options.host = request_url.hostname; 
	proxy_options.port = request_url.port || 80;  

	var spaces = new Buffer(90); spaces.fill(' ');
	var request_url_substr = (request.url + spaces ).substr(0,90); 
	var request_id = "request_id_" + ( ++request_id_next ); 
	
	requests_data[request_id] = { 
		'url'		: request_url_substr , 
		'status'	: 'open' , 
		'is_text'	: 0 , 
		'progress'   : '' , 
		'timeout'   : ''
	}
	
	var proxy_request = http.request( proxy_options , function(proxy_response){
	   var content_type =  proxy_response.headers['content-type'] || "" ; 
	   var is_text = content_type.match('text\/html') || 0;
  	   var mybuffer = ''; 
  	   var output = ''; 
  	   proxy_request.myresponse = proxy_response; 
  	   requests_data[request_id].status="request";

		if ( request.url.match(/\.(ico|xml|css|js|jpg|gif|png)/i) ){
			is_text = 0; 
		}	
		if ( request.url.match(/(owa|facebook|gravatar|vimeo|stumbleupon)/) ){
			is_text = 0; 
		}	
		if( is_text ) {
			requests_data[request_id].is_text = 1; 
			proxy_response.setEncoding('binary');
		} 
		
		// this only works if we dont change the content-lenght, but only rearrange
		response.writeHead(proxy_response.statusCode, proxy_response.headers);
		
		var len = parseInt(proxy_response.headers['content-length'], 10);
		var cur = 0;

		// there could be optimization to grab javascripts already from 
		// chunks, and reinsert them at the on('end'), but its quite complicated
		// because a string can be split up in 2 chunks... load full buffer for now. 	
		proxy_response.on('data', function(chunk){
			if ( is_text ) {
				mybuffer += chunk.toString('binary') ;
				//buffers.push( chunk );  
			} else {
				response.write(chunk,'binary');
			}
				
			if ( len > 10000 ) {
				cur += chunk.length;
				var spaces = new Buffer(16); spaces.fill("\t");
				var progress = (100.0 * cur / len).toFixed(2) + "% " + (cur/1000.0/1000.0).toFixed(3) + " mb"; 
				requests_data[request_id].progress = progress; 
			}	
				requests_data[request_id].status="data";
		});

		

		proxy_response.on('end', function() {
		  	if ( is_text  ) {
		  		// workaround: to get multiline regex we convert nl to uffff and back
		  		//buffers_all = Buffer.concat( buffers );
		  		//var decoder = new StringDecoder('utf8');
		  		//output = decoder.write( buffers_all ).toString('utf8'); 
		  		
				output = mybuffer.toString().replace(/\n/g,'\uffff'); 
				// find javascripts	
				matches = output.match(/\<script.*?\<\/script\>/gi ) || [];
				
				if( matches.length > 0 && output.match(/\<\/body\>/i) /* google redirects with missing body */) {
					// remove javascripts
					output = output.replace(	/\<script.*?\<\/script\>/gi , "" ); 

					// insert js before /body	
					output = output.replace( /\<\/body\>/i , ""+ matches.join('') + "</body>" ); 
				}
				// send to browser
				output = output.replace(/\uffff/g,'\n');
 	
				//response.write( buffers_all ); 
				response.write( output ,'binary');	
			} 	
			requests_data[request_id].status="end";
			response.end();
		});

	}).on('error' , function(e){
    	requests_data[request_id].status = 'error' ; 
  		requests_data[request_id].error  = e.message ; 
  	}).on('data' , function(chunk) {
		requests_data[request_id].status = 'data up' ; 
  		proxy_request.write( chunk, 'binary' ); 
  	}).on('close' , function() {
  		requests_data[request_id].status="closed";
  		
  		if ( proxy_request.myresponse ) {
	  		proxy_response.myresponse.abort();
  		}
		if ( proxy_request ) {
			proxy_request.connection.end(); 
		}
		// proxy_response , streaming should be closed also...
		// no need to download from remote-server, as browser does not load data anymore 
		
  	}).on('end' , function(chunk) {
		//console.log('sent post data');
		requests_data[request_id].status="end d";
  		proxy_request.end(); 
	}).end();

}).listen(
	8080
).on('error',  function(e) {
	console.log('got server error' + e.message ); 
}); 

// set to 0 if you want to turn off ncurses display-refresh, 
// change refreshtimer in setInterval (default 1000 = 1seconds)
if ( 1 ) {
	// provide logging
	var win = new nc.Window();
	nc.showCursor = false; 
	
	var log_counter = 0; 
	setInterval( function(){
		//console.log( requests_data ); 
		
		log_counter++; 
		var ln = 1; 
		var nc_lines = nc.lines; 
		
		//for ( ln = 0; ln < Object.keys(requests_data).length ; ln++ ){
		win.addstr(0,1, "proxy server 8080 :" + log_counter + "s " /*+ (ln -1 )+" connections   "*/);
		
		for ( key in requests_data ){
			var request_data = requests_data[key]; 
			
			ln++; 
			if ( ln <= nc_lines ) {
				//win.addstr( ln , 0 , log_counter +"" ); 
				win.addstr( ln , 0 , (request_data['url'] +"").substr(0,70) );
				win.addstr( ln , 78, (request_data['timeout' ]+"      ").substr(0,2) );
				win.addstr( ln , 80, (request_data['status' ]+"        ").substr(0,6) );
				win.addstr( ln , 75, (request_data['is_text' ]+" ").substr(0,1) );
				win.addstr( ln , 90, (request_data['progress']+"                ").substr(0,16) ); 
				win.refresh(); // due to bug in osx+terminal+ncurses we need to refresh often.
			}
		
			if ( (requests_data[key]['status']+"").match(/(closed|end|error)/) && requests_data[key]['timeout']+""==""){
				requests_data[key]['timeout'] =  ( requests_data[key]['is_text'] == 0 ) ? 5 : 9; 
			}
			if ( (requests_data[key]['timeout']+"").match(/[0-9]+/) ){
				requests_data[key]['timeout'] -= 1; 
			}
			if ( (requests_data[key]['timeout']+"") == "0" ){
				delete requests_data[key] ; 
			}
			
		}
		
		for ( ln ; ln < nc_lines; ln++ ) {
			win.addstr( ln , 0, spaces_200.substr(0,120) );
		}
		win.refresh();
	} , 1000); // refresh log every 1s
} else {
	console.log( 'server stated on port 8080' ); 
}

