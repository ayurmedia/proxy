var http = require('http');
var url  = require('url');
var util = require('util'); 

var server = http.createServer(function(request, response) {
	var request_url = url.parse(request.url); 
	var proxy_options = request.headers; 
	var proxy_options2 = {
		host: request_url.hostname, 
		port: request_url.port || 80 , 
		path: request_url.path , 
		method: request.method 
	}
	proxy_options.path = proxy_options2.path;
	proxy_options.host = proxy_options2.host; 
	proxy_options.port = proxy_options2.port;  

	var proxy_request = http.request( proxy_options , function(proxy_response){
	   var content_type =  proxy_response.headers['content-type'] || "" ; 
		var is_text = content_type.match('text\/html') || 0;
  	   var mybuffer = ''; 

		if ( request.url.match(/\.(ico|xml|css|js|jpg|gif|png)/i) ){
			is_text = 0; 
		}	
		if ( request.url.match(/(facebook|gravatar|vimeo|stumbleupon)/) ){
			is_text = 0; 
		}	
		if( is_text ) {
			console.log( request.url.substr(0,90) ); 	
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
			} else {
				response.write(chunk,'binary');
   		}	
				if ( len > 10000 ) {
					cur += chunk.length;
  					util.print("\t\t\t\t\t\t\t\t\t\t\t\t\t " + (100.0 * cur / len).toFixed(2) + "% " + cur + " bytes\r");
				}	
		});

		proxy_response.on('end', function() {
		  	
			 if ( is_text ) {
				output = mybuffer.toString().replace(/\n/g,'\uffff'); 
				// find javascripts	
				matches = output.match(/\<script.*?\<\/script\>/gi ) || [];
				
				if( matches.length > 0 ) {
					// remove javascripts
					output = output.replace(	/\<script.*?\<\/script\>/gi , "" ); 

					// insert js before /body	
					output = output.replace( /\<\/body\>/i , ""+ matches.join('') + "</body>" ); 
				}
				// send to browser
				output = output.replace(/\uffff/g,'\n');
 	
	
				response.write( output ,'binary');	
			} 	
				response.end();
		});

	}).on('error' , function(e){
    	console.log('problem with request: ' + e.message ); 
    	console.log(request.url ); 
  	}).on('data' , function(chunk) {
		proxy_request.write( chunk, 'binary' ); 
  	}).on('end' , function(chunk) {
		console.log('sent post data');
		proxy_request.end(); 
	}).end();

}).listen(8080).on('error',  function(e) {
	console.log('got server error' + e.message ); 
}); 
console.log('server started on 8080');

