//
// Copyright (c) 2014-2015, THUNDERBEAST GAMES LLC All rights reserved
// LICENSE: Atomic Game Engine Editor and Tools EULA
// Please see LICENSE_ATOMIC_EDITOR_AND_TOOLS.md in repository root for
// license information: https://github.com/AtomicGameEngine/AtomicGameEngine
//

import EditorUI = require("ui/EditorUI");
import UIEvents = require("ui/UIEvents");
import PlayMode = require("ui/playmode/PlayMode");
import EditorLicense = require("./EditorLicense");
import EditorEvents = require("./EditorEvents");
import Preferences = require("./Preferences");
import ProgressModal = require("../ui/modal/ProgressModal");

class Editor extends Atomic.ScriptObject {

    project: ToolCore.Project;
    editorLicense: EditorLicense;
    playMode: PlayMode;

    static instance: Editor;

    projectCloseRequested: boolean;
    exitRequested: boolean;

    progressModal: ProgressModal;

    constructor() {

        super();

        // limit the framerate to limit CPU usage
        Atomic.getEngine().maxFps = 60;

        Atomic.getEngine().autoExit = false;

        Editor.instance = this;

        Preferences.getInstance().read();

        this.initUI();

        this.editorLicense = new EditorLicense();

        EditorUI.initialize();

        this.playMode = new PlayMode();

        Atomic.getResourceCache().autoReloadResources = true;

        this.progressModal = new ProgressModal("Opening Project", "Project opening, please wait...");

        this.subscribeToEvent(EditorEvents.LoadProject, (data) => this.handleEditorLoadProject(data));
        this.subscribeToEvent(EditorEvents.CloseProject, (data) => this.handleEditorCloseProject(data));
        this.subscribeToEvent("ProjectUnloaded", (data) => {
            Atomic.graphics.windowTitle = "AtomicEditor";
            this.handleProjectUnloaded(data);
        });

        this.subscribeToEvent("IPCPlayerWindowChanged", (data) => {
            var playerWindow = Preferences.getInstance().playerWindow;
            //if player window is maximized, then we want keep the window size from the previous state
            if (data.maximized) {
                playerWindow.x = data.posX;
                playerWindow.y = data.posY;
                playerWindow.monitor = data.monitor;
                playerWindow.maximized = true;
            } else {
                playerWindow = {x: data.posX, y: data.posY, width: data.width, height: data.height, monitor: data.monitor, maximized: data.maximized};
            }
            Preferences.getInstance().savePlayerWindowData(playerWindow);
        });

        this.subscribeToEvent("ScreenMode", (data:Atomic.ScreenModeEvent) => this.saveWindowPreferences(data));
        this.subscribeToEvent("WindowPos", (data:Atomic.ScreenModeEvent) => this.saveWindowPreferences(data));

        this.subscribeToEvent("ExitRequested", (data) => this.handleExitRequested(data));

        this.subscribeToEvent("ProjectLoaded", (data) => {
            Atomic.graphics.windowTitle = "AtomicEditor - " + data.projectPath;
            Preferences.getInstance().registerRecentProject(data.projectPath);
            this.progressModal.hide();
        });

        this.subscribeToEvent("EditorResourceCloseCanceled", (data) => {
            //if user canceled closing the resource, then user has changes that he doesn't want to lose
            //so cancel exit/project close request and unsubscribe from event to avoid closing all the editors again
            this.exitRequested = false;
            this.projectCloseRequested = false;
            this.unsubscribeFromEvent(EditorEvents.EditorResourceClose);
        });

        this.parseArguments();
    }

    initUI() {

      var ui = Atomic.ui;
      ui.loadSkin("AtomicEditor/resources/default_skin/skin.tb.txt", "AtomicEditor/editor/skin/skin.tb.txt");
      ui.addFont("AtomicEditor/resources/vera.ttf", "Vera");
      ui.addFont("AtomicEditor/resources/MesloLGS-Regular.ttf", "Monaco");
      ui.setDefaultFont("Vera", 12);

    }

    saveWindowPreferences(data: Atomic.ScreenModeEvent): boolean {
        var graphics = Atomic.getGraphics();
        if (!graphics) return false;

        var pos = graphics.getWindowPosition();
        var width = graphics.getWidth();
        var height = graphics.getHeight();
        var monitor = graphics.getCurrentMonitor();

        var editorWindowData = Preferences.getInstance().editorWindow;

        if (graphics.getMaximized()) {
            editorWindowData.x = pos[0];
            editorWindowData.y = pos[1];
            editorWindowData.maximized = true;
            editorWindowData.monitor = monitor;
        } else {
            editorWindowData = {x: pos[0], y: pos[1], width: width, height: height, monitor: monitor, maximized: false};
        }

        Preferences.getInstance().saveEditorWindowData(editorWindowData);

        return true;
    }

    handleEditorLoadProject(event: EditorEvents.LoadProjectEvent): boolean {

        var system = ToolCore.getToolSystem();
        if (system.project) {

            this.sendEvent(UIEvents.MessageModalEvent,
                { type: "error", title: "Project already loaded", message: "Project already loaded" });

            return false;

        }

        this.progressModal.show();
        return system.loadProject(event.path);
    }

    closeAllResourceEditors() {
        var editor = EditorUI.getCurrentResourceEditor();
        if (!editor) {
          if (this.exitRequested) {
              this.exit();
          } else if (this.projectCloseRequested) {
              this.closeProject();
          }
          return;
        }
        //wait when we close resource editor to check another resource editor for unsaved changes and close it
        this.subscribeToEvent(EditorEvents.EditorResourceClose, (data) => {
            this.closeAllResourceEditors();
        });
        editor.requestClose();
    }

    handleEditorCloseProject(event) {
        this.projectCloseRequested = true;
        this.closeAllResourceEditors();
    }

    closeProject() {
        this.sendEvent("IPCPlayerExitRequest");
        var system = ToolCore.getToolSystem();

        if (system.project) {

            system.closeProject();
            this.sendEvent(EditorEvents.ProjectClosed);
            this.projectCloseRequested = false;
            this.unsubscribeFromEvent(EditorEvents.EditorResourceClose);
        }

    }

    handleProjectUnloaded(event) {

        this.sendEvent(EditorEvents.ActiveSceneEditorChange, { sceneEditor: null });

    }

    parseArguments() {

        var args = Atomic.getArguments();

        var idx = 0;

        while (idx < args.length) {

            if (args[idx] == "--project") {

                this.sendEvent(EditorEvents.LoadProject, { path: args[idx + 1] });

            }

            idx++;

        }

    }

    // event handling
    handleExitRequested(data) {
        if (this.exitRequested) return;
        this.sendEvent("IPCPlayerExitRequest");
        this.exitRequested = true;
        this.closeAllResourceEditors();
    }

    exit() {
        //Preferences.getInstance().write();
        EditorUI.shutdown();
        Atomic.getEngine().exit();
    }

   


}

export = Editor;
