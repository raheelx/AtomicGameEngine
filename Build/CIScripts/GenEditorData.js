var fs = require('fs-extra');
var bcommon = require("./BuildCommon");
var host = require("./Host");

var buildDir = bcommon.artifactsRoot + "Build/EditorData/";
var jsDocFolder = bcommon.artifactsRoot + "Build/JSDoc/";
var atomicRoot = bcommon.atomicRoot;
var atomicTool = host.getAtomicToolBinary();

namespace('build', function() {

  task('genscriptbindings', {
    async: true
  }, function() {

    bcommon.cleanCreateDir(buildDir);
    bcommon.cleanCreateDir(jsDocFolder);

    var bindCmd = atomicTool + " bind \"" + atomicRoot + "\" ";

    var cmds = [
      bindCmd + "Script/Packages/Atomic/ WINDOWS",
      bindCmd + "Script/Packages/AtomicPlayer/ WINDOWS",
      bindCmd + "Script/Packages/ToolCore/ WINDOWS",
      bindCmd + "Script/Packages/Editor/ WINDOWS",
      bindCmd + "Script/Packages/AtomicNET/ WINDOWS",
      bindCmd + "Script/Packages/WebView/ WINDOWS",
    ];

    jake.exec(cmds, function() {

      console.log("Built Script Bindings");

      complete();

    }, {
      printStdout: true
    });

  });

  task('gendocs', ["build:genscriptbindings"], {
    async: true
  }, function() {

    console.log("Generating Examples & JSDocs");

    fs.copySync(atomicRoot + "Build/Docs/Readme.md", jsDocFolder + "/Readme.md");
    fs.copySync(atomicRoot + "Build/Docs/jsdoc.conf", jsDocFolder + "/jsdoc.conf");

    cmds = [
      "git clone https://github.com/AtomicGameEngine/AtomicExamples " + buildDir + "AtomicExamples && rm -rf " + buildDir + "AtomicExamples/.git",
      "cd " + jsDocFolder + " && npm install git+https://github.com/jsdoc3/jsdoc",
      "cd " + jsDocFolder + " && git clone https://github.com/AtomicGameEngine/jaguarjs-jsdoc && cd jaguarjs-jsdoc && git checkout atomic_master",
      "cd " + jsDocFolder + " && ./node_modules/.bin/jsdoc ./Atomic.js -t ./jaguarjs-jsdoc/ -c ./jsdoc.conf Readme.md",
    ];

    jake.exec(cmds, function() {

      fs.copySync(jsDocFolder + "out", buildDir + "Docs");
      complete();

    }, {
      printStdout: true
    });


  });

  task('ios_deploy', {
    async: true
  }, function() {

    var iosDeploybuildDir = bcommon.artifactsRoot + "Build/IOSDeploy/";

    bcommon.cleanCreateDir(iosDeploybuildDir);

    process.chdir(iosDeploybuildDir);

    jake.exec("git clone https://github.com/AtomicGameEngine/ios-deploy && cd ios-deploy && make ios-deploy",
      function() {

        complete();
      }, {
        printStdout: true
      });

  });

  task('compileeditorscripts', ["build:genscriptbindings"],{
    async: true
  }, function() {

    console.log("Compiling Editor Scripts");

    process.chdir(atomicRoot);

    var tsc = "./Build/node_modules/typescript/lib/tsc";

    cmds = [
      atomicRoot + "Build/Mac/node/node " + tsc + " -p ./Script",
      atomicRoot + "Build/Mac/node/node " + tsc + " -p ./Script/AtomicWebViewEditor"
    ];

    jake.exec(cmds, function() {

      // will be copied when editor resources are copied

      complete();

    }, {
      printStdout: true
    });


  });

  task('geneditordata', ["build:compileeditorscripts", "build:ios_deploy", "build:gendocs"], {
    async: true
  }, function() {

    // Mac App

    fs.copySync(atomicRoot + "Build/CIScripts/Mac/PlayerApp/",
      buildDir + "MacApps/PlayerApp/");

    // Editor Binaries

    fs.copySync(bcommon.artifactsRoot + "Build/Mac/Bin/AtomicEditor.zip",
      buildDir + "EditorBinaries/Mac/AtomicEditor.zip");

    fs.copySync(bcommon.artifactsRoot + "Build/Windows/Bin/AtomicEditor.exe",
      buildDir + "EditorBinaries/Windows/AtomicEditor.exe");

    fs.copySync(bcommon.artifactsRoot + "Build/Windows/Bin/D3DCompiler_47.dll",
      buildDir + "EditorBinaries/Windows/D3DCompiler_47.dll");

    // Resources

    fs.copySync(atomicRoot + "Resources/CoreData", buildDir + "Resources/CoreData");
    fs.copySync(atomicRoot + "Resources/EditorData", buildDir + "Resources/EditorData");
    fs.copySync(atomicRoot + "Resources/PlayerData", buildDir + "Resources/PlayerData");
    fs.copySync(atomicRoot + "/Data/AtomicEditor", buildDir + "Resources/ToolData");

    fs.copySync(atomicRoot + "Artifacts/Build/Resources/EditorData/AtomicEditor/EditorScripts",
      buildDir + "Resources/EditorData/AtomicEditor/EditorScripts");

    // root deployment
    var deployRoot = buildDir + "Resources/ToolData/Deployment/";

    fs.copySync(atomicRoot + "/Data/AtomicEditor/Deployment/", deployRoot);

    // Android
    fs.copySync(bcommon.artifactsRoot + "Build/Android/Bin/libAtomicPlayer.so",
      deployRoot + "Android/libs/armeabi-v7a/libAtomicPlayer.so");

    // Mac
    fs.copySync(bcommon.artifactsRoot + "Build/Mac/Bin/AtomicPlayer",
      deployRoot + "MacOS/AtomicPlayer.app/Contents/MacOS/AtomicPlayer");

    // IOS
    fs.copySync(bcommon.artifactsRoot + "Build/IOSDeploy/ios-deploy/ios-deploy",
      deployRoot + "IOS/ios-deploy/ios-deploy");
    fs.copySync(bcommon.artifactsRoot + "Build/IOS/Bin/AtomicPlayer",
      deployRoot + "IOS/AtomicPlayer.app/AtomicPlayer");

    // Web
    fs.copySync(bcommon.artifactsRoot + "Build/Web/Bin/AtomicPlayer.js",
      deployRoot + "Web/AtomicPlayer.js");
    fs.copySync(bcommon.artifactsRoot + "Build/Web/Bin/AtomicPlayer.html.mem",
      deployRoot + "Web/AtomicPlayer.html.mem");

    // Windows
    fs.copySync(bcommon.artifactsRoot + "Build/Windows/Bin/AtomicPlayer.exe",
      deployRoot + "Windows/x64/AtomicPlayer.exe");
    fs.copySync(bcommon.artifactsRoot + "Build/Windows/Bin/D3DCompiler_47.dll",
      deployRoot + "Windows/x64/D3DCompiler_47.dll");


    complete();

    process.chdir(buildDir);

    var cmds = ["zip -r -X ./EditorData.zip ./"];

    jake.exec(cmds,
      function() {
        complete();
      }, {
        printStdout: true
      });

  });

}); // end of build namespace
