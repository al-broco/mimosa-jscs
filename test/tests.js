var path = require('path');
var expect = require('expect');
var util = require('util');
var semver = require('semver');
var Promise = require('bluebird');
var MimosaProject = require('./MimosaProject');

var JSCS_VERSIONS_TO_TEST = [
  '1.13.0',
  '1.12.0',
  '1.11.3',
  '1.11.2',
  '1.11.1',
  '1.11.0',
  '1.10.0',
  '1.9.0',
  '1.8.1',
  '1.8.0',
  '1.7.3',
  '1.7.2',
  '1.7.1',
  '1.7.0',
  '1.6.2',
  '1.6.1',
  '1.6.0',
  '1.5.9',
  '1.5.8',
  '1.5.7',
  '1.5.6',
  '1.5.4',
  '1.5.3',
  '1.5.2',
  '1.5.1',
  '1.4.5',
  '1.4.4',
  '1.4.3',
  '1.4.0',
  '1.3.0'
];

describe('mimosa-jscs', function () {
  var project;

  beforeEach(function () {
    return setupProject().then(function (createdProject) {
      project = createdProject;
    });
  });

  describe('does not allow a malformed configuration', function () {
    [
      {
        desc: 'where config.jscs is not an object',
        config: []
      },
      {
        desc: 'where config.jscs.compiled is not a boolean',
        config: { compiled: 'true' }
      },
      {
        desc: 'where config.jscs.copied is not a boolean',
        config: { copied: 'true' }
      },
      {
        desc: 'where config.jscs.vendor is not a boolean',
        config: { vendor: 'true' }
      },
      {
        desc: 'where config.jscs.rules is not an object',
        config: { rules: [] }
      },
      {
        desc: 'where config.jscs.exclude is not an array',
        config: { exclude: true }
      },
      {
        desc: 'where config.jscs.configFile is not a string',
        config: { configFile: true }
      },
      {
        desc: 'where config.jscs.configFile is not an existing file',
        config: { configFile: 'nothing.json' }
      },
      {
        desc: 'where config.jscs.executeAfterCompile is not a boolean',
        config: { executeAfterCompile: 'true' }
      }
    ].forEach(function (data) {
      it(data.desc, function () {
        project.mimosaConfig.jscs = data.config;

        return project.build()
          .then(function () {
            throw new Error('Build successful despite malformed JSCS config: ' +
                            util.inspect(data.config, { depth: null }));
          }).catch(MimosaProject.BuildError, function (err) {
            // Expected (build should fail)
            // check that it fails for the right reason
            expect(err.errors.length).toBe(1);
            expect(err.errors[0].text).toMatch(/Unable to start Mimosa/);
          });
      });
    });
  });

  describe('linting a project with a JS file, a coffeescript file, ' +
           'a vendor JS file, and a vendor coffeescript file',
           function ()
  {
    // Data driven tests that check that the correct files are linted
    // depending on compiled, copied, vendor config properties

    beforeEach(function () {
      project.mimosaConfig.modules.push('coffeescript');
    });

    [
      { compiled: false, copied: false, vendor: false,
        expectedLintedFiles: [] },
      { compiled: false, copied: true, vendor: false,
        expectedLintedFiles: ['copied.js'] },
      { compiled: true, copied: false, vendor: false,
        expectedLintedFiles: ['compiled.coffee'] },
      { compiled: true, copied: true, vendor: false,
        expectedLintedFiles: ['copied.js', 'compiled.coffee'] },
      { compiled: false, copied: false, vendor: true,
        expectedLintedFiles: ['copied-vendor.js'] },
      { compiled: false, copied: true, vendor: true,
        expectedLintedFiles: ['copied.js', 'copied-vendor.js'] },
      { compiled: true, copied: false, vendor: true,
        expectedLintedFiles: ['compiled.coffee', 'copied-vendor.js'] },
      { compiled: true, copied: true, vendor: true,
        expectedLintedFiles: ['copied.js',
                              'compiled.coffee',
                              'copied-vendor.js'] }
    ].forEach(function (params) {
      var count = params.expectedLintedFiles.length;
      var description =
            count + (count === 1 ? ' file is' : ' files are') +
            ' linted when ' +
            'compiled = ' + params.compiled +
            ', copied = ' + params.copied +
            ', vendor = ' + params.vendor;
      it(description, function () {
        project.mimosaConfig.jscs = {
          compiled: params.compiled,
          copied: params.copied,
          vendor: params.vendor,
          rules: {
            disallowDanglingUnderscores: true
          }
        };

        // Set up some files, each of which will produce one warning if
        // linted
        project.files.assets.javascripts['copied.js'] =
          'var _foo; // copied javascript file';
        project.files.assets.javascripts['compiled.coffee'] =
          '`var _foo // compiled coffeescript file`';
        project.files.assets.javascripts.vendor['copied-vendor.js'] =
          'var _foo // copied vendor javascript file';
        project.files.assets.javascripts.vendor['compiled-vendor.coffee'] =
          '`var _foo // compiled vendor coffeescript file`';

        // Build and check warnings to see that the expected set of
        // files where linted
        return buildAndTest(project, function (violations) {
          params.expectedLintedFiles.forEach(function (fileName) {
            expectViolationsInFile(violations, fileName);
          });

          expect(violations.length).toBe(params.expectedLintedFiles.length);
          violations.forEach(function (violation) {
            expect(violation).toMatch(/Invalid dangling underscore/);
          });
        });
      });
    });
  });

  describe('can exclude files from linting', function () {
    it('using a string', function () {
      project.mimosaConfig.jscs = {
        exclude: ['javascripts/to-be-excluded.js'],
        rules: {
          requireLineFeedAtFileEnd: true
        }
      };
      project.files.assets.javascripts['to-be-excluded.js'] = '// No line feed';
      project.files.assets.javascripts['to-not-be-excluded.js'] =
        '// No line feed';

      return buildAndTest(project, function (violations) {
        expectViolationsInFile(violations, 'to-not-be-excluded.js');
        expect(violations.length).toBe(1);
        expect(violations[0]).toMatch(/Missing line feed/);
      });
    });

    it('using a regex', function () {
      project.mimosaConfig.jscs = {
        exclude: [/to-be-excluded/],
        rules: {
          requireLineFeedAtFileEnd: true
        }
      };
      project.files.assets.javascripts['to-be-excluded.js'] = '// No line feed';
      project.files.assets.javascripts['to-not-be-excluded.js'] =
        '// No line feed';

      return buildAndTest(project, function (violations) {
        expectViolationsInFile(violations, 'to-not-be-excluded.js');
        expect(violations.length).toBe(1);
        expect(violations[0]).toMatch(/Missing line feed/);
      });
    });

    describe('using the JSCS excludeFiles option', function () {
      it('matching a file name exactly', function () {
        project.mimosaConfig.jscs = {
          rules: {
            excludeFiles: ['javascripts/to-be-excluded.js'],
            requireLineFeedAtFileEnd: true
          }
        };
        project.files.assets.javascripts['to-be-excluded.js'] =
          '// No line feed';
        project.files.assets.javascripts['to-not-be-excluded.js'] =
          '// No line feed';

        return buildAndTest(project, function (violations) {
          expectViolationsInFile(violations, 'to-not-be-excluded.js');
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Missing line feed/);
        });
      });

      it('matching using wildcards', function () {
        project.mimosaConfig.jscs = {
          rules: {
            excludeFiles: ['**/*.js'],
            requireLineFeedAtFileEnd: true
          }
        };
        project.files.assets.javascripts['file1.js'] = '// No line feed';
        project.files.assets.javascripts['file2.js'] = '// No line feed';

        return buildAndTest(project, function (violations) {
          expect(violations).toEqual([]);
        });
      });
    });
  });

  describe('when linting with executeAfterCompile', function () {
    describe('set to false', function () {
      beforeEach(function () {
        project.mimosaConfig.jscs = { executeAfterCompile: false };
      });

      it('javascript files will be checked before compilation', function () {
        // Babel will insert a "use strict" statement (with double
        // quotes) at the top of the compiled file
        project.mimosaConfig.modules.push('babel');
        project.mimosaConfig.jscs.rules = {
          validateQuoteMarks: '\''
        };

        project.files.assets.javascripts['babel.js'] = '// Babel src';

        return buildAndTest(project, function (violations) {
          expect(violations).toEqual([]);
        });
      });

      it('coffeescript files will be checked before compilation', function () {
        project.mimosaConfig.modules.push('coffeescript');
        project.mimosaConfig.jscs = { executeAfterCompile: false };

        project.files.assets.javascripts['valid_coffee.coffee'] =
          '`var _foo`'; // valid coffeescript, invalid javascript

        return buildAndTest(project, function (violations) {
          expectViolationsInFile(violations, 'valid_coffee.coffee');
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Unexpected token/);
        });
      });
    });

    describe('set to true', function () {
      beforeEach(function () {
        project.mimosaConfig.jscs = { executeAfterCompile: true };
      });

      it('javascript files will be checked after compilation', function () {
        // Babel will insert a "use strict" statement (with double
        // quotes) at the top of the compiled file
        project.mimosaConfig.modules.push('babel');
        project.mimosaConfig.jscs.rules = {
          validateQuoteMarks: '\''
        };

        project.files.assets.javascripts['babel.js'] = '// Babel src';

        return buildAndTest(project, function (violations) {
          expectViolationsInFile(violations, 'babel.js');
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Invalid quote mark/);
        });
      });

      it('coffeescript files will be checked after compilation', function () {
        project.mimosaConfig.modules.push('coffeescript');
        project.mimosaConfig.jscs = { executeAfterCompile: true };

        project.files.assets.javascripts['valid_coffee.coffee'] =
          '`var _foo`'; // valid coffeescript, invalid javascript

        return buildAndTest(project, function (violations) {
          expect(violations).toEqual([]);
        });
      });
    });

    describe('not set', function () {
      it('javascript files will be checked after compilation', function () {
        // Babel will insert a "use strict" statement (with double
        // quotes) at the top of the compiled file
        project.mimosaConfig.modules.push('babel');
        project.mimosaConfig.jscs = { rules: { validateQuoteMarks: '\'' } };

        project.files.assets.javascripts['babel.js'] = '// Babel src';

        return buildAndTest(project, function (violations) {
          expectViolationsInFile(violations, 'babel.js');
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Invalid quote mark/);
        });
      });
    });
  });

  describe('can load a configuration from a file', function () {
    ['.jscsrc', '.jscs.json'].forEach(function (fileName) {
      it('with name ' + fileName + ' containing JSON', function () {
        project.mimosaConfig.jscs = { configFile: fileName };

        project.files.assets.javascripts['main.js'] = '// no line feed';
        project.files[fileName] = '{ "requireLineFeedAtFileEnd": true }';

        return buildAndTest(project, function (violations) {
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Missing line feed/);
        });
      });
    });

    it('with name .jscsrc containing commented JSON', function () {
      project.mimosaConfig.jscs = { configFile: '.jscsrc' };

      project.files.assets.javascripts['main.js'] = '// no line feed';
      project.files['.jscsrc'] =
        '{ // ...\n "requireLineFeedAtFileEnd": /* ... */ true }';

      return buildAndTest(project, function (violations) {
        expect(violations.length).toBe(1);
        expect(violations[0]).toMatch(/Missing line feed/);
      });
    });

    it('with name config.js containing a node module', function () {
      project.mimosaConfig.jscs = { configFile: 'config.js' };

      project.files.assets.javascripts['main.js'] = '// no line feed';
      project.files['config.js'] =
        'module.exports = { requireLineFeedAtFileEnd: true }';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });

    it('with name package.json containing JSON with the configuration ' +
       'in a property jscsConfig', function () {
      project.mimosaConfig.jscs = { configFile: 'package.json' };

      project.files.assets.javascripts['main.js'] = '// no line feed';
      project.files['package.json'] =
        '{ "jscsConfig": { "requireLineFeedAtFileEnd": true } }';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });
  });

  describe('when configured with both a file and a mimosa config property',
           function () {
    it('the used configuration is a combination of the two', function () {
      project.mimosaConfig.jscs = {
        configFile: '.jscsrc',
        rules: {
          disallowMultipleVarDecl: true
        }
      };
      project.files['.jscsrc'] = '{ "requireLineFeedAtFileEnd": true }';
      project.files.assets.javascripts['file1.js'] = '// no line feed';
      project.files.assets.javascripts['file2.js'] = 'var x, y;\n';

      return buildAndTest(project, function (violations) {
        expectViolationsInFile(violations, 'file1.js');
        expectViolationsInFile(violations, 'file2.js');
        expect(violations.length).toBe(2);
        var file1ViolationIdx =
              violations[0].indexOf('file1.js') !== -1 ? 0 : 1;
        var file2ViolationIdx = 1 - file1ViolationIdx;
        expect(violations[file1ViolationIdx]).toMatch(/Missing line feed/);
        expect(violations[file2ViolationIdx]).toMatch(/Multiple var decl/);
      });
    });

    it('the mimosa config property overrides the file', function () {
      project.mimosaConfig.jscs = {
        configFile: '.jscsrc',
        rules: {
          preset: null
        }
      };
      project.files['.jscsrc'] = '{ "preset": "crockford" }';
      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

      return buildAndTest(project, function (violations) {
        expect(violations).toEqual([]);
      });
    });
  });

  describe('when linting with an empty configuration', function () {
    it('a warning is logged if neither rules nor configFile is set',
       function () {
         project.mimosaConfig.jscs = { };

         return project.build()
           .then(function (buildResult) {
             expect(buildResult.warnings.length).toBe(1);
             expect(buildResult.warnings[0].text).toMatch(
                 /Neither JSCS rules or JSCS config file specified/);
           });
       });

    it('no warning is logged if rules option set to an empty object',
       function () {
         project.mimosaConfig.jscs = { rules: { } };

         return project.build()
           .then(function (buildResult) {
             expect(buildResult.warnings.length).toBe(0);
           });
       });

    it('no warning is logged if configFile options is set', function () {
      project.mimosaConfig.jscs = { configFile: '.jscsrc' };
      project.files['.jscsrc'] = '{}';

      return project.build()
        .then(function (buildResult) {
          expect(buildResult.warnings.length).toBe(0);
        });
    });
  });
});

