'use strict';

var fs = require('fs');
var path = require('path');
var stripJSONComments = require('strip-json-comments');

var logger;

exports.defaults = function () {
  return {
    jscs: {
      exclude: [],
      compiled: true,
      copied: true,
      vendor: false,
      rules: { },
    }
  };
};

exports.placeholder = function () {
  // Text below based on jshint's placeholder text by dbashford
  return '\n' +
    'jscs:                     # Settings for javascript JSCS linting, more\n' +
    '                          # ' +
    'detailed documentation can be found at the project\n' +
    '                          # homepage at\n' +
    '                          # https://github.com/al-broco/mimosa-jscs\n' +
    '  exclude: []             # ' +
    'Array of strings or regexes that match files to not\n' +
    '                          # ' +
    'lint, strings are paths that can be relative to the\n' +
    '                          # watch.sourceDir or absolute\n' +
    '  compiled: true          # ' +
    'Fire jscs on successful compile of meta-language to\n' +
    '                          # javascript\n' +
    '  copied: true            # Fire jscs for copied javascript files\n' +
    '  vendor: false           # ' +
    'Fire jscs for copied vendor javascript files\n' +
    '  # configFile: \'.jscsrc\' # ' +
    'This is the path, either relative to the root of the\n' +
    '                          # ' +
    'project or absolute, to a JSCS configuration file.\n' +
    '                          # ' +
    'If the file extension is .js or .json the file will\n' +
    '                          # ' +
    'be read using Node\'s require. Otherwise the file\n' +
    '                          # ' +
    'will be read as commented JSON. If the file name is\n' +
    '                          # ' +
    'package.json, the JSCS configuration is expected to\n' +
    '                          # be found in a property jscsConfig.\n' +
    '  rules: { }              # ' +
    'Configuration: https://www.npmjs.org/package/jscs,\n' +
    '                          # ' +
    'these settings will override any settings set up in\n' +
    '                          # the configuration file.\n';
};

exports.validate = function (config, validators) {
  logger = config.log;

  var errors = [];

  if (validators.ifExistsIsObject(errors, 'jscs config', config.jscs)) {
    // Note: Call below will modify config to have an
    // jscs.excludeRegex and change jscs.exclude to have absolute
    // paths
    validators.ifExistsFileExcludeWithRegexAndString(errors,
                                                     'jscs.exclude',
                                                     config.jscs,
                                                     config.watch.sourceDir);

    ['compiled', 'copied', 'vendor'].forEach(function (type) {
      validators.ifExistsIsBoolean(errors, 'jscs.' + type, config.jscs[type]);
    });

    if (!validators.ifExistsIsObject(errors, 'jscs.rules', config.jscs.rules)) {
      // Make sure jscs.rules exists and is an object
      config.jscs.rules = { };
    }

    var configFileExists = ifExistsIsFile(validators,
                                          errors,
                                          'jscs.configFile',
                                          config.jscs.configFile,
                                          config.root);
    if (configFileExists) {
      // Merge property from config file into rules property, rules
      // properties overriding config file properties
      var jscsConfig = getContent(config.jscs.configFile, config.root);
      for (var property in jscsConfig) {
        property in config.jscs.rules ||
          (config.jscs.rules[property] = jscsConfig[property]);
      }
    }
  }

  return errors;
};

// Validates that a property is a string pointing to an existign file
// (absolute path or relative to project root). Similar to standard
// Mimosa validator functions.
function ifExistsIsFile(validators, errors, fld, file, relTo) {
  if (!validators.ifExistsIsString(errors, fld, file)) {
    return false;
  }

  var fullPath = path.resolve(relTo, file);
  if (!fs.existsSync(fullPath)) {
    errors.push('' + fld + ' [[ ' + fullPath + ' ]] cannot be found');
    return false;
  }
  if (!fs.statSync(fullPath).isFile()) {
    errors.push('' + fld + ' [[ ' + fullPath + ' ]] exists but is not a file');
    return false;
  }

  return true;
}

// Loads a configuration file. This function is copied from the file
// cli-config.js in JSCS v1.7.3. It is not part of JSCS' public
// interface, by copying it mimosa-jscs gets the same behavior as
// JSCS. Function has been slightly rewritten to add some logging.
function getContent(config, directory) {
  if (!config) {
    return;
  }

  var configPath = path.resolve(directory, config);
  var ext;
  var content;

  config = path.basename(config);

  if (fs.existsSync(configPath)) {
    ext = path.extname(configPath);

    if (ext === '.js' || ext === '.json') {
      logger.debug('Loading JSCS config from [[ ' + configPath + ' ]] ' +
                   'using Node require');
      content = require(configPath);
    } else {
      logger.debug('Loading JSCS config from [[ ' + configPath + ' ]] ' +
                   'as JSON (with comments removed)');
      content = JSON.parse(
        stripJSONComments(
          fs.readFileSync(configPath, 'utf8')
        )
      );
    }

    // Adding property via Object.defineProperty makes it
    // non-enumerable and avoids warning for unsupported rules
    Object.defineProperty(content, 'configPath', {
      value: configPath
    });
  }

  if (content && config === 'package.json') {
    if ('jscsConfig' in content) {
      logger.debug('Using JSCS config in jscsConfig property of ' +
                   '[[ ' + configPath + ' ]]');
    } else {
      logger.warn('Loading JSCS config from [[ ' + configPath + ' ]], ' +
                  'but [[ ' + configPath + ' ]] is missing a jscsConfig ' +
                  'property');
    }

    return content.jscsConfig;
  }

  return content;
}
