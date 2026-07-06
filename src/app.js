'use strict';

/*
This is Pookie Search's Main Entry Point. 
Responsible for: creating the Express App, Configuring Middleware, Serving Static Files and Assets, Registering Routes, Starting Server.
*/

const express = require('express');
const path = require('path');
const application = express();
const SERVER_PORT = process.env.PORT || 6767;

application.disable('x-powered-by');
application.use(express.urlencoded({ extended: true }));
application.use(express.json());

const publicDirectoryPath = path.join(__dirname, '..', 'public');
application.use(express.static(publicDirectoryPath));

const viewsDirectorPath = path.join(__dirname, '..', 'views');
application.get('/', function(request, response) {
    response.sendFile(
        path.join(viewsDirectorPath, 'index.html')
    );
});

application.get('/health', function(request, response) {
    response.status(200).json({
        application: 'Pookie Search',
        status: 'healthy',
        version: '67.67.0',
    });
});

application.use(function(request, response) {
    response.status(404).json({
        success: false,
        message: 'Nuh uh! 404.'
    });
});

application.use(function(error, request, response, next) {
    console.error(error);
    response.status(500).json({
        success: false,
        message: 'uhm. Its an error.'
    });
});

application.listen(SERVER_PORT, function() {
    console.log('');
    console.log('===============================');
    console.log('   Pookie Search is running.   ');
    console.log('===============================');
    console.log('Server Address: http://localhost:' + SERVER_PORT);
    console.log('Status: Runningggg.');
    console.log('===============================');
    console.log('Made by Vishwas Kumar.');
    console.log('===============================');
});