JSCS_VERSIONS_TO_TEST.forEach(function (jscsVersion) {
  describe('mimosa-jscs with JSCS v' + jscsVersion, function () {
    var project;

    beforeEach(function () {
      return setupProject(jscsVersion).then(function (createdProject) {
        project = createdProject;
      });
    });

    describe('linting a single copied JS asset', function () {
      it('with default configuration reports no violations ' +
         'for correct (but ugly) code',
         function () {
           project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

           return buildAndTest(project, function (violations) {
             expect(violations).toEqual([]);
           });
         });

      it('with default configuration reports violations ' +
         'for malformed code',
         function () {
           project.files.assets.javascripts['main.js'] = 'malformed code';

           return buildAndTest(project, function (violations) {
             expect(violations.length).toBe(1);
             expect(violations[0]).toMatch(/Unexpected identifier/);
           });
         });

      it('can lint using a preset', function () {
        project.mimosaConfig.jscs = { rules: { preset: 'jquery' } };

        project.files.assets.javascripts['main.js'] = 'x=1';

        return buildAndTest(project, function (violations) {
          expect(violations).toNotEqual([]);
        });
      });

      it('can lint using an individually enabled rule', function () {
        project.mimosaConfig.jscs = {
          rules: { requireLineFeedAtFileEnd: true }
        };

        project.files.assets.javascripts['main.js'] = '// No line feed';

        return buildAndTest(project, function (violations) {
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Missing line feed/);
        });
      });
    });

    if (semver.satisfies(jscsVersion, '>= 1.7.0')) {
      describe('supports the maxErrors option', function () {
        it('which limits the number of violations reported', function () {
          project.mimosaConfig.jscs = {
            rules: {
              requireLineFeedAtFileEnd: true,
              disallowDanglingUnderscores: true,
              maxErrors: 1
            }
          };

          project.files.assets.javascripts['main.js'] = 'var _foo;';

          return buildAndTest(project, function (violations) {
            expect(violations.length).toBe(1);
          });
        });

        it('which applies per project and not per file in build mode',
           function ()
        {
          project.mimosaConfig.jscs = {
            rules: {
              requireLineFeedAtFileEnd: true,
              disallowDanglingUnderscores: true,
              maxErrors: 1
            }
          };

          project.files.assets.javascripts['file1.js'] = 'var _foo;';
          project.files.assets.javascripts['file2.js'] = 'var _foo;';

          return buildAndTest(project, function (violations) {
            expect(violations.length).toBe(1);
          });
        });
      });
    }

    if (semver.satisfies(jscsVersion, '>= 1.7.3')) {
      it('supports the esnext option which enables ES6 parsing', function () {
        project.mimosaConfig.jscs = {
          rules: {
            esnext: true
          }
        };

        project.files.assets.javascripts['main.js'] = 'class Foo {} // ES6';

        return buildAndTest(project, function (violations) {
          expect(violations).toEqual([]);
        });
      });
    }

    describe('supports the additionalRules option', function () {
      // JS file that defines a rule that always reports one violation
      // with the description "Dummy error":
      var RULE_DEF_FILE_CONTENTS =
            'module.exports = function() {};\n' +
            'module.exports.prototype = {\n' +
            '  configure: function() { },\n' +
            '  getOptionName: function() { return "dummy"; },\n' +
            '  check: function(file, errors) {\n' +
            '    errors.add("Dummy error", 1, 0);\n' +
            '  }\n' +
            '};';

      it('which can be used to enable custom rules', function () {
        project.mimosaConfig.jscs = {
          rules: {
            additionalRules: ['rules/*.js'],
            dummy: true
          }
        };

        project.files.rules = { 'dummy-rule.js': RULE_DEF_FILE_CONTENTS };

        project.files.assets.javascripts['main.js'] = '// Empty file';

        return buildAndTest(project, function (violations) {
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Dummy error/);
        });
      });

      it('which specified paths relative to the project root', function () {
        // This test loads the config from a file and verifies that the
        // additionalRules path is still relative to the project root
        project.mimosaConfig.jscs = {
          configFile: 'config/config.json'
        };

        project.files.rules = { 'dummy-rule.js': RULE_DEF_FILE_CONTENTS };

        project.files.config = {
          'config.json':
          '{ "additionalRules": [ "rules/*.js" ], "dummy": true }'
        };

        project.files.assets.javascripts['main.js'] = '// Empty file';

        return buildAndTest(project, function (violations) {
          expect(violations.length).toBe(1);
          expect(violations[0]).toMatch(/Dummy error/);
        });
      });
    });

    if (semver.satisfies(jscsVersion, '>= 1.8.0')) {
      describe('supports the plugins option and can load a plugin', function ()
      {
        it('from a relative path', function () {
          var PLUGIN_FILE_CONTENTS =
                'module.exports = function (conf) {\n' +
                '  conf.registerPreset(\'preset-defined-in-plugin\',\n' +
                '                      { requireLineFeedAtFileEnd: true });\n' +
                '};\n';

          project.mimosaConfig.jscs = {
            rules: {
              plugins: ['./plugins/plugin.js'],
              preset: 'preset-defined-in-plugin'
            }
          };

          project.files.plugins = {
            'plugin.js': PLUGIN_FILE_CONTENTS
          };

          project.files.assets.javascripts['main.js'] = '// No line feed';

          return buildAndTest(project, function (violations) {
            expect(violations.length).toBe(1);
            expect(violations[0]).toMatch(/Missing line feed/);
          });
        });

        it('published as an npm module', function () {
          project.mimosaConfig.jscs = {
            rules: {
              plugins: ['jscs-jsdoc'],
              jsDoc: {
                checkAnnotations: true
              }
            }
          };

          project.files.assets.javascripts['main.js'] =
            '/**\n' +
            '* @lalala\n' +
            '*/\n' +
            'function _f() {}\n';

          return project.exec('npm', 'install', 'jscs-jsdoc@0.4.5')
            .then(buildAndTest.bind(undefined, project, function (violations) {
              expect(violations.length).toBe(1);
              expect(violations[0]).toMatch(/unavailable tag lalala/);
            }));
        });
      });
    }
  });
});

