var http = require('http');
var url  = require('url');
var util = require('util'); 
var zlib = require('zlib');
var StringDecoder = require('string_decoder').StringDecoder;

// Buffer() is global, no need to require !
// todo: improve output on console with ncurses, make it unxi:top-like

var server = http.createServer(function(request, response) {
	var request_url = url.parse(request.url); 
	var proxy_options = {}; 
	proxy_options.headers = request.headers; 
	proxy_options.path = request_url.path;
	proxy_options.method = request.method ; 
	proxy_options.host = request_url.hostname; 
	proxy_options.port = request_url.port || 80;  

	var spaces = new Buffer(90); spaces.fill(' ');
	util.print( (request.url + spaces ).substr(0,90) + "\r" ); 
	
	var proxy_request = http.request( proxy_options , function(proxy_response){
	   var content_type =  proxy_response.headers['content-type'] || "" ; 
	   var is_text = content_type.match('text\/html') || 0;
  	   var mybuffer = ''; 
  	   //var buffers = []; 
  	   var output = ''; 
  	   proxy_request.myresponse = proxy_response; 
  	   
		if ( request.url.match(/\.(ico|xml|css|js|jpg|gif|png)/i) ){
			is_text = 0; 
		}	
		if ( request.url.match(/(owa|facebook|gravatar|vimeo|stumbleupon)/) ){
			is_text = 0; 
		}	
		if( is_text ) {
			console.log( "\n" + request.url.substr(0,90) ); 	
			//console.log( proxy_options ); 
			
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
				util.print( spaces + (100.0 * cur / len).toFixed(2) + "% " + (cur/1000.0/1000.0).toFixed(3) + " mb\r");
			}	
		});

		

		proxy_response.on('end', function() {
		  	if ( is_text  ) {
		  		// workaround: to get multiline regex we convert nl to uffff and back
		  		//buffers_all = Buffer.concat( buffers );
		  		//var decoder = new StringDecoder('utf8');
		  		//output = "...";
		  		//console.log( proxy_response.headers ); 
		  		
		  		/*output = decoder.write( buffers_all ).toString('utf8'); 
		  		
		  		console.log("buffers-count: " +  buffers.length ); 
		  		console.log("buffers-length: " + output.length ); 
		  		console.log( output.substr(0,200) ); 
		  		*/
		  		
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
			response.end();
		});

	}).on('error' , function(e){
    	console.log('problem with request: ' + e.message ); 
    	console.log( "e: " + request.url ); 
  	}).on('data' , function(chunk) {
		proxy_request.write( chunk, 'binary' ); 
  	}).on('close' , function() {
  		console.log('connection closed');
  		if ( proxy_request.myresponse ) {
	  		proxy_response.myresponse.abort();
  		}
		if ( proxy_request ) {
			console.log( "request still runnning " ); 
			proxy_request.connection.end(); 
		}
		// proxy_response , streaming should be closed also...
		// no need to download from remote-server, as browser does not load data anymore 
		console.log( "c:" + request.url.substr(0,90) );  
  	}).on('end' , function(chunk) {
		console.log('sent post data');
		proxy_request.end(); 
	}).end();

}).listen(8080).on('error',  function(e) {
	console.log('got server error' + e.message ); 
}); 
console.log('server started on 8080');

