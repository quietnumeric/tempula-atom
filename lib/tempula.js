'use babel';

import { debug } from './tempula-core';
import TempulaView from './tempula-view';
import { CompositeDisposable } from 'atom';

export default {

  tempulaView: null,
  modalPanel: null,
  subscriptions: null,
  escapeListener: null,

  activate(state) {
    debug('main.activate');
    this.tempulaView = new TempulaView(state.tempulaViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.tempulaView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'tempula:new': () => this.open()
    }));

    this.escapeListener = this.onEscapeKey.bind(this);
  },

  onEscapeKey(e) {
    keystroke = atom.keymaps.keystrokeForKeyboardEvent(e);
    if (keystroke == 'escape') {
      debug('main.escape');
      this.close();
    }
  },

  deactivate() {
    debug('main.deactive');
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.tempulaView.destroy();
  },

  serialize() {
    return {
      tempulaViewState: this.tempulaView.serialize()
    };
  },

  open() {
    debug('main.open');
    this.modalPanel.show();
    const item = atom.workspace.getActivePaneItem();
    const paths = item.selectedPaths();
    this.tempulaView.open(paths[0]);
    window.addEventListener('keydown', this.escapeListener, true);
  },

  close() {
    debug('main.close');
    this.modalPanel.hide();
    window.removeEventListener('keydown', this.escapeListener, true);
  },
};
