exports.config =
  modules: ["jshint", "copy"]
  watch:
    sourceDir: "src"
    compiledDir: "lib"
    javascriptDir: null
  jshint:
    rules:
      camelcase: true
      curly: true
      eqeqeq: true
      freeze: true
      immed: false
      latedef: 'nofunc'
      maxlen: 80
      newcap: true
      noarg: true
      quotmark: true
      strict: true
      undef: true
      unused: true

      expr: true
      globalstrict: true

      node: true
