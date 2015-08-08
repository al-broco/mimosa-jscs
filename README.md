mimosa-jscs
===========

This is a [Mimosa](http://mimosa.io) module for linting Javascript
code using [JSCS](http://jscs.info/).

Installation
------------

Add `jscs` to your Mimosa project's list of modules and build the
project. This will download the latest version of `mimosa-jscs` from
[npmjs.org](https://www.npmjs.org/package/mimosa-jscs).

Configuration
-------------

To customize the linting you need to add a `jscs` configuration to
your project's `mimosa-config`. `mimosa-jscs` is configured in the
same way as other Mimosa linting tools such as
[mimosa-jshint](https://github.com/dbashford/mimosa-jshint). The
configuration options and the default values are as follows:

    jscs: {
        exclude: [],
        compiled: true,
        copied: true,
        vendor: false,
        executeAfterCompile: true,
        configFile: undefined,
        rules: {}
    }

Which files are linted are controlled by the `jscs.exclude`,
`jscs.compiled`, `jscs.copied`, and `jscs.vendor` options. These
options work just like the corresponding options for the
[JSHint Mimosa plugin](https://github.com/dbashford/mimosa-jshint).

`executeAfterCompile` determines whether JSCS runs on code before
or after it is compiled. This defaults to `true` which means that
JSCS runs on compiled code. So, for instance, it would not run on
CoffeeScript, instead it would run on the compiled JavaScript. You
may find you want to run on pre-compiled code. Some compilers, like
[Babel](http://www.babeljs.io) will transform the style of the code
when it compiles it.  If running on the compiled output of Babel,
JSCS will have many problems that cannot be avoided.

To configure JSCS, set either the `jscs.rules` property, the
`jscs.configFile` property, or both. JSCS configuration options are
described in detail in [the JSCS documentation](http://jscs.info). For
example, adding the following to your Mimosa config will make JSCS
check that files end with a newline:

    jscs: {
      rules: {
        requireLineFeedAtFileEnd: true
      }
    }

`mimosa-jscs` will pass the configuration to JSCS without validating
its contents. The following configuration options have been verified
to work:

* [Individual rules](http://jscs.info/rules.html).
* `preset`.
* `additionalRules`. Rule paths are relative to the project root.
* `excludeFiles`. In addition to the `jscs.exclude` property described
  above, `mimosa-jscs` also supports excluding files using
  `excludeFiles` in the JSCS configuration. This can come in handy if
  you want to share a JSCS configuration file between Mimosa and (for
  instance) an editor or IDE. Paths are relative to the project root.
* `maxErrors`. In build mode, `maxErrors` is the maximum number of
  reported violations per build. In watch mode, `maxErrors` is per
  file.
* `errorFilter`. Paths are relative to the project root.
* `esnext`.
* `plugins`. Paths are relative to the project root.
* `verbose`.

The option `fileExtensions` is currently ignored.

`jscs.configFile` is the file name of a JSCS configuration file,
absolute or relative to the project's root. In contrast to running
JSCS from the command line, `mimosa-jscs` will not search other
directories outside of your project for a configuration file. In
particular, it will not search your home directory or the project
directory's ancestors for a file named `.jscsrc` or `.jscs.json`. This
is to make building independent of external files not part of the
Mimosa project.

`mimosa-jscs` reads configuration files the same way as JSCS does,
which means that the file format is determined from the file name:
* If the file extension is `.js` the file is read as a [Node
  module](http://nodejs.org/api/modules.html) using Node's require.
* If the file name is `package.json` the file is standard JSON and the
  configuration is in a property called `jscsConfig`.
* If the file name is anything else with the extension `.json` the
  file is standard JSON.
* Otherwise the file is commented JSON. Comments are standard
  Javascript comments and are stripped using
  [strip-json-comments](https://www.npmjs.org/package/strip-json-comments).

Both `configFile` and `rules` can be specified at the same time. In
that case the configuration passed to JSCS will be the configuration
found in the file overridden by anything found in `rules`. Note that
in JSCS rules always override presets meaning that a rule configured
in the file will still override a preset configured in `rules`.

### Examples

To lint your Javascript using JSCS'
[Crockford](http://javascript.crockford.com/code.html) preset, add the
following to your project's Mimosa configuration:

    jscs: {
      rules: {
        preset: 'crockford',
      }
    }

The following configuration will lint according to the Crockford
preset and also check that all comments starts with a capital letter:

    jscs: {
      rules: {
        preset: 'crockford',
        requireCapitalizedComments: true
      }
    }

To disable a rule, set it to `null` (this is standard JSCS behavior).
The following configration will lint using the Crockford preset but
disable indentation checking:

    jscs: {
      rules: {
        preset: 'crockford',
        validateIndentation: null
      }
    }

The following module configuration will read the JSCS configuration
from the project's `package.json`:

    jscs: {
      configFile: 'package.json'
    }

To lint using the Crockford preset, add the following to your
`package.json`:

    jscsConfig: {
        preset: 'crockford'
    }

Compatibility
-------------

By default `mimosa-jscs` uses the latest version of JSCS that is
compatible with a version it has been tested with. Compatibility is
according to [semver](http://semver.org/).

JSCS' approach to versioning is explained in the [JSCS
documentation](http://jscs.info/overview.html#versioning-semver). In
short, changes in rules and presets that cause more (or less) code
style violations to be reported are not considered breaking
changes. To have better control of your JSCS linting you may want to
use a specific version of JSCS.

To use a specific JSCS version add JSCS as dependency to your
project. For example, to use JSCS version 1.8.0 type the following in
your project root:

    npm install --save-dev --save-exact jscs@1.8.0

If you try to use `mimosa-jscs` with a version of JSCS it has not been
verified to be compatible with, `npm install` will fail with the
following message:

    npm ERR! peerinvalid The package jscs does not satisfy its siblings' peerDependencies requirements!

`mimosa-jscs` has been verified to work with the following JSCS
versions: [1.3.0](https://github.com/jscs-dev/node-jscs/tree/v1.3.0),
[1.4.0](https://github.com/jscs-dev/node-jscs/tree/v1.4.0),
[1.4.3](https://github.com/jscs-dev/node-jscs/tree/v1.4.3),
[1.4.4](https://github.com/jscs-dev/node-jscs/tree/v1.4.4),
[1.4.5](https://github.com/jscs-dev/node-jscs/tree/v1.4.5),
[1.5.1](https://github.com/jscs-dev/node-jscs/tree/v1.5.1),
[1.5.2](https://github.com/jscs-dev/node-jscs/tree/v1.5.2),
[1.5.3](https://github.com/jscs-dev/node-jscs/tree/v1.5.3),
[1.5.4](https://github.com/jscs-dev/node-jscs/tree/v1.5.4),
[1.5.6](https://github.com/jscs-dev/node-jscs/tree/v1.5.6),
[1.5.7](https://github.com/jscs-dev/node-jscs/tree/v1.5.7),
[1.5.8](https://github.com/jscs-dev/node-jscs/tree/v1.5.8),
[1.5.9](https://github.com/jscs-dev/node-jscs/tree/v1.5.9),
[1.6.0](https://github.com/jscs-dev/node-jscs/tree/v1.6.0),
[1.6.1](https://github.com/jscs-dev/node-jscs/tree/v1.6.1),
[1.6.2](https://github.com/jscs-dev/node-jscs/tree/v1.6.2),
[1.7.0](https://github.com/jscs-dev/node-jscs/tree/v1.7.0),
[1.7.1](https://github.com/jscs-dev/node-jscs/tree/v1.7.1),
[1.7.2](https://github.com/jscs-dev/node-jscs/tree/v1.7.2),
[1.7.3](https://github.com/jscs-dev/node-jscs/tree/v1.7.3),
[1.8.0](https://github.com/jscs-dev/node-jscs/tree/v1.8.0),
[1.8.1](https://github.com/jscs-dev/node-jscs/tree/v1.8.1),
[1.9.0](https://github.com/jscs-dev/node-jscs/tree/v1.9.0), 1.10.0,
1.11.0, 1.11.1, 1.11.2, 1.11.3, 1.12.0, 1.13.0, 1.13.1, and 2.0.0.

This module has been tested with Mimosa 2.3.x but should work with
other versions of Mimosa as well.

Version history
---------------

* **Next version** Added JSCS v2.0.0 to list of compatible
  versions. Starting with version 2.0.0 the API `mimos-jscs` uses is
  part of JSCS' public API and is covered by the semver versioning
  rules. This makes it much easier to manage compatibility,
  `mimosa-jscs` should now be compatible with any JSCS version 2.x.y.
  Updated the documentation accordingly.
* **[2.3.0](https://github.com/al-broco/mimosa-jscs/tree/v2.3.0)**
  Added JSCS v1.13.0 and v1.13.1 to list of compatible versions.
* **[2.2.0](https://github.com/al-broco/mimosa-jscs/tree/v2.2.0)**
  Added configuration option `executeAfterCompile` that makes it
  possible to configure if style of compiled resources are checked
  before or after compilation. Useful when compiling with
  Babel. Requested and implemented by dbashford.
* **[2.1.0](https://github.com/al-broco/mimosa-jscs/tree/v2.1.0)**
  Added JSCS v1.12.0 to list of compatible versions. Removed Mimosa
  `placeholder` config property to be compatible with upcoming Mimosa
  v3.0.0. Minor documentation updates.
* **[2.0.0](https://github.com/al-broco/mimosa-jscs/tree/v2.0.0)**
  JSCS is now an npm peer dependency which makes it possible for a
  user to choose JSCS version. Created unit tests for compatibility
  with JSCS versions from 1.3.0 up to 1.11.3. `package.json` contains
  a whitelist listing compatible versions.

  Major version bump because of the switch to a peer dependency for
  JSCS.
* **[1.1.0](https://github.com/al-broco/mimosa-jscs/tree/v1.1.0)**
  Support JSCS option excludeFiles.
* **[1.0.4](https://github.com/al-broco/mimosa-jscs/tree/v1.0.4)**
  Add documentation and test for esnext, additionalRules options.
* **[1.0.3](https://github.com/al-broco/mimosa-jscs/tree/v1.0.3)**
  Support for the maxErrors option.
* **[1.0.2](https://github.com/al-broco/mimosa-jscs/tree/v1.0.2)**
  Warn if neither rules nor config file is configured.
* **[1.0.1](https://github.com/al-broco/mimosa-jscs/tree/v1.0.1)**
  Cosmetic changes.
* **[1.0.0](https://github.com/al-broco/mimosa-jscs/tree/v1.0.0)**
  First functional version. Runs JSCS, loads configuration from mimosa
  config or file, configuration mimics mimosa-jshint.
