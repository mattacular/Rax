/*jslint nomen: true, sloppy: true, devel: false, browser: true, maxerr: 50, indent: 4, white: true*/
/*global module: false, process: false, require: false, console: false, clearInterval: false, clearTimeout: false, setInterval: false, setTimeout: false */
/**
 *                        ________  ________
 *    _________ __  __   / ____/  |/  / ___/
 *   / ___/ __ `/ |/_/  / /   / /|_/ /\__ \ 
 *  / /  / /_/ />  <   / /___/ /  / /___/ / 
 * /_/   \__,_/_/|_|   \____/_/  /_//____/  
 *	rax.js - Rax CMS v0.0.1 Server Bootstrap
 *	created by: mstills
 */
var Rax,							// main app object (public)
	core = {},						// internal app object (private)
	connect = require('connect'),	// middleware
	escort = require('escort'),		// router
	fs = require('fs'),
	colors = require('colors'),
	connections = 0,
	modules, cfg,
	warn, error, info;

// expose core public methods and properties
Rax = module.exports = {
	'init': init,
	'router': escort,
	'cfg': {},
	'modules': {},	// addon module store
	'root': process.cwd()
};

// set an absolute reference to Rax core so other modules can require() it easily
global.raxCore = Rax.root + '/core/rax.js';

function loadDb() {
	Rax.beacon = loadModule('beacon');
	Rax.db = loadModule('database/mongo');

	Rax.beacon.once('dbHasConfig', function () {
		cfg = Rax.cfg;
		boot(3000);
	});
}

function boot(port) {
	loadCore();		// load enabled core modules

	Rax.beacon.emit('coreLoaded');

	// shortcuts for boot messaging
	info = Rax.logging.info;
	warn = Rax.logging.warn;
	error = Rax.logging.error;

	Rax.log(('[Rax] Booting...').cyan);

	info('Loading addon modules...');
	
	loadAddons();	// load enabled addon modules

	Rax.beacon.emit('addonsLoaded');

	info('Starting server...');
	// start server
	core.server = connect.createServer();

	// connect middleware
	core.server.use(connect.favicon());
	// core.server.use(connect.vhost('local.rax', connect.createServer(function (req, res) {
	// 	res.end('Welcome to admin interface');
	// }).listen(8080)));
	core.server.use(connect.query());
	// @TODO session middleware for Rax (probably needs to be custom but maybe not)
	// @TODO user middleware for Rax (custom)

	if (cfg.ENABLE_REQUEST_LOGGING) {
		core.server.use(connect.logger());
	}

	// check: use static file server?
	if (cfg.USE_STATIC_FILESERVER) {
		// @TODO allow usage of built-in static fileserver
		info('Enabling static server @ ' + Rax.root + '/static');
		core.server.use(connect.static(Rax.root + '/static'));
	}

	// serve theme's static files
	core.server.use(connect.static(Rax.root + '/themes/' + cfg.ACTIVE_THEME, { maxAge: 1000 }));

	// lastly, connect router & the routes map
	core.server.use(Rax.router(core.routes));
	Rax.logging.c('[Rax] Booting complete. Rax is listening on ' + port + '...');
	// listen!
	core.server.listen(port);
	Rax.beacon.emit('init');	// bootstrap complete, safe for other modules to init
}

function loadModule(mid, type) {
	var module = mid + '.js';

	type = (typeof type !== 'undefined' && type === 'addon') ? 'modules' : 'core';

	if (fs.existsSync(type + '/' + module)) {
		return (type === 'core') ? require('./' + module) : require('../modules/' + module);
	}

	return false;
}

/**
 *	loadCore()
 *		Load core modules
 */
function loadCore() {
	var modules = getActiveModules(),
		module, options, option, i;

	for (i = 0; i < modules.length; i += 1) {
		options = modules[i].split(':');

		if (options.length > 1) {
			module = options.shift();
		} else {
			module = options[0];
			options = false;
		}

		if (module.indexOf('/') !== -1) {
			if (!options || options[0].indexOf('alias') === -1) {
				continue; // complex requirements must provide an alias for themselves
			}

			alias = options[0].split('=')[1];
			Rax[alias] = loadModule(module);
		} else if (options && options[0].indexOf('private') !== -1) {
			core[module] = loadModule(module);
		} else {
			Rax[module] = loadModule(module);	// core modules are available at the top-level of the Rax object
		}
	}

	return true;
}

/**
 *	loadAddons()
 *		Load addon (3rd party) modules
 */
function loadAddons() {
	var modules = getActiveAddonModules(),
		module, options, option, i;

	for (i = 0; i < modules.length; i += 1) {
		options = modules[i].split(':');

		if (options.length > 1) {
			module = options.shift();
		} else {
			module = options[0];
		}

		if (options[0].indexOf('private') !== -1) {
			if (typeof core.modules !== 'object') {
				core.modules = {};
			}
			core.modules[module] = loadModule(module + '/' + module, 'addon');
		} else {
			Rax.log('loading addon module...', module);
			Rax.modules[module] = loadModule(module + '/' + module, 'addon');
		}
	}

}

// @TODO temp function
function getActiveAddonModules() {
	return ['glados'];
}

function getActiveDb() {
	return 'database/mongo:alias=db';
}

// @TODO temp function
function getActiveModules() {
	return ['logging', 'post', 'toolkit', 'theme', 'routes:private'];	// note that private modules cannot expose routes etc. to the app
}

function init(port, callback) {
	loadDb();
	//boot(port || 3000);
}