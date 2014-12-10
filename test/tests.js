var path = require('path');
var expect = require('expect');
var util = require('util');
var Promise = require('bluebird');
var MimosaProject = require('./MimosaProject');

describe('mimosa-jscs', function () {
  var project;

  beforeEach(function () {
    function setup() {
      project = new MimosaProject();
      project.mimosaConfig.modules.push('jscs');
      return project.exec('npm', 'install', path.normalize(process.cwd()));
    }

    // Setup sometimes fails because npm install fails. This appears
    // to be random and possibly a bug in npm. The code below is a
    // workaround that retries the installation twice before giving
    // up.
    return setup().catch(setup).catch(setup);
  });

  describe('when linting a single copied JS asset', function () {
    it('default configuration reports no violations ' +
       'for correct (but ugly) code',
       function () {
         project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

         return buildAndTest(project, function (violations) {
           expect(violations).toEqual([]);
         });
       });

    it('default configuration reports violations ' +
       'for malformed code',
       function () {
         project.files.assets.javascripts['main.js'] = 'malformed code';

         return buildAndTest(project, function (violations) {
           expect(violations).toNotEqual([]);
         });
       });

    it('a preset can be used to enable rules', function () {
      project.mimosaConfig.jscs = { rules: { preset: 'crockford' } };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });

    it('a rule can be individually enabled', function () {
      project.mimosaConfig.jscs = { rules: { requireLineFeedAtFileEnd: true } };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

      return buildAndTest(project, function (violations) {
        expect(violations.length).toBe(1);
      });
    });
  });

  describe('when linting a project with a JS file, a coffeescript file, ' +
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
                              'copied-vendor.js'] },
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
        });
      });
    });
  });

  describe('files can be excluded from linting', function () {
    it('using a string', function () {
      project.mimosaConfig.jscs = {
        exclude: ['javascripts/to-be-excluded.js'],
        rules: {
          requireLineFeedAtFileEnd: true
        }
      };
      project.files.assets.javascripts['to-be-excluded.js'] = 'x=1;"ugly code"';
      project.files.assets.javascripts['to-not-be-excluded.js'] =
        'x=1;"ugly code"';

      return buildAndTest(project, function (violations) {
        expectViolationsInFile(violations, 'to-not-be-excluded.js');
        expect(violations.length).toEqual(1);
      });
    });

    it('using a regex', function () {
      project.mimosaConfig.jscs = {
        exclude: [/to-be-excluded/],
        rules: {
          requireLineFeedAtFileEnd: true
        }
      };
      project.files.assets.javascripts['to-be-excluded.js'] = 'x=1;"ugly code"';
      project.files.assets.javascripts['to-not-be-excluded.js'] =
        'x=1;"ugly code"';

      return buildAndTest(project, function (violations) {
        expectViolationsInFile(violations, 'to-not-be-excluded.js');
        expect(violations.length).toEqual(1);
      });
    });
  });

  describe('does not allow a malformed configuration', function () {
    [
      {
        desc: 'where config.jscs is not an object',
        config: []
      },
      {
        desc: 'where config.jcsc.compiled is not a boolean',
        config: { compiled: 'true' }
      },
      {
        desc: 'where config.jcsc.copied is not a boolean',
        config: { copied: 'true' }
      },
      {
        desc: 'where config.jcsc.vendor is not a boolean',
        config: { vendor: 'true' }
      },
      {
        desc: 'where config.jcsc.rules is not an object',
        config: { rules: [] }
      },
      {
        desc: 'where config.jcsc.exclude is not an array',
        config: { exclude: true }
      },
      {
        desc: 'where config.jcsc.configFile is not a string',
        configFile: true
      },
      {
        desc: 'where config.jcsc.configFile is not an existing file',
        configFile: 'nothing.json'
      }
    ].forEach(function (data) {
      it(data.desc, function () {
        project.mimosaConfig.jscs = data.config;

        return project.build()
          .then(function () {
            throw new Error('Build successful despite malformed JSCS config: ' +
                            util.inspect(data.config, { depth: null }));
          }).error(function () {
            // Expected (build should fail)
          });
      });
    });
  });

  describe('can load a configuration from a file', function () {
    ['.jscsrc', '.jscs.json'].forEach(function (fileName) {
      it('with name ' + fileName + ' containing JSON', function () {
        project.mimosaConfig.jscs = { configFile: fileName };

        project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';
        project.files[fileName] = '{ "preset": "crockford" }';

        return buildAndTest(project, function (violations) {
          expect(violations).toNotEqual([]);
        });
      });
    });

    it('with name .jscsrc containing commented JSON', function () {
      project.mimosaConfig.jscs = { configFile: '.jscsrc' };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';
      project.files['.jscsrc'] =
        '{ // ...\n"preset": /* ... */ "crockford" }';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });

    it('with name config.js containing a node module', function () {
      project.mimosaConfig.jscs = { configFile: 'config.js' };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';
      project.files['config.js'] =
        'module.exports = { preset: "crockford" }';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });

    it('with name package.json containing JSON with the configuration ' +
       'in a property jscsConfig', function () {
      project.mimosaConfig.jscs = { configFile: 'package.json' };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';
      project.files['package.json'] =
        '{ "jscsConfig": { "preset": "crockford" } }';

      return buildAndTest(project, function (violations) {
        expect(violations).toNotEqual([]);
      });
    });
  });

  describe('when configuring with both a file and a mimosa config property',
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
        expect(violations.length).toEqual(2);
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

  describe('when having an empty configuration', function () {
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