// Helper function that creates a project and (optionally) installs
// a specific JSCS version.
function setupProject(jscsVersion) {
  function setup() {
    var project = new MimosaProject();
    project.mimosaConfig.modules.push('jscs');

    var modules = [path.normalize(process.cwd())];
    jscsVersion && modules.push('jscs@' + jscsVersion);

    var npmInstallCmd = ['npm', 'install'].concat(modules);

    return project.exec.apply(project, npmInstallCmd).then(function () {
      return Promise.resolve(project);
    });
  }

  // Setup sometimes fails because npm install fails. This appears
  // to be random and possibly a bug in npm. The code below is a
  // workaround that retries the installation twice before giving
  // up.
  return setup().catch(setup).catch(setup);
}

// Helper function that builds and invokes a test function with
// violations, testResult as arguments
function buildAndTest(project, testFunc) {
  return project.build()
    .then(extractJscsViolations)
    .then(testFunc);
}

// Helper function that, given a MimosaProject build result, returns
// a resolved promise with an array of JSCS violations. Intended for
// chaining after MimosaProject.build to get easy access to
// violations.
function extractJscsViolations(buildResult) {
  var violations = [];
  buildResult.warnings.forEach(function (warning) {
    warning.message.indexOf('JSCS Error:') === 0 &&
      violations.push(warning.message);
  });
  return Promise.resolve(violations, buildResult);
}

// Helper functions that fails the test if the list of violations
// does not mention a particular file
function expectViolationsInFile(violations, fileName, msg) {
  var violationFound;
  violations.forEach(function (violation) {
    violationFound || (violationFound = violation.indexOf(fileName) !== -1);
  });

  msg || (msg = 'expected file "' + fileName +
          '" to be linted and produce violations');
  expect(violationFound).toBe(true, msg);
}
