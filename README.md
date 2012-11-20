#Proxy server in node.js

This proxy server runs on port 8080 and can be used as a real proxy-server. I use this in OSX 10.8.2. Set networksettings > advanced > http-proxy to "localhost:8080". and start the server from commandline with. "$ node proxy.js" Turn off http-proxy if you dont use it anymore. POST-Request from Browser seem to work, but are not much tested. 90% of usage is GET-Requests anyways. there are some domains and extensions filtered, as they are not working 100% with this proxy. the basic idea is only to intercept "content-type: text/html" but actually some webservers are badly configured and even send images with text/html. so there is an additional extensionfilter. the proxyserver does not work with https, so only turn on network-proxy for http(80) and not https(443).

the script reorders javascript in html-code and moves it from top to bottom, so that the page loads faster. one drawback is, that now the html-code is buffered, as all html needs to be loaded by the proxy first to restructure the html. it could be done in the request.on('data') but its quite complicated as html-code is spread over different chunks.

if there is document.write inside the html-flow. and does not append to body at the end, then these blocks will be shown at the end of the document. but its bad practice anyways. so i don't care if these pages break. the pregmatch could be optimized to ignore script tags with document.write, and not rearrange them.

the proxy.js is developed and tested with current latest node.js v0.8.14.
