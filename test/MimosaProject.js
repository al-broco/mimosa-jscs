// Exports a class that can be used to test building with Mimosa. An
// instance of the class can setup a Mimosa project in a temporary
// directory and build it, capturing the output so a test can verify
// it.

var Promise = require('bluebird');
Promise.longStackTraces();

var path = require('path');
var fs = Promise.promisifyAll(require('fs'));
var childProcess = Promise.promisifyAll(require('child_process'));
var temp = Promise.promisifyAll(require('temp')).track();
var stripAnsi = require('strip-ansi');

module.exports = MimosaProject;

/**
 * Represents a simple Mimosa project, with a configuration and a
 * directory structure. Can setup and build the project in a temporary
 * directory and capture the build output. Useful when testing build
 * components.
 *
 * To use, create a MimosaProject instance:
 *
 * var project = new MimosaProject()
 *
 * Add files and directories to the project and modify its
 * configuraton:
 *
 * project.files.assets.javascripts.main = '// file contents';
 * project.mimosaConfig.modules.push('jscs');
 *
 * Build the project in a temp directory:
 *
 * project.build().then(function (result) {
 *   // Perform tests on build results
 * });
 *
 * A MimosaProject instance has the following properties:
 * - files, which is an object representing the project's directory
 *   structure. Each property is either a string, which represents a
 *   file where the string is the file contents, or an object, which
 *   represents a directory.
 * - mimosaConfig, which is an object with the project's Mimosa
 *   configuration. If the files object does not contain a
 *   mimosa-config.js file, one will be created from this object.
 *
 * Default mimosaConfig lists one module, 'copy'. Default files object
 * has directories assets, assets/javascript, and
 * assets/javascript/vendor.
 */
function MimosaProject() {
  this.mimosaConfig = {
    modules: ['copy']
  };
  this.files = {
    assets: {
      javascripts: {
        vendor: { }
      }
    }
  };
  this.promises = {};
};

/**
 * Execute a command in the project's root dir. First arguments is the
 * command to run, the following arguments are program parameters,
 * i. e. exec('ls', '-l') will execute the command "ls -l".
 *
 * Will create the project's root dir (using createRootDir) if it has
 * not been created already. Will not create project files using
 * createProjectFiles.
 *
 * Returns a promise that is rejected with an Error if execution fails
 * and that is resolved with the output (stdout and stderr combined)
 * if successful.
 */
MimosaProject.prototype.exec = function (cmd) {
  var args = Array.prototype.slice.call(arguments, 1);

  return this
    .createRootDir()
    .then(function (rootDir) {
      return exec(cmd, args, rootDir);
    });
};

// Internal function for executing a command
function exec(cmd, args, workingDir) {
  return new Promise(function (resolve, reject) {
    var process = childProcess.spawn(cmd, args, { cwd: workingDir });

    var output = '';
    ['stdout', 'stderr'].forEach(function (stream) {
      process[stream].on('data', function (data) {
        output += data;
      });
    });

    process.on('close', function (code) {
      if (code === 0) {
        resolve(output, code);
      } else {
        var msg = 'Command <' + cmd + ' ' + args.join(' ') + '> failed, '
              + 'error code: ' + code + ', output: ' + output
        reject(new Error(msg));
      }
    });
  });
}

/**
 * Creates a temporary directory for the project. The directory will
 * be removed at program exit. Note: the directory is empty, call
 * createProjectFiles to populate it with project files.
 *
 * Returns a promise that is resolved with the path as a string if
 * successful.
 *
 * If called multiple times it will return the same promise, so the
 * directory is only created once.
 */
MimosaProject.prototype.createRootDir = function () {
  if (!this.promises.createRootDir) {
    this.promises.createRootDir =
      temp.mkdirAsync({ prefix: 'mimosa-project-' });
  }

  return this.promises.createRootDir;
};

/**
 * Creates the project's directory structure based on the files and
 * mimosaConfig properties.
 *
 * Will create the project's root dir (using createRootDir) if it has
 * not been created already.
 *
 * Returns a promise that is resolved when files have been created.
 * If called multiple times it will return the same promise, so the
 * directory structure is only created once.
 */
MimosaProject.prototype.createProjectFiles = function () {
  if (!this.promises.createProjectFiles) {
    if (!this.files['mimosa-config.js']) {
      this.files['mimosa-config.js'] = 'exports.config = \n' +
        JSON.stringify(this.mimosaConfig, undefined, 2);
    }

    this.promises.createProjectFiles = this.createRootDir()
      .bind(this)
      .then(function (rootDir) {
        return populateDirectory(rootDir, this.files);
      });
  }

  return this.promises.createProjectFiles;
};

// Internal function that writes the contents of a directory
function populateDirectory(dir, contents) {
  var promise = Promise.resolve();

  for (var file in contents) {
    var filePath = path.join(dir, file);
    var createFunc = createFileOrDir.bind(undefined, filePath, contents[file]);
    promise = promise.then(createFunc);
  }

  return promise;
}

function createFileOrDir(path, contents) {
  if (typeof contents === 'string') {
    return fs.writeFileAsync(path, contents, { encoding: 'utf8' });
  } else {
    return fs.mkdirAsync(path)
      .then(populateDirectory.bind(undefined, path, contents));
  }
}

/**
 * Builds the project using 'mimosa build'.
 *
 * Will create the project's files (using createProjectFiles) if they
 * have not been created already.
 *
 * Returns a promise that is resolved when the build finishes with an
 * object with the following properties:
 * - output, the stdout and stderr in its entirety
 * - logLines, an array with an object for each line with properties:
 *   - raw, the line
 *   - text, the line with ANSI code stripped
 *   - timestamp, the log timestamp as a string
 *   - logLevel, the log level as it appears in the log (Info, Success,
 *     WARN, etc)
 *   - message, the log line message
 * - warnings, the log lines with log level WARN
 *
 * If the buid fails the promise is rejected with an Error.
 */
MimosaProject.prototype.build = function () {
  return this
    .createProjectFiles()
    .bind(this)
    .then(function () {
      return this.exec('mimosa', 'build', '--errorout');
    })
    .then(function (output) {
      return Promise.resolve(new BuildResult(output));
    });
};

// Internal class for representing a build result, with parsed output
function BuildResult(output) {
  this.output = output.toString();
  this.logLines = parseLines(output);
  this.warnings = this.logLines.filter(function (line) {
    return line.logLevel === 'WARN';
  });
}

// Internal function for parsing build output
function parseLines(output) {
  var result = [];
  output.split('\n').forEach(function (line) {
    result.push(parseLine(line));
  });
  return result;
}

// Internal function for parsing a line of build output
function parseLine(line) {
  var result = {
    raw: line,
    text: stripAnsi(line)
  };

  var match = /([0-9:]+) - (\w+) - (.*)/.exec(result.text);
  if (match) {
    result.timestamp = match[1];
    result.logLevel = match[2];
    result.message = match[3];
  }
  return result;
}
